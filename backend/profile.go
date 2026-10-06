package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

type vendorPatch struct {
	CompanyName        *string         `json:"companyName"`
	Address            *string         `json:"address"`
	AuthorizedPerson   *string         `json:"authorizedPerson"`
	Email              *string         `json:"email"`
	Phone              *string         `json:"phone"`
	NPWP               *string         `json:"npwp"`
	BusinessScope      json.RawMessage `json:"businessScope"`
	CommercialTerms    json.RawMessage `json:"commercialTerms"`
	ErpVendorCode      *string         `json:"erpVendorCode"`
	IsExistingSupplier *bool           `json:"isExistingSupplier"`
	Status             *string         `json:"status"`
	Verified           *bool           `json:"verified"`
	Source             *string         `json:"source"`
	Notes              *string         `json:"notes"`
}

func patchVendor(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in vendorPatch
		if !readForm(w, r, &in) {
			return
		}
		if a, _ := actorFrom(r.Context()); a.Kind != "staff" && (in.ErpVendorCode != nil || in.IsExistingSupplier != nil ||
			in.Status != nil || in.Verified != nil || in.Source != nil || in.Notes != nil) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Status dan kode ERP hanya bisa diubah staf."})
			return
		}
		raw, code, msg := saveVendorProfile(r.Context(), db, r.PathValue("id"), in)
		if msg != "" {
			writeJSON(w, code, map[string]string{"error": msg})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		w.Write(raw)
	}
}

func saveVendorProfile(ctx context.Context, q dbx, vendorID string, in vendorPatch) ([]byte, int, string) {
	sets := []string{}
	args := []any{vendorID}

	add := func(expr string, val any) {
		args = append(args, val)
		sets = append(sets, strings.ReplaceAll(expr, "?", "$"+itoa(len(args))))
	}

	if in.CompanyName != nil {
		name := strings.TrimSpace(*in.CompanyName)
		if name == "" {
			return nil, http.StatusBadRequest, "Nama perusahaan wajib diisi."
		}
		add("company_name = ?", name)
	}
	if in.Address != nil {
		add("address = ?", strings.TrimSpace(*in.Address))
	}
	if in.NPWP != nil {
		npwp, ok := canonicalNPWP(*in.NPWP)
		if !ok {
			return nil, http.StatusBadRequest, "NPWP harus 15 atau 16 digit."
		}
		add("npwp = ?", npwp)
	}

	pic := map[string]any{}
	if in.Email != nil {
		email := strings.ToLower(strings.TrimSpace(*in.Email))
		if !validEmail(email) {
			return nil, http.StatusBadRequest, "Email PIC wajib diisi."
		}
		pic["email"] = email
	}
	if in.Phone != nil {
		phone := strings.TrimSpace(*in.Phone)
		if phone == "" {
			return nil, http.StatusBadRequest, "Nomor WhatsApp PIC wajib diisi."
		}
		pic["phone"] = phone
	}
	if in.AuthorizedPerson != nil {
		name := strings.TrimSpace(*in.AuthorizedPerson)
		if name == "" {
			pic["name"] = nil
		} else {
			pic["name"] = name
		}
	}
	if len(pic) > 0 {
		raw, err := json.Marshal(pic)
		if err != nil {
			return nil, http.StatusInternalServerError, "Gagal menyimpan profil."
		}
		add("pic = pic || ?::jsonb", raw)
	}

	if len(in.BusinessScope) > 0 && string(in.BusinessScope) != "null" {
		var scope struct {
			Level1     string   `json:"level1"`
			Level2List []string `json:"level2List"`
		}
		if err := json.Unmarshal(in.BusinessScope, &scope); err != nil || strings.TrimSpace(scope.Level1) == "" || scope.Level2List == nil {
			return nil, http.StatusBadRequest, "Lini bisnis wajib diisi."
		}
		scope.Level1 = strings.TrimSpace(scope.Level1)
		raw, err := json.Marshal(scope)
		if err != nil {
			return nil, http.StatusInternalServerError, "Gagal menyimpan profil."
		}
		add("business_scope = ?::jsonb", raw)
	}

	if len(in.CommercialTerms) > 0 && string(in.CommercialTerms) != "null" {
		add("commercial_terms = ?::jsonb", []byte(in.CommercialTerms))
	}
	if in.ErpVendorCode != nil {
		code := strings.TrimSpace(*in.ErpVendorCode)
		if code == "" {
			add("erp_vendor_code = ?", nil)
		} else {
			add("erp_vendor_code = ?", code)
		}
	}
	if in.IsExistingSupplier != nil {
		add("is_existing_supplier = ?", *in.IsExistingSupplier)
	}
	if in.Status != nil {
		switch *in.Status {
		case "prospect", "identified", "verified":
			add("status = ?", *in.Status)
		default:
			return nil, http.StatusBadRequest, "Status rekanan tidak dikenal."
		}
	}
	if in.Verified != nil {
		add("verified = ?", *in.Verified)
	}
	if in.Source != nil {
		switch *in.Source {
		case "erp_upload", "self_registered", "manual_admin":
			add("source = ?", *in.Source)
		default:
			return nil, http.StatusBadRequest, "Sumber rekanan tidak dikenal."
		}
	}
	if in.Notes != nil {
		add("notes = ?", strings.TrimSpace(*in.Notes))
	}

	if len(sets) == 0 {
		return nil, http.StatusBadRequest, "Tidak ada data yang diubah."
	}

	query := "UPDATE vendors SET " + strings.Join(sets, ", ") + " WHERE id = $1"
	res, err := q.ExecContext(ctx, query, args...)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			if pgErr.Code == "23505" {
				if strings.Contains(pgErr.ConstraintName, "npwp") {
					return nil, http.StatusConflict, "NPWP sudah dipakai rekanan lain."
				}
				if strings.Contains(pgErr.ConstraintName, "erp") {
					return nil, http.StatusConflict, "Kode ERP sudah dipakai rekanan lain."
				}
				return nil, http.StatusConflict, "Email PIC sudah dipakai rekanan lain."
			}
			if pgErr.Code == "23514" {
				return nil, http.StatusBadRequest, "Ketentuan komersial belum lengkap."
			}
		}
		log.Println(err)
		return nil, http.StatusInternalServerError, "Gagal menyimpan profil."
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, http.StatusNotFound, "Rekanan tidak ditemukan."
	}

	var doc []byte
	if err := q.QueryRowContext(ctx, `SELECT vendor_doc($1)`, vendorID).Scan(&doc); err != nil {
		log.Println(err)
		return nil, http.StatusInternalServerError, "Gagal menyimpan profil."
	}
	return doc, http.StatusOK, ""
}

func deleteVendor(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), `
			WITH gone AS (DELETE FROM sessions WHERE kind = 'vendor' AND actor_id = $1)
			DELETE FROM vendors WHERE id = $1
		`, r.PathValue("id"))
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus rekanan."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Rekanan tidak ditemukan."})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func itoa(n int) string {
	if n < 10 {
		return string(rune('0' + n))
	}
	return itoa(n/10) + string(rune('0'+n%10))
}
