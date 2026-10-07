package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"
)

const (
	proposalSource   = "vendor_proposal"
	proposalLevelPad = "VENDOR PROPOSAL"
	maxSpecRunes     = 20000
)

type proposalIn struct {
	CommodityName string `json:"commodityName"`
	GeneralSpec   string `json:"generalSpec"`
	Level1        string `json:"level1"`
	Uom           string `json:"uom"`
	Brand         string `json:"brand"`
	PartNumber    string `json:"partNumber"`
}

type proposalReviewIn struct {
	Decision      string `json:"decision"` // approve | reject
	CommodityName string `json:"commodityName"`
	GeneralSpec   string `json:"generalSpec"`
	Level1        string `json:"level1"`
	Level2        string `json:"level2"`
	Level3        string `json:"level3"`
	Level4        string `json:"level4"`
	Uom           string `json:"uom"`
}

const proposalSelect = `
	jsonb_build_object(
		'id', s.id,
		'erpCode', s.erp_code,
		'commodityName', s.commodity_name,
		'generalSpec', s.general_spec,
		'level1', s.level1,
		'level2', s.level2,
		'level3', s.level3,
		'level4', s.level4,
		'uom', s.uom,
		'brand', s.default_brand,
		'partNumber', s.default_part_number,
		'status', s.status,
		'source', s.source,
		'rawSpec', s.source_row->>'rawSpec',
		'vendorId', s.source_row->>'vendorId',
		'vendorName', s.source_row->>'vendorName',
		'submittedAt', s.source_row->>'submittedAt',
		'createdAt', s.created_at,
		'updatedAt', s.updated_at
	)`

// Vendor proposes a SKU that is not yet in the catalog. Stays pending_review until staff act.
func postSkuProposal(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vendorID := r.PathValue("id")
		var in proposalIn
		if !readForm(w, r, &in) {
			return
		}
		name := strings.TrimSpace(in.CommodityName)
		spec := strings.TrimSpace(in.GeneralSpec)
		level1 := strings.TrimSpace(in.Level1)
		uom := strings.TrimSpace(in.Uom)
		if name == "" || spec == "" || level1 == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Nama item, spesifikasi, dan kategori Level 1 wajib diisi."})
			return
		}
		if utf8.RuneCountInString(spec) > maxSpecRunes {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Spesifikasi terlalu panjang (maks 20.000 karakter)."})
			return
		}
		if uom == "" {
			uom = "Pcs"
		}
		var company string
		if err := db.QueryRowContext(r.Context(), `SELECT company_name FROM vendors WHERE id = $1`, vendorID).Scan(&company); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "Vendor tidak ditemukan."})
				return
			}
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan usulan SKU."})
			return
		}
		id, err := newID("sku-")
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan usulan SKU."})
			return
		}
		erp, err := newID("PROP-")
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan usulan SKU."})
			return
		}
		raw, err := json.Marshal(map[string]any{
			"vendorId":   vendorID,
			"vendorName": company,
			"rawSpec":    spec,
		})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan usulan SKU."})
			return
		}
		_, err = db.ExecContext(r.Context(), `
			INSERT INTO master_skus (
				id, erp_code, level1, level2, level3, level4,
				commodity_name, general_spec, default_brand, default_part_number,
				uom, is_open_for_vendor, is_active, status,
				source, source_row, is_uploaded, created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $4, $4,
				$5, $6, $7, $8,
				$9, false, false, 'pending_review',
				$10, jsonb_set($11::jsonb, '{submittedAt}', to_jsonb(now()::text)), false, now(), now()
			)
		`, id, erp, level1, proposalLevelPad, name, spec, optText(in.Brand), optText(in.PartNumber), uom, proposalSource, string(raw))
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan usulan SKU."})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `SELECT `+proposalSelect+` FROM master_skus s WHERE s.id = $1`, id))
	}
}

func listVendorSkuProposals(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT coalesce(jsonb_agg(doc ORDER BY created_at DESC), '[]'::jsonb)
			FROM (
				SELECT `+proposalSelect+` AS doc, s.created_at
				FROM master_skus s
				WHERE s.source = $1 AND s.source_row->>'vendorId' = $2
			) t
		`, proposalSource, r.PathValue("id")))
	}
}

func listStaffSkuProposals(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")
		if status == "" {
			status = "pending_review"
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT coalesce(jsonb_agg(doc ORDER BY created_at DESC), '[]'::jsonb)
			FROM (
				SELECT `+proposalSelect+` AS doc, s.created_at
				FROM master_skus s
				WHERE s.source = $1 AND s.status = $2
			) t
		`, proposalSource, status))
	}
}

func reviewSkuProposal(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var in proposalReviewIn
		if !readForm(w, r, &in) {
			return
		}
		decision := strings.ToLower(strings.TrimSpace(in.Decision))
		if decision != "approve" && decision != "reject" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "decision harus approve atau reject."})
			return
		}
		var status, source string
		err := db.QueryRowContext(r.Context(), `
			SELECT status, coalesce(source, '') FROM master_skus WHERE id = $1
		`, id).Scan(&status, &source)
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usulan SKU tidak ditemukan."})
			return
		}
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mereview usulan SKU."})
			return
		}
		if source != proposalSource || status != "pending_review" {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "SKU ini bukan usulan vendor yang menunggu review."})
			return
		}
		if decision == "reject" {
			_, err = db.ExecContext(r.Context(), `
				UPDATE master_skus SET status = 'archived', is_active = false, is_open_for_vendor = false, updated_at = now()
				WHERE id = $1
			`, id)
		} else {
			_, err = db.ExecContext(r.Context(), `
				UPDATE master_skus SET
					commodity_name = COALESCE(NULLIF(trim($2), ''), commodity_name),
					general_spec = COALESCE(NULLIF(trim($3), ''), general_spec),
					level1 = COALESCE(NULLIF(trim($4), ''), level1),
					level2 = COALESCE(NULLIF(trim($5), ''), level2),
					level3 = COALESCE(NULLIF(trim($6), ''), level3),
					level4 = COALESCE(NULLIF(trim($7), ''), level4),
					uom = COALESCE(NULLIF(trim($8), ''), uom),
					status = 'active',
					is_active = true,
					is_open_for_vendor = true,
					updated_at = now()
				WHERE id = $1
			`, id, in.CommodityName, in.GeneralSpec, in.Level1, in.Level2, in.Level3, in.Level4, in.Uom)
		}
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mereview usulan SKU."})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `SELECT `+proposalSelect+` FROM master_skus s WHERE s.id = $1`, id))
	}
}
