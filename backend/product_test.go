package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// openTestDB registers Close via t.Cleanup first so later cleanups still see an open DB
// (defer db.Close runs before t.Cleanup and would silently break deletes).
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestProductSuggestPrefersVendorLevel1(t *testing.T) {
	db := openTestDB(t)
	_, _ = db.Exec(`DELETE FROM vendor_products WHERE sku_id IN ('sku-l1-a', 'sku-l1-b')`)
	_, _ = db.Exec(`DELETE FROM master_skus WHERE id IN ('sku-l1-a', 'sku-l1-b')`)
	_, err := db.Exec(`
		INSERT INTO master_skus (
			id, erp_code, commodity_name, general_spec, level1, level2, level3, level4,
			uom, is_open_for_vendor, is_active, status, created_at, updated_at
		) VALUES
		('sku-l1-a', 'ERP-L1A', 'KATETER UJI', 'size 1', 'GENERAL SUPPLIES', 'CONSUMABLES', 'X', 'Y',
			'Pcs', true, true, 'active', now(), now()),
		('sku-l1-b', 'ERP-L1B', 'KATETER UJI', 'size 1', 'DIAGNOSTIC AND MEDICAL DEVICES', 'SURGICAL', 'X', 'Y',
			'Pcs', true, true, 'active', now(), now())
	`)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM vendor_products WHERE sku_id IN ('sku-l1-a', 'sku-l1-b')`)
		_, _ = db.Exec(`DELETE FROM master_skus WHERE id IN ('sku-l1-a', 'sku-l1-b')`)
	})

	raw, err := suggestSKUsJSON(t.Context(), db, "KATETER UJI", "", "", "DIAGNOSTIC AND MEDICAL DEVICES", 2)
	if err != nil {
		t.Fatal(err)
	}
	var hits []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &hits); err != nil || len(hits) < 2 {
		t.Fatalf("hits %s", raw)
	}
	if hits[0].ID != "sku-l1-b" {
		t.Fatalf("want diagnostic SKU first when level1 scoped, got %+v", hits)
	}
}

func TestProductSuggestRanksPrefixAboveContains(t *testing.T) {
	db := openTestDB(t)
	_, _ = db.Exec(`DELETE FROM master_skus WHERE id IN ('sku-suggest-a', 'sku-suggest-b')`)
	_, err := db.Exec(`
		INSERT INTO master_skus (
			id, erp_code, commodity_name, general_spec, level1, level2, level3, level4,
			uom, is_open_for_vendor, is_active, status, created_at, updated_at
		) VALUES
		('sku-suggest-a', 'ERP-A', 'KASSA HIDROFIL', '40x80', 'GENERAL SUPPLIES', 'CONSUMABLES', 'DRESSING', 'KASSA',
			'Pcs', true, true, 'active', now(), now()),
		('sku-suggest-b', 'ERP-B', 'PERBAN KASSA ROLL', '10cm', 'GENERAL SUPPLIES', 'CONSUMABLES', 'DRESSING', 'PERBAN',
			'Pcs', true, true, 'active', now(), now())
	`)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM master_skus WHERE id IN ('sku-suggest-a', 'sku-suggest-b')`)
	})

	token, err := issueSession(t.Context(), db, "vendor", "vnd-001")
	if err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/vendors/{id}/products/suggest", guard(db, vendorSelf, productSuggest(db)))
	req := httptest.NewRequest("GET", "/api/vendors/vnd-001/products/suggest?q=KASSA", nil)
	req.Header.Set(realmHeader, "vendor")
	req.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: token})
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}

	var hits []struct {
		ID   string `json:"id"`
		Rank int    `json:"rank"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &hits); err != nil {
		t.Fatal(err)
	}
	if len(hits) < 2 {
		t.Fatalf("want at least 2 hits, got %d %v", len(hits), hits)
	}
	if hits[0].ID != "sku-suggest-a" || hits[0].Rank != 1 {
		t.Fatalf("top hit should be prefix KASSA HIDROFIL rank=1, got %+v", hits[0])
	}
}

func TestProductCRUDAndLink(t *testing.T) {
	db := openTestDB(t)

	const vendorID = "vp-test-v"
	if _, err := db.Exec(`
		INSERT INTO vendors (id, company_name, npwp, status, pic) VALUES
		($1, 'VP Test', '99.999.999.9-999.999', 'verified', '{"name":"PIC","email":"vp@test.local","phone":"+6281111111111"}')
		ON CONFLICT (id) DO NOTHING
	`, vendorID); err != nil {
		t.Fatal(err)
	}
	_, _ = db.Exec(`UPDATE vendor_products SET sku_id = NULL WHERE sku_id = 'sku-link-1'`)
	_, _ = db.Exec(`DELETE FROM vendor_products WHERE vendor_id = $1`, vendorID)
	if _, err := db.Exec(`
		INSERT INTO master_skus (
			id, erp_code, commodity_name, general_spec, level1, level2, level3, level4,
			uom, is_open_for_vendor, is_active, status, created_at, updated_at
		) VALUES
		('sku-link-1', 'ERP-L1', 'SPUIT 3ML', 'luer lock', 'GENERAL SUPPLIES', 'CONSUMABLES', 'INJECTION', 'SPUIT',
			'Pcs', true, true, 'active', now(), now())
		ON CONFLICT (id) DO UPDATE SET is_open_for_vendor = true, is_active = true, status = 'active'
	`); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM vendor_products WHERE vendor_id = $1`, vendorID)
		_, _ = db.Exec(`DELETE FROM master_skus WHERE id = 'sku-link-1'`)
		_, _ = db.Exec(`DELETE FROM sessions WHERE actor_id = $1`, vendorID)
		_, _ = db.Exec(`DELETE FROM vendors WHERE id = $1`, vendorID)
	})

	token, err := issueSession(t.Context(), db, "vendor", vendorID)
	if err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/vendors/{id}/products", guard(db, vendorSelf, postVendorProduct(db)))
	mux.HandleFunc("POST /api/vendors/{id}/products/{productId}/link", guard(db, vendorSelf, linkVendorProduct(db)))
	mux.HandleFunc("POST /api/vendors/{id}/products/{productId}/unlink", guard(db, vendorSelf, unlinkVendorProduct(db)))
	mux.HandleFunc("POST /api/vendors/{id}/products/bulk", guard(db, vendorSelf, postVendorProductsBulk(db)))
	mux.HandleFunc("GET /api/vendors/{id}/products/match-preview", guard(db, vendorSelf, productMatchPreview(db)))
	mux.HandleFunc("POST /api/vendors/{id}/products/link-batch", guard(db, vendorSelf, linkVendorProductsBatch(db)))

	create := httptest.NewRequest("POST", "/api/vendors/"+vendorID+"/products", strings.NewReader(`{"name":"Onemed Spuit 3ml","brand":"Onemed"}`))
	create.Header.Set("Content-Type", "application/json")
	create.Header.Set(realmHeader, "vendor")
	create.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: token})
	crec := httptest.NewRecorder()
	mux.ServeHTTP(crec, create)
	if crec.Code != http.StatusOK {
		t.Fatalf("create %d %s", crec.Code, crec.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(crec.Body.Bytes(), &created); err != nil || created.ID == "" {
		t.Fatalf("create body %s", crec.Body.String())
	}

	link := httptest.NewRequest("POST", "/api/vendors/"+vendorID+"/products/"+created.ID+"/link", strings.NewReader(`{"skuId":"sku-link-1"}`))
	link.Header.Set("Content-Type", "application/json")
	link.Header.Set(realmHeader, "vendor")
	link.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: token})
	lrec := httptest.NewRecorder()
	mux.ServeHTTP(lrec, link)
	if lrec.Code != http.StatusOK {
		t.Fatalf("link %d %s", lrec.Code, lrec.Body.String())
	}

	unlink := httptest.NewRequest("POST", "/api/vendors/"+vendorID+"/products/"+created.ID+"/unlink", nil)
	unlink.Header.Set(realmHeader, "vendor")
	unlink.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: token})
	urec := httptest.NewRecorder()
	mux.ServeHTTP(urec, unlink)
	if urec.Code != http.StatusOK {
		t.Fatalf("unlink %d %s", urec.Code, urec.Body.String())
	}

	bulk := httptest.NewRequest("POST", "/api/vendors/"+vendorID+"/products/bulk", strings.NewReader(`{"items":[{"name":"Bulk A"},{"name":"Bulk B"}]}`))
	bulk.Header.Set("Content-Type", "application/json")
	bulk.Header.Set(realmHeader, "vendor")
	bulk.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: token})
	brec := httptest.NewRecorder()
	mux.ServeHTTP(brec, bulk)
	if brec.Code != http.StatusOK || !strings.Contains(brec.Body.String(), `"saved":2`) {
		t.Fatalf("bulk %d %s", brec.Code, brec.Body.String())
	}

	relink := httptest.NewRequest("POST", "/api/vendors/"+vendorID+"/products/"+created.ID+"/link", strings.NewReader(`{"skuId":"sku-link-1"}`))
	relink.Header.Set("Content-Type", "application/json")
	relink.Header.Set(realmHeader, "vendor")
	relink.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: token})
	mux.ServeHTTP(httptest.NewRecorder(), relink)

	prev := httptest.NewRequest("GET", "/api/vendors/"+vendorID+"/products/match-preview", nil)
	prev.Header.Set(realmHeader, "vendor")
	prev.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: token})
	prec := httptest.NewRecorder()
	mux.ServeHTTP(prec, prev)
	if prec.Code != http.StatusOK {
		t.Fatalf("match-preview %d %s", prec.Code, prec.Body.String())
	}
	var preview []struct {
		ProductID string `json:"productId"`
	}
	if err := json.Unmarshal(prec.Body.Bytes(), &preview); err != nil || len(preview) < 2 {
		t.Fatalf("preview body %s", prec.Body.String())
	}
}

