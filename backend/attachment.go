package main

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	maxPhotoBytes   = 2 << 20 // 2 MiB
	maxBrochureBytes = 5 << 20 // 5 MiB
	maxPhotosPerSKU = 5
	maxBrochuresSKU = 3
	maxExtractRunes = 50000
)

type attachmentIn struct {
	Kind        string `json:"kind"` // photo | brochure
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	DataBase64  string `json:"dataBase64"`
}

func sniffKind(data []byte, claimed string) (kind, contentType string, ok bool) {
	claimed = strings.ToLower(strings.TrimSpace(claimed))
	if len(data) >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
		return "photo", "image/jpeg", true
	}
	if len(data) >= 8 && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
		return "photo", "image/png", true
	}
	if len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return "photo", "image/webp", true
	}
	if len(data) >= 5 && string(data[0:5]) == "%PDF-" {
		return "brochure", "application/pdf", true
	}
	_ = claimed
	return "", "", false
}

// Crude PDF text harvest (no OCR). Enough for searchable brochures that embed text.
// ponytail: ASCII/paren scrape only; real OCR/pdftotext when scan PDFs matter.
func extractPDFText(data []byte) string {
	var b strings.Builder
	i := 0
	for i < len(data) {
		if data[i] == '(' {
			i++
			start := i
			esc := false
			for i < len(data) {
				c := data[i]
				if esc {
					esc = false
					i++
					continue
				}
				if c == '\\' {
					esc = true
					i++
					continue
				}
				if c == ')' {
					chunk := string(data[start:i])
					if looksLikeText(chunk) {
						if b.Len() > 0 {
							b.WriteByte(' ')
						}
						b.WriteString(strings.TrimSpace(chunk))
						if utf8.RuneCountInString(b.String()) >= maxExtractRunes {
							return truncateRunes(b.String(), maxExtractRunes)
						}
					}
					i++
					break
				}
				i++
			}
			continue
		}
		i++
	}
	return truncateRunes(b.String(), maxExtractRunes)
}

func looksLikeText(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) < 4 || len(s) > 400 {
		return false
	}
	letters := 0
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsNumber(r) || unicode.IsSpace(r) || strings.ContainsRune(".,;:/%-+()", r) {
			letters++
		}
	}
	return letters*100/len([]byte(s)) >= 70
}

func truncateRunes(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	r := []rune(s)
	return string(r[:n])
}

func vendorOwnsProposal(r *http.Request, db *sql.DB, vendorID, skuID string) (int, string) {
	var source, owner string
	err := db.QueryRowContext(r.Context(), `
		SELECT coalesce(source,''), coalesce(source_row->>'vendorId','')
		FROM master_skus WHERE id = $1
	`, skuID).Scan(&source, &owner)
	if errors.Is(err, sql.ErrNoRows) {
		return http.StatusNotFound, "Usulan SKU tidak ditemukan."
	}
	if err != nil {
		log.Println(err)
		return http.StatusInternalServerError, "Gagal memeriksa usulan SKU."
	}
	if source != proposalSource || owner != vendorID {
		return http.StatusForbidden, "Usulan ini bukan milik vendor Anda."
	}
	return http.StatusOK, ""
}

func postSkuAttachment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vendorID := r.PathValue("id")
		skuID := r.PathValue("skuId")
		if code, msg := vendorOwnsProposal(r, db, vendorID, skuID); msg != "" {
			writeJSON(w, code, map[string]string{"error": msg})
			return
		}
		var in attachmentIn
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<20))
		if err := dec.Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Form tidak valid."})
			return
		}
		io.Copy(io.Discard, r.Body)
		kindWanted := strings.ToLower(strings.TrimSpace(in.Kind))
		if kindWanted != "photo" && kindWanted != "brochure" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "kind harus photo atau brochure."})
			return
		}
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
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Isi file (base64) tidak valid."})
			return
		}
		kind, contentType, sniffed := sniffKind(data, in.ContentType)
		if !sniffed || kind != kindWanted {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Tipe file tidak cocok. Foto: JPG/PNG/WEBP. Brosur: PDF."})
			return
		}
		max := maxPhotoBytes
		limitN := maxPhotosPerSKU
		if kind == "brochure" {
			max = maxBrochureBytes
			limitN = maxBrochuresSKU
		}
		if len(data) > max {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Ukuran file melebihi batas."})
			return
		}
		var n int
		if err := db.QueryRowContext(r.Context(), `
			SELECT count(*) FROM sku_attachments WHERE sku_id = $1 AND kind = $2
		`, skuID, kind).Scan(&n); err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan lampiran."})
			return
		}
		if n >= limitN {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Jumlah lampiran jenis ini sudah mencapai batas."})
			return
		}
		extracted := ""
		if kind == "brochure" {
			extracted = extractPDFText(data)
		}
		attID, err := newID("att-")
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan lampiran."})
			return
		}
		_, err = db.ExecContext(r.Context(), `
			INSERT INTO sku_attachments (id, sku_id, vendor_id, kind, filename, content_type, byte_size, data, extracted_text, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
		`, attID, skuID, vendorID, kind, filename, contentType, len(data), data, extracted)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan lampiran."})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id": attID, "skuId": skuID, "kind": kind, "filename": filename,
			"contentType": contentType, "byteSize": len(data),
			"hasExtractedText": extracted != "",
		})
	}
}

