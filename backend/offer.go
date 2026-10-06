package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type offerForm struct {
	SkuID           string   `json:"skuId"`
	Brand           string   `json:"vendorBrand"`
	PartNumber      string   `json:"vendorPartNumber"`
	SpecDetail      string   `json:"vendorSpecDetail"`
	PriceList       int64    `json:"priceListExcludeVat"`
	Discount        float64  `json:"discountPercent"`
	Tax             float64  `json:"taxPercent"`
	LkppPrice       *int64   `json:"lkppPrice"`
	LinkLkpp        string   `json:"linkLkppPrice"`
	UOM             string   `json:"uom"`
	MOQ             int      `json:"moq"`
	LeadTimeDays    int      `json:"leadTimeDays"`
	PriceValidUntil string   `json:"priceValidUntil"`
	Hospitals       []string `json:"installedHospitals"`
	KemenkesLicense string   `json:"kemenkesLicense"`
	CountryOfOrigin string   `json:"countryOfOrigin"`
	WarrantyPeriod  string   `json:"warrantyPeriod"`
	AdditionalNotes string   `json:"additionalNotes"`
}

func postOffer(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in offerForm
		if !readForm(w, r, &in) {
			return
		}
		raw, code, msg := saveOffer(r.Context(), db, r.PathValue("id"), in)
		if msg != "" {
			writeJSON(w, code, map[string]string{"error": msg})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(raw)
	}
}

const maxOffersPerBatch = 1000

func postOffers(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Offers []offerForm `json:"offers"`
		}
		if !readForm(w, r, &in) {
			return
		}
		if len(in.Offers) == 0 || len(in.Offers) > maxOffersPerBatch {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("Kirim 1 sampai %d penawaran per batch.", maxOffersPerBatch)})
			return
		}
		raw, _, code, msg := saveOffers(r.Context(), db, r.PathValue("id"), in.Offers)
		if msg != "" {
			writeJSON(w, code, map[string]string{"error": msg})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(raw)
	}
}

func deleteOffer(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), `
			DELETE FROM vendor_prices WHERE id = $1 AND vendor_id = $2
		`, r.PathValue("offerId"), r.PathValue("id"))
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus penawaran."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Penawaran tidak ditemukan."})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

type offerRow struct {
	ID         string   `json:"id"`
	SkuID      string   `json:"sku_id"`
	Brand      string   `json:"brand"`
	Part       string   `json:"part"`
	SpecDetail any      `json:"spec_detail"`
	LkppPrice  *int64   `json:"lkpp_price"`
	LinkLkpp   any      `json:"link_lkpp"`
	PriceList  int64    `json:"price_list"`
	Discount   float64  `json:"discount"`
	Nett       int64    `json:"nett"`
	Tax        float64  `json:"tax"`
	WithTax    int64    `json:"with_tax"`
	UOM        any      `json:"uom"`
	MOQ        int      `json:"moq"`
	LeadTime   int      `json:"lead_time"`
	ValidUntil string   `json:"valid_until"`
	Hospitals  []string `json:"hospitals"`
	Kemenkes   any      `json:"kemenkes"`
	Country    any      `json:"country"`
	Warranty   any      `json:"warranty"`
	Notes      any      `json:"notes"`
}

