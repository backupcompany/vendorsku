package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"
)

type productIn struct {
	Name       string `json:"name"`
	Brand      string `json:"brand"`
	PartNumber string `json:"partNumber"`
	Spec       string `json:"spec"`
}

type productLinkIn struct {
	SkuID string `json:"skuId"`
}

const productDoc = `
	jsonb_build_object(
		'id', p.id,
		'vendorId', p.vendor_id,
		'name', p.name,
		'brand', p.brand,
		'partNumber', p.part_number,
		'spec', p.spec,
		'skuId', p.sku_id,
		'linkedSku', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
			'id', s.id,
			'erpCode', s.erp_code,
			'commodityName', s.commodity_name,
			'generalSpec', s.general_spec,
			'level1', s.level1,
			'uom', s.uom
		) END,
		'createdAt', p.created_at,
		'updatedAt', p.updated_at
	)`

func escapeLike(q string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q)
}

func normalizeProduct(in productIn) (productIn, string) {
	in.Name = strings.TrimSpace(in.Name)
	in.Brand = strings.TrimSpace(in.Brand)
	in.PartNumber = strings.TrimSpace(in.PartNumber)
	in.Spec = strings.TrimSpace(in.Spec)
	if in.Name == "" {
		return in, "Nama produk wajib diisi."
	}
	if utf8.RuneCountInString(in.Name) > 200 {
		return in, "Nama produk terlalu panjang."
	}
	return in, ""
}

func listVendorProducts(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT coalesce(jsonb_agg(`+productDoc+` ORDER BY p.updated_at DESC), '[]'::jsonb)
			FROM vendor_products p
			LEFT JOIN master_skus s ON s.id = p.sku_id
			WHERE p.vendor_id = $1
		`, r.PathValue("id")))
	}
}

func postVendorProduct(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in productIn
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Body tidak valid."})
			return
		}
		in, msg := normalizeProduct(in)
		if msg != "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg})
			return
		}
		id, err := newID("vp-")
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan produk."})
			return
		}
		vendorID := r.PathValue("id")
		_, err = db.ExecContext(r.Context(), `
			INSERT INTO vendor_products (id, vendor_id, name, brand, part_number, spec)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, id, vendorID, in.Name, in.Brand, in.PartNumber, in.Spec)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan produk."})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT `+productDoc+`
			FROM vendor_products p
			LEFT JOIN master_skus s ON s.id = p.sku_id
			WHERE p.id = $1 AND p.vendor_id = $2
		`, id, vendorID))
	}
}

func patchVendorProduct(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in productIn
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Body tidak valid."})
			return
		}
		in, msg := normalizeProduct(in)
		if msg != "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg})
			return
		}
		vendorID, productID := r.PathValue("id"), r.PathValue("productId")
		res, err := db.ExecContext(r.Context(), `
			UPDATE vendor_products
			SET name = $1, brand = $2, part_number = $3, spec = $4, updated_at = now()
			WHERE id = $5 AND vendor_id = $6
		`, in.Name, in.Brand, in.PartNumber, in.Spec, productID, vendorID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengubah produk."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Produk tidak ditemukan."})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT `+productDoc+`
			FROM vendor_products p
			LEFT JOIN master_skus s ON s.id = p.sku_id
			WHERE p.id = $1 AND p.vendor_id = $2
		`, productID, vendorID))
	}
}

func deleteVendorProduct(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), `
			DELETE FROM vendor_products WHERE id = $1 AND vendor_id = $2
		`, r.PathValue("productId"), r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus produk."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Produk tidak ditemukan."})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func linkVendorProduct(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in productLinkIn
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil || strings.TrimSpace(in.SkuID) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "skuId wajib diisi."})
			return
		}
		vendorID, productID := r.PathValue("id"), r.PathValue("productId")
		var open bool
		err := db.QueryRowContext(r.Context(), `
			SELECT `+openSkuFilter+` FROM master_skus WHERE id = $1
		`, in.SkuID).Scan(&open)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && !open) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "SKU RS tidak tersedia untuk dipasangkan."})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memeriksa SKU."})
			return
		}
		res, err := db.ExecContext(r.Context(), `
			UPDATE vendor_products
			SET sku_id = $1, updated_at = now()
			WHERE id = $2 AND vendor_id = $3
		`, in.SkuID, productID, vendorID)
		if err != nil {
			if strings.Contains(err.Error(), "vendor_products_vendor_sku_uidx") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "SKU ini sudah dipasangkan ke produk lain."})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memasangkan SKU."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Produk tidak ditemukan."})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT `+productDoc+`
			FROM vendor_products p
			LEFT JOIN master_skus s ON s.id = p.sku_id
			WHERE p.id = $1 AND p.vendor_id = $2
		`, productID, vendorID))
	}
}

func unlinkVendorProduct(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vendorID, productID := r.PathValue("id"), r.PathValue("productId")
		res, err := db.ExecContext(r.Context(), `
			UPDATE vendor_products SET sku_id = NULL, updated_at = now()
			WHERE id = $1 AND vendor_id = $2
		`, productID, vendorID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal melepas pairing."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Produk tidak ditemukan."})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT `+productDoc+`
			FROM vendor_products p
			LEFT JOIN master_skus s ON s.id = p.sku_id
			WHERE p.id = $1 AND p.vendor_id = $2
		`, productID, vendorID))
	}
}

