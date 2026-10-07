package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"
)

const (
	proposalSource     = "vendor_proposal"
	proposalLevelPad   = "VENDOR PROPOSAL"
	maxSpecRunes       = 20000
	maxProposalsBatch  = 200
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
		'rawName', coalesce(s.source_row->>'rawName', s.commodity_name),
		'vendorId', s.source_row->>'vendorId',
		'vendorName', s.source_row->>'vendorName',
		'submittedAt', s.source_row->>'submittedAt',
		'ai', s.source_row->'ai',
		'createdAt', s.created_at,
		'updatedAt', s.updated_at,
		'attachmentCount', (SELECT count(*)::int FROM sku_attachments a WHERE a.sku_id = s.id)
	)`

func normalizeProposal(in proposalIn) (proposalIn, string) {
	in.CommodityName = strings.TrimSpace(in.CommodityName)
	in.GeneralSpec = strings.TrimSpace(in.GeneralSpec)
	in.Level1 = strings.TrimSpace(in.Level1)
	in.Uom = strings.TrimSpace(in.Uom)
	in.Brand = strings.TrimSpace(in.Brand)
	in.PartNumber = strings.TrimSpace(in.PartNumber)
	if in.CommodityName == "" || in.GeneralSpec == "" || in.Level1 == "" {
		return in, "Nama item, spesifikasi, dan kategori Level 1 wajib diisi."
	}
	if utf8.RuneCountInString(in.GeneralSpec) > maxSpecRunes {
		return in, "Spesifikasi terlalu panjang (maks 20.000 karakter)."
	}
	if in.Uom == "" {
		in.Uom = "Pcs"
	}
	return in, ""
}

func insertSkuProposal(ctx context.Context, q dbx, vendorID, company string, in proposalIn) (string, int, string) {
	in, msg := normalizeProposal(in)
	if msg != "" {
		return "", http.StatusBadRequest, msg
	}
	id, err := newID("sku-")
	if err != nil {
		return "", http.StatusInternalServerError, "Gagal menyimpan usulan SKU."
	}
	erp, err := newID("PROP-")
	if err != nil {
		return "", http.StatusInternalServerError, "Gagal menyimpan usulan SKU."
	}
	raw, err := json.Marshal(map[string]any{
		"vendorId":   vendorID,
		"vendorName": company,
		"rawSpec":    in.GeneralSpec,
	})
	if err != nil {
		return "", http.StatusInternalServerError, "Gagal menyimpan usulan SKU."
	}
	_, err = q.ExecContext(ctx, `
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
	`, id, erp, in.Level1, proposalLevelPad, in.CommodityName, in.GeneralSpec,
		optText(in.Brand), optText(in.PartNumber), in.Uom, proposalSource, string(raw))
	if err != nil {
		log.Println(err)
		return "", http.StatusInternalServerError, "Gagal menyimpan usulan SKU."
	}
	return id, http.StatusOK, ""
}

func vendorCompany(ctx context.Context, db *sql.DB, vendorID string) (string, int, string) {
	var company string
	if err := db.QueryRowContext(ctx, `SELECT company_name FROM vendors WHERE id = $1`, vendorID).Scan(&company); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", http.StatusNotFound, "Vendor tidak ditemukan."
		}
		log.Println(err)
		return "", http.StatusInternalServerError, "Gagal menyimpan usulan SKU."
	}
	return company, http.StatusOK, ""
}

// Vendor proposes a SKU that is not yet in the catalog. Stays pending_review until staff act.
func postSkuProposal(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vendorID := r.PathValue("id")
		var in proposalIn
		if !readForm(w, r, &in) {
			return
		}
		company, code, msg := vendorCompany(r.Context(), db, vendorID)
		if msg != "" {
			writeJSON(w, code, map[string]string{"error": msg})
			return
		}
		id, code, msg := insertSkuProposal(r.Context(), db, vendorID, company, in)
		if msg != "" {
			writeJSON(w, code, map[string]string{"error": msg})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `SELECT `+proposalSelect+` FROM master_skus s WHERE s.id = $1`, id))
	}
}

func postSkuProposalsBulk(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vendorID := r.PathValue("id")
		var in struct {
			Proposals []proposalIn `json:"proposals"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<20))
		if err := dec.Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Form tidak valid."})
			return
		}
		io.Copy(io.Discard, r.Body)
		if len(in.Proposals) == 0 || len(in.Proposals) > maxProposalsBatch {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("Kirim 1 sampai %d usulan produk per batch.", maxProposalsBatch),
			})
			return
		}
		company, code, msg := vendorCompany(r.Context(), db, vendorID)
		if msg != "" {
			writeJSON(w, code, map[string]string{"error": msg})
			return
		}
		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan usulan SKU."})
			return
		}
		defer tx.Rollback()
		ids := make([]string, 0, len(in.Proposals))
		for i, p := range in.Proposals {
			id, code, msg := insertSkuProposal(r.Context(), tx, vendorID, company, p)
			if msg != "" {
				writeJSON(w, code, map[string]string{"error": fmt.Sprintf("Baris %d: %s", i+1, msg)})
				return
			}
			ids = append(ids, id)
		}
		if err := tx.Commit(); err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan usulan SKU."})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"saved": len(ids), "ids": ids})
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

type proposalAIIn struct {
	CommodityName string         `json:"commodityName"`
	GeneralSpec   string         `json:"generalSpec"`
	Level1        string         `json:"level1"`
	Level2        string         `json:"level2"`
	Level3        string         `json:"level3"`
	Level4        string         `json:"level4"`
	Attributes    map[string]any `json:"attributes"`
	Model         string         `json:"model"`
}

// Staff saves AI standardization into source_row.ai without overwriting vendor rawSpec/rawName.
func saveSkuProposalAI(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var in proposalAIIn
		if !readForm(w, r, &in) {
			return
		}
		name := strings.TrimSpace(in.CommodityName)
		spec := strings.TrimSpace(in.GeneralSpec)
		if name == "" || spec == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Hasil AI: nama dan spesifikasi wajib diisi."})
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
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan hasil AI."})
			return
		}
		if source != proposalSource || status != "pending_review" {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "SKU ini bukan usulan vendor yang menunggu review."})
			return
		}
		aiDoc := map[string]any{
			"commodityName": name,
			"generalSpec":   spec,
			"level1":        strings.TrimSpace(in.Level1),
			"level2":        strings.TrimSpace(in.Level2),
			"level3":        strings.TrimSpace(in.Level3),
			"level4":        strings.TrimSpace(in.Level4),
			"attributes":    in.Attributes,
			"model":         strings.TrimSpace(in.Model),
		}
		if aiDoc["attributes"] == nil {
			aiDoc["attributes"] = map[string]any{}
		}
		raw, err := json.Marshal(aiDoc)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan hasil AI."})
			return
		}
		_, err = db.ExecContext(r.Context(), `
			UPDATE master_skus SET
				source_row = (coalesce(source_row, '{}'::jsonb)
					|| jsonb_build_object('rawName', coalesce(source_row->>'rawName', commodity_name))
					|| jsonb_build_object('ai', $2::jsonb || jsonb_build_object('standardizedAt', now()::text))),
				updated_at = now()
			WHERE id = $1
		`, id, string(raw))
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan hasil AI."})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `SELECT `+proposalSelect+` FROM master_skus s WHERE s.id = $1`, id))
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
