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

type skuPatch struct {
	IsOpenForVendor *bool `json:"isOpenForVendor"`
	IsActive        *bool `json:"isActive"`
}

func patchSku(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in skuPatch
		if !readForm(w, r, &in) {
			return
		}
		if in.IsOpenForVendor == nil && in.IsActive == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Tidak ada status SKU yang diubah."})
			return
		}
		id := r.PathValue("id")
		res, err := db.ExecContext(r.Context(), `
			UPDATE master_skus SET
				is_open_for_vendor = COALESCE($2, is_open_for_vendor),
				is_active = COALESCE($3, is_active),
				status = CASE
					WHEN $3::bool IS NULL THEN status
					WHEN $3 THEN 'active'
					ELSE 'archived'
				END,
				updated_at = now()
			WHERE id = $1
		`, id, in.IsOpenForVendor, in.IsActive)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengubah SKU."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "SKU tidak ditemukan."})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `SELECT sku_core(s) FROM master_skus s WHERE id = $1`, id))
	}
}

func deleteSku(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), `DELETE FROM master_skus WHERE id = $1`, r.PathValue("id"))
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus SKU."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "SKU tidak ditemukan."})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

type skuIn struct {
	ID                string          `json:"id"`
	ErpCode           string          `json:"erpCode"`
	Level1            string          `json:"level1"`
	Level2            string          `json:"level2"`
	Level3            string          `json:"level3"`
	Level4            string          `json:"level4"`
	CommodityName     string          `json:"commodityName"`
	GeneralSpec       string          `json:"generalSpec"`
	DefaultBrand      string          `json:"defaultBrand"`
	DefaultPartNumber string          `json:"defaultPartNumber"`
	Uom               string          `json:"uom"`
	BenchmarkPrice    *json.Number    `json:"benchmarkPrice"`
	IsOpenForVendor   bool            `json:"isOpenForVendor"`
	Status            string          `json:"status"`
	DocumentType      string          `json:"documentType"`
	ItemID            string          `json:"itemId"`
	FaCategory        string          `json:"faCategory"`
	IsGenericProduct  bool            `json:"isGenericProduct"`
	IsContract        bool            `json:"isContract"`
	Spec1             string          `json:"spec1"`
	Spec2             string          `json:"spec2"`
	Spec3             string          `json:"spec3"`
	SpItemID          string          `json:"spItemId"`
	Source            string          `json:"source"`
	SourceRow         json.RawMessage `json:"sourceRow"`
}

func postSkus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Skus []skuIn `json:"skus"`
		}
		if !readForm(w, r, &in) {
			return
		}
		if len(in.Skus) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Tidak ada SKU yang diimpor."})
			return
		}
		ids, code, msg := upsertSkus(r.Context(), db, in.Skus)
		if msg != "" {
			writeJSON(w, code, map[string]string{"error": msg})
			return
		}
		writeJSON(w, http.StatusOK, map[string]int{"saved": len(ids)})
	}
}

type skuRow struct {
	ID                string          `json:"id"`
	ErpCode           string          `json:"erp_code"`
	Level1            string          `json:"level1"`
	Level2            string          `json:"level2"`
	Level3            string          `json:"level3"`
	Level4            string          `json:"level4"`
	CommodityName     string          `json:"commodity_name"`
	GeneralSpec       string          `json:"general_spec"`
	DefaultBrand      *string         `json:"default_brand"`
	DefaultPartNumber *string         `json:"default_part_number"`
	Uom               string          `json:"uom"`
	BenchmarkPrice    *json.Number    `json:"benchmark_price"`
	IsOpenForVendor   bool            `json:"is_open_for_vendor"`
	IsActive          bool            `json:"is_active"`
	Status            string          `json:"status"`
	DocumentType      *string         `json:"document_type"`
	ItemID            *string         `json:"item_id"`
	FaCategory        *string         `json:"fa_category"`
	IsGenericProduct  bool            `json:"is_generic_product"`
	IsContract        bool            `json:"is_contract"`
	Spec1             *string         `json:"spec1"`
	Spec2             *string         `json:"spec2"`
	Spec3             *string         `json:"spec3"`
	SpItemID          *string         `json:"sp_item_id"`
	Source            string          `json:"source"`
	SourceRow         json.RawMessage `json:"source_row,omitempty"`
}