func offerRowOf(in offerForm) (offerRow, string) {
	brand := strings.TrimSpace(in.Brand)
	if brand == "" {
		return offerRow{}, "Nama Brand/Merk wajib diisi oleh vendor."
	}
	if in.PriceList <= 0 {
		return offerRow{}, "Harga price list wajib diisi."
	}
	if in.Discount < 0 || in.Discount > 100 {
		return offerRow{}, "Diskon harus di antara 0 dan 100."
	}
	if in.LeadTimeDays < 0 || in.MOQ < 0 {
		return offerRow{}, "MOQ dan lead time tidak boleh negatif."
	}
	validUntil, err := time.Parse("2006-01-02", dateOnly(in.PriceValidUntil))
	if err != nil {
		return offerRow{}, "Masa berlaku harga tidak valid."
	}
	if link := strings.TrimSpace(in.LinkLkpp); link != "" {
		u, err := url.Parse(link)
		if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
			return offerRow{}, "Link LKPP harus alamat web lengkap (https://...)."
		}
	}
	id, err := newID("sub-")
	if err != nil {
		return offerRow{}, "Gagal menyimpan penawaran."
	}
	part := strings.TrimSpace(in.PartNumber)
	if part == "" {
		part = "-"
	}
	tax := in.Tax
	if tax == 0 {
		tax = 11
	}
	moq := in.MOQ
	if moq == 0 {
		moq = 1
	}
	if in.Hospitals == nil {
		in.Hospitals = []string{}
	}
	nett := int64(math.Round(float64(in.PriceList) * (1 - in.Discount/100)))
	return offerRow{
		ID: id, SkuID: strings.TrimSpace(in.SkuID), Brand: brand, Part: part,
		SpecDetail: emptyNil(in.SpecDetail), LkppPrice: in.LkppPrice, LinkLkpp: emptyNil(in.LinkLkpp),
		PriceList: in.PriceList, Discount: in.Discount, Nett: nett, Tax: tax,
		WithTax: int64(math.Round(float64(nett) * (1 + tax/100))),
		UOM:     emptyNil(in.UOM), MOQ: moq, LeadTime: in.LeadTimeDays, ValidUntil: validUntil.Format("2006-01-02"),
		Hospitals: in.Hospitals, Kemenkes: emptyNil(in.KemenkesLicense), Country: emptyNil(in.CountryOfOrigin),
		Warranty: emptyNil(in.WarrantyPeriod), Notes: emptyNil(in.AdditionalNotes),
	}, ""
}

func saveOffer(ctx context.Context, q dbx, vendorID string, in offerForm) ([]byte, int, string) {
	raw, missing, code, msg := saveOffers(ctx, q, vendorID, []offerForm{in})
	if msg != "" {
		if missing {
			return nil, http.StatusNotFound, "SKU tidak ditemukan."
		}
		if code == http.StatusConflict {
			return nil, http.StatusBadRequest, "SKU ini belum dibuka untuk rekanan."
		}
		return nil, code, msg
	}
	var docs []json.RawMessage
	if err := json.Unmarshal(raw, &docs); err != nil || len(docs) != 1 {
		return nil, http.StatusInternalServerError, "Gagal menyimpan penawaran."
	}
	return docs[0], http.StatusOK, ""
}

