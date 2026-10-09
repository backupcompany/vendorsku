package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type productIn struct {
	Name           string  `json:"name"`
	Brand          string  `json:"brand"`
	PartNumber     string  `json:"partNumber"`
	Spec           string  `json:"spec"`
	UOM            string  `json:"uom"`
	IzinEdar       string  `json:"izinEdar"`
	IzinEdarUntil  string  `json:"izinEdarUntil"`
	LkppPrice      int64   `json:"lkppPrice"`
	LkppURL        string  `json:"lkppUrl"`
	PriceList      int64   `json:"priceList"`
	DiscountPct    float64 `json:"discountPct"`
	MOQ            int     `json:"moq"`
	LeadTimeDays   int     `json:"leadTimeDays"`
	PriceValidUntil string `json:"priceValidUntil"`
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
		'uom', p.uom,
		'izinEdar', p.izin_edar,
		'izinEdarUntil', p.izin_edar_until,
		'lkppPrice', p.lkpp_price,
		'lkppUrl', p.lkpp_url,
		'priceList', p.price_list,
		'discountPct', p.discount_pct,
		'nettPrice', CASE WHEN p.price_list > 0 THEN round(p.price_list::numeric * (1 - p.discount_pct / 100))::bigint ELSE 0 END,
		'moq', p.moq,
		'leadTimeDays', p.lead_time_days,
		'priceValidUntil', p.price_valid_until,
		'hasPhoto', (p.photo_data IS NOT NULL),
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
	in.UOM = strings.TrimSpace(in.UOM)
	in.IzinEdar = strings.TrimSpace(in.IzinEdar)
	in.IzinEdarUntil = strings.TrimSpace(in.IzinEdarUntil)
	in.LkppURL = strings.TrimSpace(in.LkppURL)
	in.PriceValidUntil = strings.TrimSpace(in.PriceValidUntil)
	if in.Name == "" {
		return in, "Nama produk wajib diisi."
	}
	if utf8.RuneCountInString(in.Name) > 200 {
		return in, "Nama produk terlalu panjang."
	}
	if in.DiscountPct < 0 || in.DiscountPct > 100 {
		return in, "Diskon harus 0–100%."
	}
	if in.PriceList < 0 || in.LkppPrice < 0 {
		return in, "Harga tidak boleh negatif."
	}
	if in.MOQ < 0 || in.LeadTimeDays < 0 {
		return in, "MOQ dan lead time tidak boleh negatif."
	}
	if in.MOQ == 0 {
		in.MOQ = 1
	}
	if in.LeadTimeDays == 0 {
		in.LeadTimeDays = 7
	}
	if in.LkppURL != "" {
		if !strings.HasPrefix(in.LkppURL, "http://") && !strings.HasPrefix(in.LkppURL, "https://") {
			return in, "URL LKPP harus diawali http:// atau https://."
		}
	}
	for _, d := range []struct{ label, v string }{{"Masa izin edar", in.IzinEdarUntil}, {"Masa berlaku harga", in.PriceValidUntil}} {
		if d.v == "" {
			continue
		}
		if _, err := time.Parse("2006-01-02", d.v); err != nil {
			return in, d.label + " harus format YYYY-MM-DD."
		}
	}
	return in, ""
}