func optText(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// upsertSkus writes the batch in one statement; a repeated erp code inside the batch keeps the last row.
func upsertSkus(ctx context.Context, q dbx, skus []skuIn) ([]string, int, string) {
	rows := make([]skuRow, 0, len(skus))
	at := map[string]int{}
	for _, sku := range skus {
		row := skuRow{
			ID: strings.TrimSpace(sku.ID), ErpCode: strings.TrimSpace(sku.ErpCode),
			Level1: strings.TrimSpace(sku.Level1), Level2: strings.TrimSpace(sku.Level2),
			Level3: strings.TrimSpace(sku.Level3), Level4: strings.TrimSpace(sku.Level4),
			CommodityName: strings.TrimSpace(sku.CommodityName), GeneralSpec: strings.TrimSpace(sku.GeneralSpec),
			DefaultBrand: optText(sku.DefaultBrand), DefaultPartNumber: optText(sku.DefaultPartNumber),
			Uom: strings.TrimSpace(sku.Uom), IsOpenForVendor: sku.IsOpenForVendor,
			IsActive: sku.Status != "archived", Status: sku.Status,
			DocumentType: optText(sku.DocumentType), ItemID: optText(sku.ItemID), FaCategory: optText(sku.FaCategory),
			IsGenericProduct: sku.IsGenericProduct, IsContract: sku.IsContract,
			Spec1: optText(sku.Spec1), Spec2: optText(sku.Spec2), Spec3: optText(sku.Spec3), SpItemID: optText(sku.SpItemID), Source: sku.Source,
		}
		if len(sku.SourceRow) > 0 && string(sku.SourceRow) != "null" {
			if sku.SourceRow[0] != '{' {
				return nil, http.StatusBadRequest, "Baris sumber ERP harus berupa objek."
			}
			row.SourceRow = sku.SourceRow
		}
		if row.ErpCode == "" || row.CommodityName == "" || row.GeneralSpec == "" || row.Uom == "" ||
			row.Level1 == "" || row.Level2 == "" || row.Level3 == "" || row.Level4 == "" {
			return nil, http.StatusBadRequest, "Kode ERP, nama, spesifikasi, kategori, dan satuan wajib diisi."
		}
		switch row.Status {
		case "active", "archived", "pending_review":
		default:
			return nil, http.StatusBadRequest, "Status SKU tidak dikenal."
		}
		if sku.BenchmarkPrice != nil {
			if strings.HasPrefix(sku.BenchmarkPrice.String(), "-") {
				return nil, http.StatusBadRequest, "Harga acuan tidak boleh minus."
			}
			row.BenchmarkPrice = sku.BenchmarkPrice
		}
		if row.ID == "" {
			made, err := newID("sku-")
			if err != nil {
				return nil, http.StatusInternalServerError, "Gagal menyimpan SKU."
			}
			row.ID = made
		}
		if row.Source == "" {
			row.Source = "erp_upload"
		}
		if i, seen := at[row.ErpCode]; seen {
			rows[i] = row
			continue
		}
		at[row.ErpCode] = len(rows)
		rows = append(rows, row)
	}
	body, err := json.Marshal(rows)
	if err != nil {
		return nil, http.StatusInternalServerError, "Gagal menyimpan SKU."
	}
	res, err := q.QueryContext(ctx, `
		INSERT INTO master_skus (
			id, erp_code, level1, level2, level3, level4,
			commodity_name, general_spec, default_brand, default_part_number,
			uom, benchmark_price, is_open_for_vendor, is_active, status,
			document_type, item_id, fa_category, is_generic_product, is_contract,
			spec1, spec2, spec3, sp_item_id, source_row, is_uploaded, source, created_at, updated_at
		)
		SELECT id, erp_code, level1, level2, level3, level4,
			commodity_name, general_spec, default_brand, default_part_number,
			uom, benchmark_price, is_open_for_vendor, is_active, status,
			document_type, item_id, fa_category, is_generic_product, is_contract,
			spec1, spec2, spec3, sp_item_id, source_row, true, source, now(), now()
		FROM jsonb_populate_recordset(NULL::master_skus, $1::jsonb)
		ON CONFLICT (erp_code) DO UPDATE SET
			level1 = EXCLUDED.level1,
			level2 = EXCLUDED.level2,
			level3 = EXCLUDED.level3,
			level4 = EXCLUDED.level4,
			commodity_name = EXCLUDED.commodity_name,
			general_spec = EXCLUDED.general_spec,
			default_brand = EXCLUDED.default_brand,
			default_part_number = EXCLUDED.default_part_number,
			uom = EXCLUDED.uom,
			benchmark_price = EXCLUDED.benchmark_price,
			is_open_for_vendor = EXCLUDED.is_open_for_vendor,
			is_active = EXCLUDED.is_active,
			status = EXCLUDED.status,
			document_type = EXCLUDED.document_type,
			item_id = EXCLUDED.item_id,
			fa_category = EXCLUDED.fa_category,
			is_generic_product = EXCLUDED.is_generic_product,
			is_contract = EXCLUDED.is_contract,
			spec1 = EXCLUDED.spec1,
			spec2 = EXCLUDED.spec2,
			spec3 = EXCLUDED.spec3,
			sp_item_id = EXCLUDED.sp_item_id,
			source_row = EXCLUDED.source_row,
			is_uploaded = true,
			source = EXCLUDED.source,
			updated_at = now()
		RETURNING id
	`, string(body))
	if err != nil {
		return skuWriteFail(err)
	}
	defer res.Close()
	ids := make([]string, 0, len(rows))
	for res.Next() {
		var id string
		if err := res.Scan(&id); err != nil {
			return skuWriteFail(err)
		}
		ids = append(ids, id)
	}
	if err := res.Err(); err != nil {
		return skuWriteFail(err)
	}
	return ids, http.StatusOK, ""
}

func skuWriteFail(err error) ([]string, int, string) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return nil, http.StatusConflict, "ID SKU sudah dipakai SKU lain."
	}
	log.Println(err)
	return nil, http.StatusInternalServerError, "Gagal menyimpan SKU."
}