func listSkuAttachments(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vendorID := r.PathValue("id")
		skuID := r.PathValue("skuId")
		a, _ := actorFrom(r.Context())
		if a.Kind == "vendor" {
			if code, msg := vendorOwnsProposal(r, db, vendorID, skuID); msg != "" {
				writeJSON(w, code, map[string]string{"error": msg})
				return
			}
		} else if a.Kind != "staff" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akses ditolak."})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT coalesce(jsonb_agg(jsonb_build_object(
				'id', id, 'skuId', sku_id, 'vendorId', vendor_id, 'kind', kind,
				'filename', filename, 'contentType', content_type, 'byteSize', byte_size,
				'hasExtractedText', extracted_text <> '',
				'createdAt', created_at
			) ORDER BY created_at), '[]'::jsonb)
			FROM sku_attachments WHERE sku_id = $1
		`, skuID))
	}
}

func getSkuAttachment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		attID := r.PathValue("attId")
		a, ok := actorFrom(r.Context())
		if !ok {
			// guard() already set actor; if missing, sessionActor again
			var err error
			a, ok, err = sessionActor(r, db)
			if err != nil || !ok {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Sesi berakhir. Silakan masuk lagi."})
				return
			}
		}
		var vendorID, filename, contentType string
		var data []byte
		err := db.QueryRowContext(r.Context(), `
			SELECT vendor_id, filename, content_type, data FROM sku_attachments WHERE id = $1
		`, attID).Scan(&vendorID, &filename, &contentType, &data)
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Lampiran tidak ditemukan."})
			return
		}
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal membaca lampiran."})
			return
		}
		if a.Kind == "vendor" && a.ID != vendorID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akses ditolak."})
			return
		}
		if a.Kind != "vendor" && a.Kind != "staff" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akses ditolak."})
			return
		}
		if r.URL.Query().Get("meta") == "1" {
			writeJSON(w, http.StatusOK, map[string]any{
				"id": attID, "filename": filename, "contentType": contentType, "byteSize": len(data),
				"dataBase64": base64.StdEncoding.EncodeToString(data),
			})
			return
		}
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Content-Disposition", `inline; filename="`+strings.ReplaceAll(filename, `"`, "")+`"`)
		w.Header().Set("Cache-Control", "private, max-age=300")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
	}
}

func deleteSkuAttachment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vendorID := r.PathValue("id")
		skuID := r.PathValue("skuId")
		attID := r.PathValue("attId")
		if code, msg := vendorOwnsProposal(r, db, vendorID, skuID); msg != "" {
			writeJSON(w, code, map[string]string{"error": msg})
			return
		}
		res, err := db.ExecContext(r.Context(), `
			DELETE FROM sku_attachments WHERE id = $1 AND sku_id = $2 AND vendor_id = $3
		`, attID, skuID, vendorID)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus lampiran."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Lampiran tidak ditemukan."})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func listStaffSkuAttachments(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		skuID := r.PathValue("id")
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT coalesce(jsonb_agg(jsonb_build_object(
				'id', id, 'skuId', sku_id, 'vendorId', vendor_id, 'kind', kind,
				'filename', filename, 'contentType', content_type, 'byteSize', byte_size,
				'hasExtractedText', extracted_text <> '',
				'extractedTextPreview', left(extracted_text, 280),
				'createdAt', created_at
			) ORDER BY created_at), '[]'::jsonb)
			FROM sku_attachments WHERE sku_id = $1
		`, skuID))
	}
}
