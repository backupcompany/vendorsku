package main

import (
	"database/sql"
	"net/http"
	"strings"
	"unicode/utf8"
)

func likeEscape(q string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q)
}

// Staff procurement search across catalog name/spec/brand/part, AI layer, and brochure text.
func staffDiscoverySearch(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := strings.Join(strings.Fields(r.URL.Query().Get("q")), " ")
		if utf8.RuneCountInString(q) < 2 {
			writeJSON(w, http.StatusOK, []any{})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `
			WITH hits AS (
				SELECT s.id AS sku_id,
					CASE
						WHEN s.commodity_name ILIKE '%' || $1 || '%' THEN 'nama'
						WHEN coalesce(s.source_row->>'rawName','') ILIKE '%' || $1 || '%' THEN 'nama_raw'
						WHEN s.general_spec ILIKE '%' || $1 || '%' THEN 'spek'
						WHEN coalesce(s.source_row->>'rawSpec','') ILIKE '%' || $1 || '%' THEN 'spek_raw'
						WHEN coalesce(s.source_row->'ai'->>'generalSpec','') ILIKE '%' || $1 || '%' THEN 'spek_ai'
						WHEN coalesce(s.default_brand,'') ILIKE '%' || $1 || '%' THEN 'brand'
						WHEN coalesce(s.default_part_number,'') ILIKE '%' || $1 || '%' THEN 'part'
						ELSE 'katalog'
					END AS match_field,
					left(coalesce(
						NULLIF(s.source_row->>'rawSpec',''),
						NULLIF(s.source_row->'ai'->>'generalSpec',''),
						s.general_spec
					), 220) AS snippet,
					0 AS rank_boost
				FROM master_skus s
				WHERE (
					s.commodity_name ILIKE '%' || $1 || '%'
					OR s.general_spec ILIKE '%' || $1 || '%'
					OR coalesce(s.default_brand,'') ILIKE '%' || $1 || '%'
					OR coalesce(s.default_part_number,'') ILIKE '%' || $1 || '%'
					OR coalesce(s.source_row->>'rawSpec','') ILIKE '%' || $1 || '%'
					OR coalesce(s.source_row->>'rawName','') ILIKE '%' || $1 || '%'
					OR coalesce(s.source_row->'ai'->>'commodityName','') ILIKE '%' || $1 || '%'
					OR coalesce(s.source_row->'ai'->>'generalSpec','') ILIKE '%' || $1 || '%'
				)
				UNION ALL
				SELECT a.sku_id,
					'brosur' AS match_field,
					left(a.extracted_text, 220) AS snippet,
					1 AS rank_boost
				FROM sku_attachments a
				WHERE a.kind = 'brochure'
				  AND a.extracted_text <> ''
				  AND a.extracted_text ILIKE '%' || $1 || '%'
			),
			best AS (
				SELECT DISTINCT ON (sku_id) sku_id, match_field, snippet, rank_boost
				FROM hits
				ORDER BY sku_id, rank_boost DESC, match_field
			)
			SELECT coalesce(jsonb_agg(doc ORDER BY rank_boost DESC, commodity_name), '[]'::jsonb)
			FROM (
				SELECT
					jsonb_build_object(
						'skuId', s.id,
						'erpCode', s.erp_code,
						'commodityName', s.commodity_name,
						'generalSpec', s.general_spec,
						'rawName', coalesce(s.source_row->>'rawName', s.commodity_name),
						'rawSpec', s.source_row->>'rawSpec',
						'brand', s.default_brand,
						'partNumber', s.default_part_number,
						'level1', s.level1,
						'uom', s.uom,
						'status', s.status,
						'source', s.source,
						'matchField', b.match_field,
						'snippet', b.snippet,
						'vendor', CASE
							WHEN s.source = 'vendor_proposal' AND s.source_row->>'vendorId' IS NOT NULL THEN
								jsonb_build_object(
									'id', v.id,
									'companyName', coalesce(v.company_name, s.source_row->>'vendorName'),
									'email', v.pic->>'email',
									'phone', v.pic->>'phone',
									'status', v.status
								)
							WHEN ov.vendor_id IS NOT NULL THEN
								jsonb_build_object(
									'id', ov.vendor_id,
									'companyName', ov.company_name,
									'email', ov.email,
									'phone', ov.phone,
									'status', ov.vstatus
								)
							ELSE NULL
						END,
						'attachmentCount', (SELECT count(*)::int FROM sku_attachments a WHERE a.sku_id = s.id)
					) AS doc,
					b.rank_boost,
					s.commodity_name
				FROM best b
				JOIN master_skus s ON s.id = b.sku_id
				LEFT JOIN vendors v ON v.id = s.source_row->>'vendorId'
				LEFT JOIN LATERAL (
					SELECT p.vendor_id, ven.company_name, ven.pic->>'email' AS email, ven.pic->>'phone' AS phone, ven.status AS vstatus
					FROM vendor_prices p
					JOIN vendors ven ON ven.id = p.vendor_id
					WHERE p.sku_id = s.id
					ORDER BY p.updated_at DESC NULLS LAST
					LIMIT 1
				) ov ON true
				ORDER BY b.rank_boost DESC, s.commodity_name
				LIMIT 40
			) t
		`, likeEscape(q)))
	}
}