// deleteSkus clears seed rows (scope=seed) or the whole catalog (scope=all); prices cascade with their SKU.
func deleteSkus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := `DELETE FROM master_skus WHERE NOT is_uploaded`
		switch r.URL.Query().Get("scope") {
		case "seed":
		case "all":
			query = `DELETE FROM master_skus`
		default:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Pilih scope seed atau all."})
			return
		}
		res, err := db.ExecContext(r.Context(), query)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus SKU."})
			return
		}
		n, _ := res.RowsAffected()
		writeJSON(w, http.StatusOK, map[string]int64{"deleted": n})
	}
}

func patchSkus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			IDs []string `json:"ids"`
			skuPatch
		}
		if !readForm(w, r, &in) {
			return
		}
		if len(in.IDs) == 0 || (in.IsOpenForVendor == nil && in.IsActive == nil) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Pilih SKU dan status yang diubah."})
			return
		}
		res, err := db.ExecContext(r.Context(), `
			UPDATE master_skus SET
				is_open_for_vendor = COALESCE($2, is_open_for_vendor),
				is_active = COALESCE($3, is_active),
				status = CASE
					WHEN $3::bool IS NULL THEN status
					WHEN $3 THEN 'active'
					ELSE 'archived'
				END,
				updated_at = now()
			WHERE id = ANY($1)
		`, in.IDs, in.IsOpenForVendor, in.IsActive)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengubah SKU."})
			return
		}
		n, _ := res.RowsAffected()
		writeJSON(w, http.StatusOK, map[string]int64{"updated": n})
	}
}

func postDeleteSkus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			IDs []string `json:"ids"`
		}
		if !readForm(w, r, &in) {
			return
		}
		if len(in.IDs) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Pilih SKU yang dihapus."})
			return
		}
		res, err := db.ExecContext(r.Context(), `DELETE FROM master_skus WHERE id = ANY($1)`, in.IDs)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus SKU."})
			return
		}
		n, _ := res.RowsAffected()
		writeJSON(w, http.StatusOK, map[string]int64{"deleted": n})
	}
}

// Landing page reads: open, active SKUs only, never prices.
const openSkuFilter = `is_open_for_vendor AND is_active AND status <> 'archived'`

// skuTaxonomy reads the open catalog once; Level 2 counts and example names come from the same grouping.
const skuTaxonomy = `
	WITH g AS (
		SELECT level1, level2, commodity_name, count(*) AS n FROM master_skus WHERE ` + openSkuFilter + ` GROUP BY 1, 2, 3
	), l2 AS (
		SELECT level1, level2, sum(n)::int AS n FROM g GROUP BY 1, 2
	), l1 AS (
		SELECT level1, sum(n)::int AS n, jsonb_agg(jsonb_build_object('name', level2, 'count', n) ORDER BY n DESC, level2) AS level2
		FROM l2 GROUP BY 1
	), ex AS (
		SELECT level1, commodity_name, row_number() OVER (PARTITION BY level1 ORDER BY sum(n) DESC, commodity_name) AS rank
		FROM g GROUP BY 1, 2
	), top AS (
		SELECT level1, jsonb_agg(commodity_name ORDER BY rank) AS examples FROM ex WHERE rank <= 4 GROUP BY 1
	)
	SELECT coalesce(jsonb_agg(jsonb_build_object(
		'level1', l1.level1, 'count', l1.n, 'level2', l1.level2, 'examples', coalesce(top.examples, '[]'::jsonb)
	) ORDER BY l1.n DESC), '[]'::jsonb)
	FROM l1 LEFT JOIN top USING (level1)
`

func skuSearch(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := strings.Join(strings.Fields(r.URL.Query().Get("q")), " ")
		if len([]rune(q)) < 2 {
			writeJSON(w, http.StatusOK, []any{})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT coalesce(jsonb_agg(jsonb_build_object(
				'commodityName', commodity_name, 'generalSpec', general_spec,
				'level1', level1, 'level2', level2, 'level3', level3
			)), '[]'::jsonb)
			FROM (
				SELECT * FROM (
					SELECT DISTINCT ON (lower(commodity_name)) commodity_name, general_spec, level1, level2, level3,
						CASE
							WHEN commodity_name ILIKE $1 || '%' THEN 0
							WHEN commodity_name ILIKE '%' || $1 || '%' THEN 1
							ELSE 2
						END AS rank
					FROM master_skus
					WHERE `+openSkuFilter+`
					  AND (commodity_name || ' ' || general_spec || ' ' || level2 || ' ' || level3) ILIKE '%' || $1 || '%'
					ORDER BY lower(commodity_name), 6
				) d
				ORDER BY rank, lower(commodity_name)
				LIMIT 8
			) s
		`, strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q)))
	}
}