// saveOffers writes the whole batch in one statement; any closed or unknown SKU rejects the batch.
func saveOffers(ctx context.Context, q dbx, vendorID string, offers []offerForm) ([]byte, bool, int, string) {
	rows := make([]offerRow, 0, len(offers))
	at := map[string]int{}
	for i, in := range offers {
		row, msg := offerRowOf(in)
		if msg != "" {
			if len(offers) > 1 {
				msg = fmt.Sprintf("Penawaran ke-%d: %s", i+1, msg)
			}
			return nil, false, http.StatusBadRequest, msg
		}
		if j, seen := at[row.SkuID]; seen {
			rows[j] = row
			continue
		}
		at[row.SkuID] = len(rows)
		rows = append(rows, row)
	}
	body, err := json.Marshal(rows)
	if err != nil {
		return nil, false, http.StatusInternalServerError, "Gagal menyimpan penawaran."
	}
	var saved []byte
	var bad []byte
	var missing bool
	err = q.QueryRowContext(ctx, `
		WITH input AS (
			SELECT * FROM jsonb_to_recordset($2::jsonb) AS x(
				id text, sku_id text, brand text, part text, spec_detail text, lkpp_price bigint, link_lkpp text,
				price_list bigint, discount numeric, nett bigint, tax numeric, with_tax bigint, uom text,
				moq int, lead_time int, valid_until date, hospitals text[],
				kemenkes text, country text, warranty text, notes text
			)
		), bad AS (
			SELECT i.sku_id, s.id IS NULL AS missing
			FROM input i
			LEFT JOIN master_skus s ON s.id = i.sku_id
			WHERE s.id IS NULL OR NOT s.is_open_for_vendor OR s.status = 'archived'
		), saved AS (
			INSERT INTO vendor_prices (
				id, sku_id, sku_erp_code, vendor_id,
				commodity_name, general_spec, vendor_brand, vendor_part_number, full_formatted_sku_name,
				vendor_spec_detail, lkpp_price, link_lkpp_price,
				price_list_exclude_vat, discount_percent, nett_price_exclude_vat, unit_price,
				tax_percent, price_with_tax, uom, moq, lead_time_days, price_valid_until,
				installed_hospitals, kemenkes_license, country_of_origin, warranty_period, additional_notes,
				status, submitted_at, updated_at
			)
			SELECT i.id, s.id, s.erp_code, $1,
				s.commodity_name, s.general_spec, i.brand, i.part,
				s.commodity_name || ' ; ' || s.general_spec || ' ; ' || i.brand || ' ; ' || i.part,
				i.spec_detail, i.lkpp_price, i.link_lkpp,
				i.price_list, i.discount, i.nett, i.nett,
				i.tax, i.with_tax, coalesce(i.uom, s.uom), i.moq, i.lead_time, i.valid_until,
				i.hospitals, i.kemenkes, i.country, i.warranty, i.notes,
				'submitted', now(), now()
			FROM input i
			JOIN master_skus s ON s.id = i.sku_id
			WHERE NOT EXISTS (SELECT 1 FROM bad)
			ON CONFLICT (vendor_id, sku_id) DO UPDATE SET
				sku_erp_code = EXCLUDED.sku_erp_code,
				commodity_name = EXCLUDED.commodity_name,
				general_spec = EXCLUDED.general_spec,
				vendor_brand = EXCLUDED.vendor_brand,
				vendor_part_number = EXCLUDED.vendor_part_number,
				full_formatted_sku_name = EXCLUDED.full_formatted_sku_name,
				vendor_spec_detail = EXCLUDED.vendor_spec_detail,
				lkpp_price = EXCLUDED.lkpp_price,
				link_lkpp_price = EXCLUDED.link_lkpp_price,
				price_list_exclude_vat = EXCLUDED.price_list_exclude_vat,
				discount_percent = EXCLUDED.discount_percent,
				nett_price_exclude_vat = EXCLUDED.nett_price_exclude_vat,
				unit_price = EXCLUDED.unit_price,
				tax_percent = EXCLUDED.tax_percent,
				price_with_tax = EXCLUDED.price_with_tax,
				uom = EXCLUDED.uom,
				moq = EXCLUDED.moq,
				lead_time_days = EXCLUDED.lead_time_days,
				price_valid_until = EXCLUDED.price_valid_until,
				installed_hospitals = EXCLUDED.installed_hospitals,
				kemenkes_license = EXCLUDED.kemenkes_license,
				country_of_origin = EXCLUDED.country_of_origin,
				warranty_period = EXCLUDED.warranty_period,
				additional_notes = EXCLUDED.additional_notes,
				status = 'submitted',
				updated_at = now()
			RETURNING price_offer(vendor_prices) AS doc
		)
		SELECT
			(SELECT coalesce(jsonb_agg(doc), '[]'::jsonb) FROM saved),
			(SELECT jsonb_agg(sku_id) FROM bad),
			coalesce((SELECT bool_or(missing) FROM bad), false)
	`, vendorID, string(body)).Scan(&saved, &bad, &missing)
	if err != nil {
		log.Println(err)
		return nil, false, http.StatusInternalServerError, "Gagal menyimpan penawaran."
	}
	if bad != nil {
		return nil, missing, http.StatusConflict, "SKU belum dibuka untuk rekanan atau tidak ditemukan: " + string(bad)
	}
	return saved, false, http.StatusOK, ""
}

func dateOnly(value string) string {
	value = strings.TrimSpace(value)
	if len(value) >= 10 {
		return value[:10]
	}
	return value
}

func emptyNil(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