func postVendorProductsBulk(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Items []productIn `json:"items"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Body tidak valid."})
			return
		}
		if len(body.Items) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Tidak ada baris produk."})
			return
		}
		if len(body.Items) > 50 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Maksimal 50 produk per unggah."})
			return
		}
		vendorID := r.PathValue("id")
		saved := make([]string, 0, len(body.Items))
		for _, raw := range body.Items {
			in, msg := normalizeProduct(raw)
			if msg != "" {
				continue
			}
			id, err := newID("vp-")
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan produk."})
				return
			}
			if _, err := db.ExecContext(r.Context(), `
				INSERT INTO vendor_products (id, vendor_id, name, brand, part_number, spec)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, id, vendorID, in.Name, in.Brand, in.PartNumber, in.Spec); err != nil {
				log.Println(err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan produk."})
				return
			}
			saved = append(saved, id)
		}
		if len(saved) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Tidak ada baris valid (nama wajib)."})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"saved": len(saved), "ids": saved})
	}
}

// suggestSKUsJSON ranks open master_skus by plain SQL text match — no AI.
// level1 (vendor business scope) boosts same-category SKUs; does not hard-filter.
// ponytail: token OR + score; upgrade to pg_trgm when catalog > ~50k rows.
func suggestSKUsJSON(ctx context.Context, db *sql.DB, q, brand, part, level1 string, limit int) ([]byte, error) {
	q = strings.Join(strings.Fields(q), " ")
	brand = strings.TrimSpace(brand)
	part = strings.TrimSpace(part)
	level1 = strings.TrimSpace(level1)
	if utf8.RuneCountInString(q) < 2 {
		return []byte("[]"), nil
	}
	if utf8.RuneCountInString(q) > 80 {
		q = string([]rune(q)[:80])
	}
	if utf8.RuneCountInString(brand) > 80 {
		brand = string([]rune(brand)[:80])
	}
	if utf8.RuneCountInString(part) > 80 {
		part = string([]rune(part)[:80])
	}
	if utf8.RuneCountInString(level1) > 120 {
		level1 = string([]rune(level1)[:120])
	}
	if limit < 1 {
		limit = 1
	}
	if limit > 8 {
		limit = 8
	}
	like := escapeLike(q)
	brandLike := escapeLike(brand)
	partLike := escapeLike(part)
	args := []any{like, brandLike, partLike, level1, limit}
	tokenOr := ""
	tokenScore := ""
	for _, tok := range strings.Fields(q) {
		if utf8.RuneCountInString(tok) < 2 {
			continue
		}
		if len(args) >= 9 { // $1..$5 fixed, up to 4 tokens
			break
		}
		args = append(args, escapeLike(tok))
		ns := strconv.Itoa(len(args))
		tokenOr += ` OR (commodity_name || ' ' || general_spec) ILIKE '%' || $` + ns + ` || '%'`
		tokenScore += ` + (CASE WHEN commodity_name ILIKE '%' || $` + ns + ` || '%' THEN 15 ELSE 0 END)`
		tokenScore += ` + (CASE WHEN general_spec ILIKE '%' || $` + ns + ` || '%' THEN 8 ELSE 0 END)`
	}
	var raw []byte
	err := db.QueryRowContext(ctx, `
		SELECT coalesce(jsonb_agg(jsonb_build_object(
			'id', id,
			'erpCode', erp_code,
			'commodityName', commodity_name,
			'generalSpec', general_spec,
			'level1', level1,
			'level2', level2,
			'uom', uom,
			'brand', default_brand,
			'partNumber', default_part_number,
			'rank', rank,
			'score', score
		) ORDER BY rank, score DESC, lower(commodity_name)), '[]'::jsonb)
		FROM (
			SELECT id, erp_code, commodity_name, general_spec, level1, level2, uom,
				default_brand, default_part_number,
				CASE
					WHEN lower(commodity_name) = lower($1) THEN 0
					WHEN commodity_name ILIKE $1 || '%' THEN 1
					WHEN commodity_name ILIKE '%' || $1 || '%' THEN 2
					ELSE 3
				END AS rank,
				(CASE WHEN commodity_name ILIKE $1 || '%' THEN 40 ELSE 0 END)
				+ (CASE WHEN commodity_name ILIKE '%' || $1 || '%' THEN 20 ELSE 0 END)
				+ (CASE WHEN general_spec ILIKE '%' || $1 || '%' THEN 10 ELSE 0 END)
				+ (CASE WHEN $2 <> '' AND coalesce(default_brand, '') ILIKE '%' || $2 || '%' THEN 25 ELSE 0 END)
				+ (CASE WHEN $3 <> '' AND coalesce(default_part_number, '') ILIKE '%' || $3 || '%' THEN 30 ELSE 0 END)
				+ (CASE WHEN $4 <> '' AND level1 = $4 THEN 35 ELSE 0 END)
				`+tokenScore+`
				AS score
			FROM master_skus
			WHERE `+openSkuFilter+`
			  AND (
				commodity_name ILIKE '%' || $1 || '%'
				OR general_spec ILIKE '%' || $1 || '%'
				`+tokenOr+`
				OR ($2 <> '' AND coalesce(default_brand, '') ILIKE '%' || $2 || '%')
				OR ($3 <> '' AND coalesce(default_part_number, '') ILIKE '%' || $3 || '%')
			  )
			ORDER BY 10, 11 DESC, lower(commodity_name)
			LIMIT $5
		) s
	`, args...).Scan(&raw)
	if err != nil {
		return nil, err
	}
	if raw == nil {
		return []byte("[]"), nil
	}
	return raw, nil
}