func nullDate(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nullLkpp(n int64) any {
	if n <= 0 {
		return nil
	}
	return n
}

// syncProductOffer writes vendor_prices when product is linked and has a price list + brand.
func syncProductOffer(ctx context.Context, db *sql.DB, vendorID, skuID string, in productIn) {
	if skuID == "" || in.PriceList <= 0 || in.Brand == "" {
		return
	}
	validUntil := in.PriceValidUntil
	if validUntil == "" {
		validUntil = time.Now().AddDate(1, 0, 0).Format("2006-01-02")
	}
	var lkpp *int64
	if in.LkppPrice > 0 {
		v := in.LkppPrice
		lkpp = &v
	}
	_, _, _ = saveOffer(ctx, db, vendorID, offerForm{
		SkuID:           skuID,
		Brand:           in.Brand,
		PartNumber:      in.PartNumber,
		SpecDetail:      in.Spec,
		PriceList:       in.PriceList,
		Discount:        in.DiscountPct,
		LkppPrice:       lkpp,
		LinkLkpp:        in.LkppURL,
		UOM:             in.UOM,
		MOQ:             in.MOQ,
		LeadTimeDays:    in.LeadTimeDays,
		PriceValidUntil: validUntil,
		KemenkesLicense: in.IzinEdar,
	})
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
			INSERT INTO vendor_products (
				id, vendor_id, name, brand, part_number, spec, uom, izin_edar, izin_edar_until,
				lkpp_price, lkpp_url, price_list, discount_pct, moq, lead_time_days, price_valid_until
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		`, id, vendorID, in.Name, in.Brand, in.PartNumber, in.Spec, in.UOM, in.IzinEdar, nullDate(in.IzinEdarUntil),
			nullLkpp(in.LkppPrice), in.LkppURL, in.PriceList, in.DiscountPct, in.MOQ, in.LeadTimeDays, nullDate(in.PriceValidUntil))
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
			UPDATE vendor_products SET
				name = $1, brand = $2, part_number = $3, spec = $4, uom = $5,
				izin_edar = $6, izin_edar_until = $7, lkpp_price = $8, lkpp_url = $9,
				price_list = $10, discount_pct = $11, moq = $12, lead_time_days = $13,
				price_valid_until = $14, updated_at = now()
			WHERE id = $15 AND vendor_id = $16
		`, in.Name, in.Brand, in.PartNumber, in.Spec, in.UOM, in.IzinEdar, nullDate(in.IzinEdarUntil),
			nullLkpp(in.LkppPrice), in.LkppURL, in.PriceList, in.DiscountPct, in.MOQ, in.LeadTimeDays,
			nullDate(in.PriceValidUntil), productID, vendorID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengubah produk."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Produk tidak ditemukan."})
			return
		}
		var skuID string
		_ = db.QueryRowContext(r.Context(), `SELECT coalesce(sku_id, '') FROM vendor_products WHERE id = $1`, productID).Scan(&skuID)
		syncProductOffer(r.Context(), db, vendorID, skuID, in)
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
			SET sku_id = $1,
				uom = CASE WHEN trim(coalesce(uom, '')) = '' THEN coalesce((SELECT uom FROM master_skus WHERE id = $1), '') ELSE uom END,
				updated_at = now()
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
		var stored productIn
		var skuID string
		err = db.QueryRowContext(r.Context(), `
			SELECT name, brand, part_number, spec, uom, izin_edar, coalesce(izin_edar_until::text, ''),
				coalesce(lkpp_price, 0), lkpp_url, price_list, discount_pct, moq, lead_time_days,
				coalesce(price_valid_until::text, ''), coalesce(sku_id, '')
			FROM vendor_products WHERE id = $1 AND vendor_id = $2
		`, productID, vendorID).Scan(
			&stored.Name, &stored.Brand, &stored.PartNumber, &stored.Spec, &stored.UOM, &stored.IzinEdar, &stored.IzinEdarUntil,
			&stored.LkppPrice, &stored.LkppURL, &stored.PriceList, &stored.DiscountPct, &stored.MOQ, &stored.LeadTimeDays,
			&stored.PriceValidUntil, &skuID,
		)
		if err == nil {
			syncProductOffer(r.Context(), db, vendorID, skuID, stored)
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT `+productDoc+`
			FROM vendor_products p
			LEFT JOIN master_skus s ON s.id = p.sku_id
			WHERE p.id = $1 AND p.vendor_id = $2
		`, productID, vendorID))
	}
}

func postVendorProductPhoto(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Filename    string `json:"filename"`
			ContentType string `json:"contentType"`
			DataBase64  string `json:"dataBase64"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<20))
		if err := dec.Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Form tidak valid."})
			return
		}
		io.Copy(io.Discard, r.Body)
		filename := strings.TrimSpace(in.Filename)
		if filename == "" || len(filename) > 200 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Nama file wajib diisi."})
			return
		}
		raw := strings.TrimSpace(in.DataBase64)
		if i := strings.Index(raw, ","); strings.HasPrefix(raw, "data:") && i > 0 {
			raw = raw[i+1:]
		}
		data, err := base64.StdEncoding.DecodeString(raw)
		if err != nil {
			data, err = base64.RawStdEncoding.DecodeString(raw)
		}
		if err != nil || len(data) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Isi foto (base64) tidak valid."})
			return
		}
		kind, contentType, ok := sniffKind(data, in.ContentType)
		if !ok || kind != "photo" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Foto harus JPG, PNG, atau WEBP."})
			return
		}
		if len(data) > maxPhotoBytes {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Ukuran foto maks 2 MB."})
			return
		}
		vendorID, productID := r.PathValue("id"), r.PathValue("productId")
		res, err := db.ExecContext(r.Context(), `
			UPDATE vendor_products
			SET photo_filename = $1, photo_content_type = $2, photo_data = $3, updated_at = now()
			WHERE id = $4 AND vendor_id = $5
		`, filename, contentType, data, productID, vendorID)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan foto."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Produk tidak ditemukan."})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"hasPhoto": true, "filename": filename, "contentType": contentType, "byteSize": len(data)})
	}
}

func getVendorProductPhoto(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var contentType string
		var data []byte
		err := db.QueryRowContext(r.Context(), `
			SELECT photo_content_type, photo_data FROM vendor_products
			WHERE id = $1 AND vendor_id = $2 AND photo_data IS NOT NULL
		`, r.PathValue("productId"), r.PathValue("id")).Scan(&contentType, &data)
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Foto tidak ada."})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memuat foto."})
			return
		}
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Cache-Control", "private, max-age=300")
		w.Write(data)
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
				INSERT INTO vendor_products (id, vendor_id, name, brand, part_number, spec, uom)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`, id, vendorID, in.Name, in.Brand, in.PartNumber, in.Spec, in.UOM); err != nil {
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