func TestProductMerchantOfferSyncOnLink(t *testing.T) {
	db := openTestDB(t)
	const vendorID = "vp-merchant-v"
	if _, err := db.Exec(`
		INSERT INTO vendors (id, company_name, npwp, status, pic) VALUES
		($1, 'Merchant Co', '88.888.888.8-888.888', 'verified', '{"name":"PIC","email":"merch@test.local","phone":"+6281222222222"}')
		ON CONFLICT (id) DO NOTHING
	`, vendorID); err != nil {
		t.Fatal(err)
	}
	_, _ = db.Exec(`DELETE FROM vendor_prices WHERE vendor_id = $1`, vendorID)
	_, _ = db.Exec(`DELETE FROM vendor_products WHERE vendor_id = $1`, vendorID)
	if _, err := db.Exec(`
		INSERT INTO master_skus (
			id, erp_code, commodity_name, general_spec, level1, level2, level3, level4,
			uom, is_open_for_vendor, is_active, status, created_at, updated_at
		) VALUES
		('sku-merch-1', 'ERP-M1', 'KASSA MERCHANT', '40x80', 'GENERAL SUPPLIES', 'CONSUMABLES', 'DRESSING', 'KASSA',
			'Box', true, true, 'active', now(), now())
		ON CONFLICT (id) DO UPDATE SET is_open_for_vendor = true, is_active = true, status = 'active', uom = 'Box'
	`); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM vendor_prices WHERE vendor_id = $1`, vendorID)
		_, _ = db.Exec(`DELETE FROM vendor_products WHERE vendor_id = $1`, vendorID)
		_, _ = db.Exec(`DELETE FROM master_skus WHERE id = 'sku-merch-1'`)
		_, _ = db.Exec(`DELETE FROM sessions WHERE actor_id = $1`, vendorID)
		_, _ = db.Exec(`DELETE FROM vendors WHERE id = $1`, vendorID)
	})

	token, err := issueSession(t.Context(), db, "vendor", vendorID)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/vendors/{id}/products", guard(db, vendorSelf, postVendorProduct(db)))
	mux.HandleFunc("POST /api/vendors/{id}/products/{productId}/link", guard(db, vendorSelf, linkVendorProduct(db)))

	body := `{"name":"Onemed Kassa","brand":"Onemed","uom":"","priceList":100000,"discountPct":10,"moq":2,"leadTimeDays":5,"izinEdar":"AKL-123","lkppUrl":"https://lkpp.example/item"}`
	create := httptest.NewRequest("POST", "/api/vendors/"+vendorID+"/products", strings.NewReader(body))
	create.Header.Set("Content-Type", "application/json")
	create.Header.Set(realmHeader, "vendor")
	create.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: token})
	crec := httptest.NewRecorder()
	mux.ServeHTTP(crec, create)
	if crec.Code != http.StatusOK {
		t.Fatalf("create %d %s", crec.Code, crec.Body.String())
	}
	var created struct {
		ID         string  `json:"id"`
		PriceList  int64   `json:"priceList"`
		NettPrice  int64   `json:"nettPrice"`
		IzinEdar   string  `json:"izinEdar"`
		DiscountPct float64 `json:"discountPct"`
	}
	if err := json.Unmarshal(crec.Body.Bytes(), &created); err != nil || created.ID == "" {
		t.Fatalf("create body %s", crec.Body.String())
	}
	if created.PriceList != 100000 || created.NettPrice != 90000 || created.IzinEdar != "AKL-123" {
		t.Fatalf("merchant fields not round-tripped: %+v", created)
	}

	link := httptest.NewRequest("POST", "/api/vendors/"+vendorID+"/products/"+created.ID+"/link", strings.NewReader(`{"skuId":"sku-merch-1"}`))
	link.Header.Set("Content-Type", "application/json")
	link.Header.Set(realmHeader, "vendor")
	link.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: token})
	lrec := httptest.NewRecorder()
	mux.ServeHTTP(lrec, link)
	if lrec.Code != http.StatusOK {
		t.Fatalf("link %d %s", lrec.Code, lrec.Body.String())
	}
	var linked struct {
		UOM string `json:"uom"`
	}
	_ = json.Unmarshal(lrec.Body.Bytes(), &linked)
	if linked.UOM != "Box" {
		t.Fatalf("link should sync empty uom from SKU, got %q", linked.UOM)
	}

	var offers int
	if err := db.QueryRow(`SELECT count(*) FROM vendor_prices WHERE vendor_id = $1 AND sku_id = 'sku-merch-1'`, vendorID).Scan(&offers); err != nil || offers != 1 {
		t.Fatalf("want 1 synced offer, got %d err %v", offers, err)
	}
}