func productSuggest(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw, err := suggestSKUsJSON(r.Context(), db,
			r.URL.Query().Get("q"), r.URL.Query().Get("brand"), r.URL.Query().Get("part"),
			r.URL.Query().Get("level1"), 8)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Saran SKU gagal."})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(raw)
	}
}

// productMatchPreview: top-1 data match per unmatched product (max 50). No AI.
func productMatchPreview(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vendorID := r.PathValue("id")
		var scopeL1 string
		_ = db.QueryRowContext(r.Context(), `
			SELECT coalesce(nullif(trim(business_scope->>'level1'), ''), '')
			FROM vendors WHERE id = $1
		`, vendorID).Scan(&scopeL1)
		if l1 := strings.TrimSpace(r.URL.Query().Get("level1")); l1 != "" {
			scopeL1 = l1
		}

		rows, err := db.QueryContext(r.Context(), `
			SELECT id, name, brand, part_number, spec
			FROM vendor_products
			WHERE vendor_id = $1 AND sku_id IS NULL
			ORDER BY updated_at DESC
			LIMIT 50
		`, vendorID)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memuat produk."})
			return
		}
		defer rows.Close()

		type rowOut struct {
			ProductID   string          `json:"productId"`
			Name        string          `json:"name"`
			Brand       string          `json:"brand"`
			PartNumber  string          `json:"partNumber"`
			Top         json.RawMessage `json:"top"`
			HasMatch    bool            `json:"hasMatch"`
		}
		out := make([]rowOut, 0, 16)
		for rows.Next() {
			var id, name, brand, part, spec string
			if err := rows.Scan(&id, &name, &brand, &part, &spec); err != nil {
				log.Println(err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memuat produk."})
				return
			}
			q := name
			if spec != "" {
				q = name + " " + spec
			}
			raw, err := suggestSKUsJSON(r.Context(), db, q, brand, part, scopeL1, 1)
			if err != nil {
				log.Println(err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Saran SKU gagal."})
				return
			}
			has := len(raw) > 2 && string(raw) != "[]"
			var top json.RawMessage
			if has {
				var arr []json.RawMessage
				if json.Unmarshal(raw, &arr) == nil && len(arr) > 0 {
					top = arr[0]
				} else {
					has = false
				}
			}
			if top == nil {
				top = json.RawMessage("null")
			}
			out = append(out, rowOut{
				ProductID: id, Name: name, Brand: brand, PartNumber: part, Top: top, HasMatch: has,
			})
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func linkVendorProductsBatch(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Links []struct {
				ProductID string `json:"productId"`
				SkuID     string `json:"skuId"`
			} `json:"links"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Body tidak valid."})
			return
		}
		if len(body.Links) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Tidak ada pairing."})
			return
		}
		if len(body.Links) > 50 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Maksimal 50 pairing."})
			return
		}
		vendorID := r.PathValue("id")
		linked := 0
		for _, L := range body.Links {
			pid, sid := strings.TrimSpace(L.ProductID), strings.TrimSpace(L.SkuID)
			if pid == "" || sid == "" {
				continue
			}
			var open bool
			err := db.QueryRowContext(r.Context(), `SELECT `+openSkuFilter+` FROM master_skus WHERE id = $1`, sid).Scan(&open)
			if err != nil || !open {
				continue
			}
			res, err := db.ExecContext(r.Context(), `
				UPDATE vendor_products SET sku_id = $1, updated_at = now()
				WHERE id = $2 AND vendor_id = $3 AND sku_id IS NULL
			`, sid, pid, vendorID)
			if err != nil {
				continue
			}
			if n, _ := res.RowsAffected(); n > 0 {
				linked++
			}
		}
		writeJSON(w, http.StatusOK, map[string]int{"linked": linked})
	}
}
