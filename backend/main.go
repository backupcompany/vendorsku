package main

import (
	"compress/gzip"
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

func main() {
	db, err := openDB()
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	cache := newBodyCache()
	staff := func(h http.HandlerFunc) http.HandlerFunc { return guard(db, staffOnly, h) }

	// Public: sign-in, registration, and the reference data the landing page needs.
	mux.HandleFunc("GET /api/health", health(db))
	mux.HandleFunc("POST /api/sign-in", postSignInAs(db, "vendor", signInVendor))
	mux.HandleFunc("POST /api/staff/sign-in", postSignInAs(db, "staff", signInStaff))
	mux.HandleFunc("POST /api/vendors", postVendor(db))
	mux.HandleFunc("POST /api/sign-in/verify", postVerifyOTP(db))
	mux.HandleFunc("GET /api/hospitals", listHospitals(db))
	mux.HandleFunc("GET /api/options", func(w http.ResponseWriter, r *http.Request) {
		writeQuery(w, db.QueryRowContext(r.Context(), `SELECT coalesce(jsonb_object_agg(list, items), '{}'::jsonb) FROM (
			SELECT list, jsonb_agg(jsonb_build_object('value', value, 'label', label, 'meta', meta) ORDER BY sort, label) AS items
			FROM ref_options GROUP BY list
		) o`))
	})
	mux.HandleFunc("GET /api/skus/taxonomy", cachedQuery(db, cache, func(*http.Request) string { return "taxonomy" },
		func(r *http.Request) *sql.Row { return db.QueryRowContext(r.Context(), skuTaxonomy) }))
	mux.HandleFunc("GET /api/skus/search", skuSearch(db))

	mux.HandleFunc("GET /api/session", getSession(db))
	mux.HandleFunc("POST /api/sign-out", postSignOut(db))
	mux.HandleFunc("POST /api/password", guard(db, anySession, postChangePassword(db)))
	mux.HandleFunc("POST /api/password/forgot", postForgotPassword(db, "vendor"))
	mux.HandleFunc("POST /api/staff/password/forgot", postForgotPassword(db, "staff"))
	mux.HandleFunc("POST /api/password/reset", postResetPassword(db))

	// A vendor only ever reaches its own id; staff reach every vendor.
	mux.HandleFunc("GET /api/vendors/{id}", guard(db, selfOrStaff, func(w http.ResponseWriter, r *http.Request) {
		writeQuery(w, db.QueryRowContext(r.Context(), `SELECT vendor_doc($1)`, r.PathValue("id")))
	}))
	mux.HandleFunc("GET /api/vendors/{id}/catalog", guard(db, selfOrStaff, cachedQuery(db, cache,
		func(r *http.Request) string {
			return "catalog:" + r.PathValue("id") + ":" + fmt.Sprint(r.URL.Query().Get("all") == "1")
		},
		func(r *http.Request) *sql.Row {
			return db.QueryRowContext(r.Context(), `SELECT vendor_catalog($1, $2)`, r.PathValue("id"), r.URL.Query().Get("all") == "1")
		})))
	mux.HandleFunc("PATCH /api/vendors/{id}", guard(db, selfOrStaff, patchVendor(db)))
	mux.HandleFunc("POST /api/vendors/{id}/offers", guard(db, vendorSelf, postOffer(db)))
	mux.HandleFunc("POST /api/vendors/{id}/offers/bulk", guard(db, vendorSelf, postOffers(db)))
	mux.HandleFunc("DELETE /api/vendors/{id}/offers/{offerId}", guard(db, vendorSelf, deleteOffer(db)))
	mux.HandleFunc("POST /api/vendors/{id}/sku-proposals", guard(db, vendorSelf, postSkuProposal(db)))
	mux.HandleFunc("POST /api/vendors/{id}/sku-proposals/bulk", guard(db, vendorSelf, postSkuProposalsBulk(db)))
	mux.HandleFunc("GET /api/vendors/{id}/sku-proposals", guard(db, selfOrStaff, listVendorSkuProposals(db)))
	mux.HandleFunc("POST /api/vendors/{id}/sku-proposals/{skuId}/attachments", guard(db, vendorSelf, postSkuAttachment(db)))
	mux.HandleFunc("GET /api/vendors/{id}/sku-proposals/{skuId}/attachments", guard(db, selfOrStaff, listSkuAttachments(db)))
	mux.HandleFunc("DELETE /api/vendors/{id}/sku-proposals/{skuId}/attachments/{attId}", guard(db, vendorSelf, deleteSkuAttachment(db)))
	mux.HandleFunc("GET /api/attachments/{attId}", guard(db, anySession, getSkuAttachment(db)))
	mux.HandleFunc("GET /api/staff/sku-proposals", staff(listStaffSkuProposals(db)))
	mux.HandleFunc("POST /api/staff/sku-proposals/{id}/review", staff(reviewSkuProposal(db)))
	mux.HandleFunc("POST /api/staff/sku-proposals/{id}/ai-standard", staff(saveSkuProposalAI(db)))
	mux.HandleFunc("GET /api/staff/skus/{id}/attachments", staff(listStaffSkuAttachments(db)))
	mux.HandleFunc("GET /api/staff/discovery/search", staff(staffDiscoverySearch(db)))
	mux.HandleFunc("POST /api/staff/ai-logs", staff(postAiLog(db)))

	mux.HandleFunc("DELETE /api/vendors/{id}", staff(deleteVendor(db)))
	mux.HandleFunc("GET /api/staff/vendors", staff(func(w http.ResponseWriter, r *http.Request) {
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT coalesce(jsonb_agg(vendor_json(v) || jsonb_build_object('offerCount', coalesce(c.n, 0)) ORDER BY v.company_name), '[]'::jsonb)
			FROM vendors v
			LEFT JOIN (SELECT vendor_id, count(*) AS n FROM vendor_prices GROUP BY vendor_id) c ON c.vendor_id = v.id
		`))
	}))
	mux.HandleFunc("GET /api/staff/skus", staff(cachedQuery(db, cache, func(*http.Request) string { return "staff_skus" },
		func(r *http.Request) *sql.Row { return db.QueryRowContext(r.Context(), `SELECT staff_skus()`) })))
	mux.HandleFunc("GET /api/skus", staff(cachedQuery(db, cache, func(*http.Request) string { return "skus" },
		func(r *http.Request) *sql.Row {
			return db.QueryRowContext(r.Context(), `SELECT coalesce(jsonb_agg(sku_core(s) ORDER BY s.commodity_name), '[]'::jsonb) FROM master_skus s`)
		})))
	mux.HandleFunc("POST /api/staff/skus", staff(postSkus(db)))
	mux.HandleFunc("PATCH /api/staff/skus", staff(patchSkus(db)))
	mux.HandleFunc("POST /api/staff/skus/delete", staff(postDeleteSkus(db)))
	mux.HandleFunc("DELETE /api/staff/skus", staff(deleteSkus(db)))
	mux.HandleFunc("PATCH /api/staff/skus/{id}", staff(patchSku(db)))
	mux.HandleFunc("DELETE /api/staff/skus/{id}", staff(deleteSku(db)))
	mux.HandleFunc("POST /api/hospitals", staff(postHospital(db)))
	mux.HandleFunc("PATCH /api/hospitals/{id}", staff(patchHospital(db)))
	mux.HandleFunc("DELETE /api/hospitals/{id}", staff(deleteHospital(db)))
	mux.HandleFunc("GET /api/staff/tenders", staff(func(w http.ResponseWriter, r *http.Request) {
		writeQuery(w, db.QueryRowContext(r.Context(), `SELECT coalesce(jsonb_agg(jsonb_build_object(
			'id', id, 'tenderNumber', tender_number, 'title', title, 'description', description,
			'submissionDeadline', submission_deadline, 'status', status,
			'targetUnits', to_jsonb(target_units), 'totalSkus', total_skus, 'createdAt', created_at
		) ORDER BY created_at), '[]'::jsonb) FROM tenders`))
	}))
	mux.HandleFunc("GET /api/staff/ai-logs", staff(listAiLogs(db)))
	host, port := os.Getenv("GO_HOST"), os.Getenv("GO_PORT")
	if host == "" {
		host = "127.0.0.1"
	}
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:              net.JoinHostPort(host, port),
		Handler:           withGzip(withSecurityHeaders(mux)),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      2 * time.Minute,
		IdleTimeout:       2 * time.Minute,
	}
	log.Printf("siloam go api on %s", srv.Addr)
	log.Fatal(srv.ListenAndServe())
}

func openDB() (*sql.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://localhost:5432/siloam_sku?sslmode=disable"
	}
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	// postgres-core is shared with other apps: cap connections and kill runaway or abandoned work.
	cfg.RuntimeParams["application_name"] = "siloam-sku-api"
	cfg.RuntimeParams["statement_timeout"] = "30s"
	cfg.RuntimeParams["idle_in_transaction_session_timeout"] = "60s"
	db := stdlib.OpenDB(*cfg)
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxIdleTime(5 * time.Minute)
	db.SetConnMaxLifetime(30 * time.Minute)
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func migrate(db *sql.DB) error {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version text PRIMARY KEY,
		applied_at timestamptz NOT NULL DEFAULT now()
	)`); err != nil {
		return err
	}
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".sql") {
			names = append(names, entry.Name())
		}
	}
	sort.Strings(names)
	for _, name := range names {
		version := strings.TrimSuffix(name, ".sql")
		var n int
		if err := db.QueryRow(`SELECT count(*) FROM schema_migrations WHERE version = $1`, version).Scan(&n); err != nil {
			return err
		}
		if n > 0 {
			continue
		}
		body, err := migrationFS.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(string(body)); err != nil {
			tx.Rollback()
			return fmt.Errorf("%s: %w", name, err)
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

func health(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := db.PingContext(r.Context()); err != nil {
			log.Println(err)
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "down"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

func writeQuery(w http.ResponseWriter, row *sql.Row) {
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		log.Println(err)
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	if raw == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(raw)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

type gzipWriter struct {
	http.ResponseWriter
	zw *gzip.Writer
}

// Write starts the gzip stream lazily so empty and pre-gzipped responses carry no extra bytes.
func (g *gzipWriter) Write(b []byte) (int, error) {
	if g.zw == nil {
		g.zw = gzip.NewWriter(g.ResponseWriter)
	}
	return g.zw.Write(b)
}

func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// The vendor catalog is several MB of JSON; gzip cuts it roughly tenfold.
func withGzip(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Add("Vary", "Accept-Encoding")
		gw := &gzipWriter{ResponseWriter: w}
		next.ServeHTTP(gw, r)
		if gw.zw != nil {
			gw.zw.Close()
		}
	})
}
