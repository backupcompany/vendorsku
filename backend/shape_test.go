package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

// Migration 015 nulls demo hashes; tests that need password sign-in restore a local-only secret.
const testSeedPassword = "TestSeed9x!"

func unlockSeedPasswords(t *testing.T, db *sql.DB) {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(testSeedPassword), 4)
	if err != nil {
		t.Fatal(err)
	}
	h := string(hash)
	if _, err := db.Exec(`UPDATE vendors SET password_hash = $1, password_created_at = now() WHERE id = 'vnd-001'`, h); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`UPDATE admin_users SET password_hash = $1 WHERE id = 'adm-001'`, h); err != nil {
		t.Fatal(err)
	}
}

func TestVendorTreeHidesOtherVendor(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO vendors (id, company_name, npwp, status, password_hash, pic, business_scope) VALUES
		('shape-a', 'Vendor A', '00', 'verified', 'secret-vendor-a',
		 '{"name":"PIC A","email":"a@vendor.test","phone":"+62001"}',
		 '{"level1":"DIAGNOSTIC AND MEDICAL DEVICES","level2List":["SURGICAL"]}'),
		('shape-b', 'Vendor B', '01', 'verified', 'secret-vendor-b',
		 '{"name":"PIC B","email":"b@vendor.test","phone":"+62002"}',
		 '{"level1":"GENERAL SUPPLIES","level2List":["LINEN"]}');
		INSERT INTO master_skus (
			id, erp_code, level1, level2, level3, level4, commodity_name, general_spec, uom,
			is_open_for_vendor, status, created_at, updated_at
		) VALUES
		('shape-sku', '999000000001', 'DIAGNOSTIC AND MEDICAL DEVICES', 'SURGICAL', 'X', 'Y', 'Spuit', '3 ml', 'Pcs', true, 'active', now(), now()),
		('shape-gloves', '999000000002', 'GENERAL SUPPLIES', 'LINEN', 'X', 'Y', 'Sarung Tangan', 'M', 'Box', true, 'active', now(), now());
		INSERT INTO vendor_prices (
			id, sku_id, sku_erp_code, vendor_id, commodity_name, general_spec, vendor_brand, vendor_part_number,
			full_formatted_sku_name, price_list_exclude_vat, discount_percent, nett_price_exclude_vat,
			unit_price, tax_percent, price_with_tax, uom, moq, lead_time_days, price_valid_until,
			status, submitted_at, updated_at
		) VALUES
		('shape-offer-a', 'shape-sku', '999000000001', 'shape-a', 'Spuit', '3 ml', 'Terumo', 'SS', 'Spuit ; 3 ml ; Terumo ; SS', 18000, 10, 16200, 16200, 11, 17982, 'Pcs', 1, 5, '2026-12-31', 'submitted', now(), now()),
		('shape-offer-b', 'shape-sku', '999000000001', 'shape-b', 'Spuit', '3 ml', 'OneMed', 'OM', 'Spuit ; 3 ml ; OneMed ; OM', 20000, 0, 20000, 20000, 11, 22200, 'Pcs', 1, 14, '2026-12-31', 'submitted', now(), now());
	`)
	if err != nil {
		t.Fatal(err)
	}

	var raw []byte
	if err := tx.QueryRow(`SELECT vendor_doc('shape-a')`).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	body := string(raw)
	for _, leak := range []string{"b@vendor.test", "Vendor B", "secret-vendor-a", "secret-vendor-b", "shape-offer-b"} {
		if strings.Contains(body, leak) {
			t.Fatalf("vendor A document contains %q", leak)
		}
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	if _, ok := doc["email"]; ok {
		t.Fatal("email must sit inside pic")
	}
	pic := doc["pic"].(map[string]any)
	if pic["name"] != "PIC A" || pic["email"] != "a@vendor.test" || pic["phone"] != "+62001" {
		t.Fatalf("pic = %#v", pic)
	}
	offers := doc["offers"].([]any)
	if len(offers) != 1 || offers[0].(map[string]any)["id"] != "shape-offer-a" {
		t.Fatalf("offers = %#v", offers)
	}

	if err := tx.QueryRow(`SELECT vendor_catalog('shape-a')`).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	body = string(raw)
	for _, leak := range []string{"b@vendor.test", "Vendor B", "shape-offer-b", "shape-gloves"} {
		if strings.Contains(body, leak) {
			t.Fatalf("vendor A catalog contains %q", leak)
		}
	}
	var catalog []map[string]any
	if err := json.Unmarshal(raw, &catalog); err != nil {
		t.Fatal(err)
	}
	if len(catalog) != 1 || catalog[0]["offer"].(map[string]any)["id"] != "shape-offer-a" {
		t.Fatalf("catalog = %s", raw)
	}

	if err := tx.QueryRow(`SELECT staff_skus()`).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "a@vendor.test") || !strings.Contains(string(raw), "b@vendor.test") {
		t.Fatal("staff view must keep each bid under its own vendor pic")
	}
}

func TestSignInFormKeys(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	unlockSeedPasswords(t, db)
	seedBody, _, status, msg := signInVendor(t.Context(), db, "01.234.567.8-012.000", testSeedPassword)
	if status != 200 || msg != "" || !strings.Contains(string(seedBody), "PT Medika Farma Pratama") {
		t.Fatalf("demo npwp sign-in: %d %s %s", status, msg, seedBody)
	}
	if strings.Contains(string(seedBody), "sales@globalalkesindo.com") {
		t.Fatal("demo sign-in included another vendor")
	}
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	doc, status, msg := createVendor(t.Context(), tx, false, vendorForm{
		CompanyName: "PT Tanpa NPWP",
		Email:       "pic@tanpa.co.id",
		Phone:       "081200000001",
		Password:    "Kuat2026rekan",
	})
	if status != 201 || msg != "" {
		t.Fatalf("create without optional fields: %d %s %s", status, msg, doc)
	}
	var created map[string]any
	if err := json.Unmarshal(doc, &created); err != nil {
		t.Fatal(err)
	}
	if created["npwp"] != nil {
		t.Fatalf("blank npwp stored as %#v", created["npwp"])
	}
	pic := created["pic"].(map[string]any)
	if pic["name"] != nil || pic["email"] != "pic@tanpa.co.id" {
		t.Fatalf("pic = %#v", pic)
	}
	keys := created["signIn"].([]any)
	if len(keys) != 1 || keys[0].(map[string]any)["kind"] != "pic_email" {
		t.Fatalf("signIn without npwp = %#v", keys)
	}

	body, _, status, msg := signInVendor(t.Context(), tx, "PIC@tanpa.co.id", "Kuat2026rekan")
	if status != 200 || msg != "" || !strings.Contains(string(body), `"kind":"pic_email"`) {
		t.Fatalf("sign in by pic email: %d %s %s", status, msg, body)
	}
	if _, _, status, msg = signInVendor(t.Context(), tx, "pic@tanpa.co.id", "salah"); status != 401 {
		t.Fatalf("bad password status %d %s", status, msg)
	}

	doc, status, msg = createVendor(t.Context(), tx, false, vendorForm{
		CompanyName:      "PT Punya NPWP",
		Email:            "pic@punya.co.id",
		Phone:            "081200000002",
		AuthorizedPerson: "Rina Kusuma",
		NPWP:             "09.123.456.7-890.000",
		Password:         "Kuat2026rekan",
	})
	if status != 201 || msg != "" {
		t.Fatalf("create with npwp: %d %s %s", status, msg, doc)
	}
	if err := json.Unmarshal(doc, &created); err != nil {
		t.Fatal(err)
	}
	keys = created["signIn"].([]any)
	if len(keys) != 2 || keys[0].(map[string]any)["kind"] != "pic_email" || keys[1].(map[string]any)["value"] != "091234567890000" {
		t.Fatalf("signIn with npwp = %#v", keys)
	}
	staffBody, _, status, msg := signInStaff(t.Context(), db, "admin", testSeedPassword)
	if status != 200 || !strings.Contains(string(staffBody), "heldra.parningotan@siloamhospitals.com") {
		t.Fatalf("staff sign-in: %d %s %s", status, msg, staffBody)
	}
	if strings.Contains(string(staffBody), "password") {
		t.Fatal("staff document includes a password field")
	}

	body, _, status, msg = signInVendor(t.Context(), tx, "09.123.456.7-890.000", "Kuat2026rekan")
	if status != 200 || strings.Contains(string(body), "pic@tanpa.co.id") || !strings.Contains(string(body), "PT Punya NPWP") || !strings.Contains(string(body), `"value":"091234567890000"`) {
		t.Fatalf("sign in by npwp: %d %s %s", status, msg, body)
	}
	if _, _, status, msg = signInVendor(t.Context(), tx, "PT Punya NPWP", "vendor123"); status != 400 {
		t.Fatalf("company name sign-in status %d %s", status, msg)
	}
	if _, _, status, msg = signInVendor(t.Context(), tx, "12345", "vendor123"); status != 400 {
		t.Fatalf("short npwp status %d %s", status, msg)
	}
	if _, _, status, msg = signInVendor(t.Context(), tx, "00.000.000.0-000.000", "vendor123"); status != 400 {
		t.Fatalf("zero npwp status %d %s", status, msg)
	}
	if _, _, status, msg = signInVendor(t.Context(), tx, "a@", "vendor123"); status != 400 {
		t.Fatalf("bad email status %d %s", status, msg)
	}
	staffBody, _, status, msg = signInStaff(t.Context(), db, "Heldra.Parningotan@SiloamHospitals.com", testSeedPassword)
	if status != 200 || !strings.Contains(string(staffBody), `"kind":"email"`) || !strings.Contains(string(staffBody), `"value":"heldra.parningotan@siloamhospitals.com"`) {
		t.Fatalf("staff email sign-in: %d %s %s", status, msg, staffBody)
	}
	if _, _, status, msg = signInStaff(t.Context(), db, "heldra@", "admin123"); status != 400 {
		t.Fatalf("bad staff email status %d %s", status, msg)
	}
}

func TestUpsertSkuKeepsErpCode(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	price := json.Number("1500.123456")
	source := json.RawMessage(`{"Name":"  Spuit Uji ","Standard Price":1500.123456,"Brand":"NB","Is Active":true}`)
	row := skuIn{
		ID: "sku-uji-sync", ErpCode: "ERP-UJI-SYNC", Level1: "A", Level2: "B", Level3: "C", Level4: "D",
		CommodityName: "Spuit Uji", GeneralSpec: "3 ml", Uom: "pcs", Status: "active", BenchmarkPrice: &price, IsOpenForVendor: true,
		SpItemID: "SP-77", SourceRow: source,
	}
	ids, status, msg := upsertSkus(t.Context(), tx, []skuIn{row})
	if status != 200 || msg != "" || len(ids) != 1 || ids[0] != "sku-uji-sync" {
		t.Fatalf("insert sku: %d %s %v", status, msg, ids)
	}
	var savedPrice, spItem string
	var sameSource bool
	if err := tx.QueryRow(`SELECT benchmark_price::text, sp_item_id, source_row = $1::jsonb FROM master_skus WHERE id = 'sku-uji-sync'`, string(source)).Scan(&savedPrice, &spItem, &sameSource); err != nil || savedPrice != "1500.123456" || spItem != "SP-77" || !sameSource {
		t.Fatalf("lossless fields price=%s sp=%s source=%v err=%v", savedPrice, spItem, sameSource, err)
	}
	renamed := row
	renamed.CommodityName = "Spuit Uji Baru"
	renamed.ID = "sku-lain"
	archived := renamed
	archived.Status = "archived"
	ids, status, msg = upsertSkus(t.Context(), tx, []skuIn{renamed, archived})
	if status != 200 || len(ids) != 1 || ids[0] != "sku-uji-sync" {
		t.Fatalf("upsert kept id %v status %d %s", ids, status, msg)
	}
	var name string
	var active bool
	if err := tx.QueryRow(`SELECT commodity_name, is_active FROM master_skus WHERE id = 'sku-uji-sync'`).Scan(&name, &active); err != nil || name != "Spuit Uji Baru" || active {
		t.Fatalf("name %s active %v err %v", name, active, err)
	}
	row.CommodityName = ""
	if _, status, _ = upsertSkus(t.Context(), tx, []skuIn{row}); status != 400 {
		t.Fatalf("blank name status %d", status)
	}
}

func TestSaveAiLog(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	if _, status, _ := saveAiLog(t.Context(), tx, aiLogIn{SessionID: "sess-uji", Action: "lain", PromptPreview: "halo", TokensUsed: 10, Model: "gemini"}); status != 400 {
		t.Fatalf("bad action status %d", status)
	}
	raw, status, msg := saveAiLog(t.Context(), tx, aiLogIn{SessionID: "sess-uji", Action: "sku_parse", PromptPreview: "spuit 3cc", TokensUsed: 1000000, Model: "gemini-3.8-flash"})
	if status != 201 || msg != "" || !strings.Contains(string(raw), "sku_parse") || !strings.Contains(string(raw), "0.15") {
		t.Fatalf("save log: %d %s %s", status, msg, raw)
	}
}

func TestSaveOfferStaysOnThatVendor(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO vendors (id, company_name, status, pic) VALUES
		('offer-a', 'Vendor A', 'verified', '{"name":null,"email":"a@offer.test","phone":"+62001"}'),
		('offer-b', 'Vendor B', 'verified', '{"name":null,"email":"b@offer.test","phone":"+62002"}');
		INSERT INTO master_skus (
			id, erp_code, level1, level2, level3, level4, commodity_name, general_spec, uom,
			is_open_for_vendor, status, created_at, updated_at
		) VALUES
		('offer-sku', '999000000011', 'DIAGNOSTIC AND MEDICAL DEVICES', 'SURGICAL', 'X', 'Y', 'Spuit', '3 ml', 'Pcs', true, 'active', now(), now()),
		('offer-locked', '999000000012', 'GENERAL SUPPLIES', 'LINEN', 'X', 'Y', 'Sprei', 'Katun', 'Pcs', false, 'active', now(), now());
	`)
	if err != nil {
		t.Fatal(err)
	}

	raw, status, msg := saveOffer(t.Context(), tx, "offer-a", offerForm{
		SkuID: "offer-sku", Brand: "Terumo", PartNumber: "SS-03L",
		PriceList: 18000, Discount: 10, PriceValidUntil: "2026-12-31",
	})
	if status != 200 || msg != "" || !strings.Contains(string(raw), "16200") || !strings.Contains(string(raw), "Terumo") {
		t.Fatalf("save offer: %d %s %s", status, msg, raw)
	}
	if strings.Contains(string(raw), "b@offer.test") {
		t.Fatal("offer document includes the other vendor")
	}

	raw, status, msg = saveOffer(t.Context(), tx, "offer-a", offerForm{
		SkuID: "offer-sku", Brand: "OneMed", PartNumber: "OM-3CC",
		PriceList: 20000, Discount: 0, PriceValidUntil: "2026-12-31",
	})
	if status != 200 || !strings.Contains(string(raw), "OneMed") {
		t.Fatalf("update offer: %d %s %s", status, msg, raw)
	}
	var n int
	if err := tx.QueryRow(`SELECT count(*) FROM vendor_prices WHERE vendor_id = 'offer-a' AND sku_id = 'offer-sku'`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("offers for vendor A = %d (%v)", n, err)
	}

	if _, status, msg = saveOffer(t.Context(), tx, "offer-b", offerForm{
		SkuID: "offer-locked", Brand: "X", PriceList: 1000, PriceValidUntil: "2026-12-31",
	}); status != 400 {
		t.Fatalf("closed sku status %d %s", status, msg)
	}

	open := offerForm{SkuID: "offer-sku", Brand: "B", PriceList: 1000, PriceValidUntil: "2026-12-31"}
	locked := offerForm{SkuID: "offer-locked", Brand: "B", PriceList: 1000, PriceValidUntil: "2026-12-31"}
	if _, _, status, _ = saveOffers(t.Context(), tx, "offer-b", []offerForm{open, locked}); status != 409 {
		t.Fatalf("mixed batch status %d", status)
	}
	if err := tx.QueryRow(`SELECT count(*) FROM vendor_prices WHERE vendor_id = 'offer-b'`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("rejected batch wrote %d offers (%v)", n, err)
	}
	raw, _, status, msg = saveOffers(t.Context(), tx, "offer-b", []offerForm{open, open})
	if status != 200 || strings.Count(string(raw), `"skuId"`) != 1 {
		t.Fatalf("deduped batch: %d %s %s", status, msg, raw)
	}
}

func TestPatchVendorProfile(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO vendors (id, company_name, status, pic) VALUES
		('profile-a', 'Vendor A', 'verified', '{"name":"Lama","email":"a@profile.test","phone":"+62001"}'),
		('profile-b', 'Vendor B', 'verified', '{"name":"Lain","email":"b@profile.test","phone":"+62002"}');
	`)
	if err != nil {
		t.Fatal(err)
	}

	company := "PT Profil Baru"
	address := "Gudang Uji"
	person := ""
	email := "PIC@Profil.test"
	raw, status, msg := saveVendorProfile(t.Context(), tx, "profile-a", vendorPatch{
		CompanyName: &company, Address: &address, AuthorizedPerson: &person, Email: &email,
	})
	body := string(raw)
	if status != 200 || !strings.Contains(body, "PT Profil Baru") || !strings.Contains(body, "pic@profil.test") || strings.Contains(body, "b@profile.test") {
		t.Fatalf("patch profile: %d %s %s", status, msg, body)
	}
	if strings.Contains(body, `"password"`) {
		t.Fatal("profile document includes a password")
	}

	scope := json.RawMessage(`{"level1":"GENERAL SUPPLIES","level2List":["LINEN & UNIFORM"]}`)
	raw, status, msg = saveVendorProfile(t.Context(), tx, "profile-a", vendorPatch{BusinessScope: scope})
	if status != 200 || !strings.Contains(string(raw), "LINEN & UNIFORM") {
		t.Fatalf("patch scope: %d %s %s", status, msg, raw)
	}

	terms := json.RawMessage(`{"coverageType":"selected_units","coveredHospitalUnits":["Siloam Hospitals Lippo Village"],"taxCondition":"exclude_vat_11","currency":"IDR","priceValidUntil":"2026-12-31","deliveryTerm":"Franco","paymentTerm":"TOP 30","warrantyGeneral":"1 tahun","standardLeadTimeDays":7,"standardMoq":1}`)
	raw, status, msg = saveVendorProfile(t.Context(), tx, "profile-a", vendorPatch{CommercialTerms: terms})
	if status != 200 || !strings.Contains(string(raw), "Siloam Hospitals Lippo Village") {
		t.Fatalf("patch terms: %d %s %s", status, msg, raw)
	}

	blank := ""
	if _, status, _ = saveVendorProfile(t.Context(), tx, "profile-a", vendorPatch{CompanyName: &blank}); status != 400 {
		t.Fatalf("blank company status %d", status)
	}

	code := "ERP-UJI-A"
	verified := true
	existing := true
	staffStatus := "verified"
	source := "erp_upload"
	notes := "Dipromosikan uji"
	raw, status, msg = saveVendorProfile(t.Context(), tx, "profile-a", vendorPatch{
		ErpVendorCode: &code, IsExistingSupplier: &existing, Status: &staffStatus, Verified: &verified, Source: &source, Notes: &notes,
	})
	body = string(raw)
	if status != 200 || !strings.Contains(body, "ERP-UJI-A") || !strings.Contains(body, "Dipromosikan uji") {
		t.Fatalf("promote: %d %s %s", status, msg, body)
	}
}

func TestSessionGuards(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	ctx := t.Context()
	vendorToken, err := issueSession(ctx, db, "vendor", "vnd-001")
	if err != nil {
		t.Fatal(err)
	}
	staffToken, err := issueSession(ctx, db, "staff", "adm-001")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec(`DELETE FROM sessions WHERE id = ANY($1)`, []string{tokenHash(vendorToken), tokenHash(staffToken)})

	ok := func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }
	call := func(allow func(actor, *http.Request) bool, token, id string) int {
		req := httptest.NewRequest("GET", "/x/"+id, nil)
		req.SetPathValue("id", id)
		if token != "" {
			realm := "staff"
			if token == vendorToken {
				realm = "vendor"
			}
			req.Header.Set(realmHeader, realm)
			req.AddCookie(&http.Cookie{Name: sessionCookieName(realm), Value: token})
		}
		rec := httptest.NewRecorder()
		guard(db, allow, ok)(rec, req)
		return rec.Code
	}
	cases := []struct {
		name  string
		allow func(actor, *http.Request) bool
		token string
		id    string
		want  int
	}{
		{"no token", staffOnly, "", "", 401},
		{"forged token", staffOnly, "deadbeef", "", 401},
		{"vendor on staff route", staffOnly, vendorToken, "", 403},
		{"staff on staff route", staffOnly, staffToken, "", 200},
		{"vendor own id", selfOrStaff, vendorToken, "vnd-001", 200},
		{"vendor other id", selfOrStaff, vendorToken, "vnd-002", 403},
		{"staff any vendor", selfOrStaff, staffToken, "vnd-002", 200},
		{"staff cannot post vendor offers", vendorSelf, staffToken, "vnd-001", 403},
	}
	for _, c := range cases {
		if got := call(c.allow, c.token, c.id); got != c.want {
			t.Errorf("%s: got %d want %d", c.name, got, c.want)
		}
	}

	req := httptest.NewRequest("PATCH", "/api/vendors/vnd-001", strings.NewReader(`{"status":"verified"}`))
	req.SetPathValue("id", "vnd-001")
	req.Header.Set(realmHeader, "vendor")
	req.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: vendorToken})
	rec := httptest.NewRecorder()
	guard(db, selfOrStaff, patchVendor(db))(rec, req)
	if rec.Code != 403 {
		t.Fatalf("vendor self-promote status %d %s", rec.Code, rec.Body)
	}

	withCookie := func(realm, cookieRealm, token string) int {
		req := httptest.NewRequest("GET", "/api/session", nil)
		if realm != "" {
			req.Header.Set(realmHeader, realm)
		}
		req.AddCookie(&http.Cookie{Name: sessionCookieName(cookieRealm), Value: token})
		rec := httptest.NewRecorder()
		guard(db, anySession, getSession(db))(rec, req)
		return rec.Code
	}
	anon := httptest.NewRecorder()
	getSession(db)(anon, httptest.NewRequest("GET", "/api/session", nil))
	if anon.Code != 200 || !strings.Contains(anon.Body.String(), `"kind":null`) {
		t.Errorf("anonymous session probe got %d %s", anon.Code, anon.Body.String())
	}
	if got := withCookie("", "vendor", vendorToken); got != 401 {
		t.Errorf("cookie without realm header (CSRF) got %d", got)
	}
	if got := withCookie("staff", "staff", vendorToken); got != 401 {
		t.Errorf("vendor token in staff realm got %d", got)
	}
	if got := withCookie("vendor", "vendor", vendorToken); got != 200 {
		t.Errorf("vendor session restore got %d", got)
	}
}

func TestPasswordPolicy(t *testing.T) {
	cases := map[string]bool{
		"pendek1": false, "tanpaangka": false, "12345678": false, "vendor123": false,
		" Spasi2026x": false, "budisantoso99": false, strings.Repeat("a1", 37): false,
		"Kuat2026rekan": true, "harga alkes 77": true,
	}
	for pw, ok := range cases {
		if got := passwordProblem(pw, "budisantoso@medika.co.id") == ""; got != ok {
			t.Errorf("%q accepted=%v want %v", pw, got, ok)
		}
	}
}

func TestSignInThrottleAndCookie(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	unlockSeedPasswords(t, db)
	signInThrottle.clear("staff:admin")
	signInThrottle.clear("ip:192.0.2.9")
	db.Exec(`DELETE FROM otp_challenges WHERE actor_id = 'adm-001'`)
	defer db.Exec(`DELETE FROM otp_challenges WHERE actor_id = 'adm-001'`)
	sendMail = func(context.Context, string, string, string) error { return nil }
	defer func() { sendMail = webhookMail }()
	h := postSignInAs(db, "staff", signInStaff)
	try := func(password string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/api/staff/sign-in", strings.NewReader(`{"identifier":" Admin ","password":"`+password+`"}`))
		req.RemoteAddr = "192.0.2.9:5000"
		rec := httptest.NewRecorder()
		h(rec, req)
		return rec
	}
	rec := try(testSeedPassword)
	if rec.Code != 200 || len(rec.Result().Cookies()) != 0 || !strings.Contains(rec.Body.String(), `"otpRequired":true`) {
		t.Fatalf("password alone must not sign in: %d %s", rec.Code, rec.Body)
	}
	for i := 0; i < maxFailsPerKey; i++ {
		if rec = try("salah-terus-1"); rec.Code != 401 {
			t.Fatalf("attempt %d got %d", i, rec.Code)
		}
	}
	if rec = try(testSeedPassword); rec.Code != 429 || rec.Header().Get("Retry-After") == "" {
		t.Fatalf("locked account got %d", rec.Code)
	}
	signInThrottle.clear("staff:admin")
}

func TestEmailOTP(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	unlockSeedPasswords(t, db)
	reset := func() {
		db.Exec(`DELETE FROM otp_challenges WHERE actor_id = 'adm-001'`)
		signInThrottle.clear("staff:admin")
		signInThrottle.clear(otpKey("staff", "adm-001"))
	}
	reset()
	defer reset()
	var mailedTo, mailed string
	sendMail = func(_ context.Context, to, _, body string) error { mailedTo, mailed = to, body; return nil }
	defer func() { sendMail = webhookMail }()
	codeIn := regexp.MustCompile(`>(\d{6})<`)

	signIn := func() (challenge, code string) {
		req := httptest.NewRequest("POST", "/api/staff/sign-in", strings.NewReader(`{"identifier":"admin","password":"`+testSeedPassword+`"}`))
		rec := httptest.NewRecorder()
		postSignInAs(db, "staff", signInStaff)(rec, req)
		var out struct {
			Challenge string `json:"challenge"`
			Email     string `json:"email"`
		}
		json.Unmarshal(rec.Body.Bytes(), &out)
		if rec.Code != 200 || out.Challenge == "" || strings.Contains(out.Email, "heldra.parningotan") {
			t.Fatalf("sign-in %d %s", rec.Code, rec.Body)
		}
		m := codeIn.FindStringSubmatch(mailed)
		if m == nil || mailedTo != "heldra.parningotan@siloamhospitals.com" {
			t.Fatalf("mail to %q body %q", mailedTo, mailed)
		}
		return out.Challenge, m[1]
	}
	verify := func(challenge, code string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/api/sign-in/verify", strings.NewReader(`{"challenge":"`+challenge+`","code":" `+code+` "}`))
		rec := httptest.NewRecorder()
		postVerifyOTP(db)(rec, req)
		return rec
	}
	wrong := func(code string) string {
		if code == "000000" {
			return "000001"
		}
		return "000000"
	}

	first, firstCode := signIn()
	req := httptest.NewRequest("POST", "/api/staff/sign-in", strings.NewReader(`{"identifier":"admin","password":"`+testSeedPassword+`"}`))
	rec := httptest.NewRecorder()
	postSignInAs(db, "staff", signInStaff)(rec, req)
	if rec.Code != 429 {
		t.Fatalf("resend inside cooldown got %d", rec.Code)
	}
	db.Exec(`UPDATE otp_challenges SET created_at = now() - interval '2 minutes' WHERE actor_id = 'adm-001'`)
	second, code := signIn()
	if rec := verify(first, firstCode); rec.Code != 410 {
		t.Fatalf("older code must die when a fresh one is sent, got %d", rec.Code)
	}
	if rec := verify(second, "12ab56"); rec.Code != 400 {
		t.Fatalf("non-digit code got %d", rec.Code)
	}
	if rec := verify(second, wrong(code)); rec.Code != 401 || !strings.Contains(rec.Body.String(), "Sisa 4") || len(rec.Result().Cookies()) != 0 {
		t.Fatalf("wrong code got %d %s", rec.Code, rec.Body)
	}
	rec = verify(second, code)
	cookie := rec.Result().Cookies()
	if rec.Code != 200 || len(cookie) != 1 || !cookie[0].HttpOnly || cookie[0].SameSite != http.SameSiteStrictMode || !strings.Contains(rec.Body.String(), `"staff"`) {
		t.Fatalf("right code got %d %s", rec.Code, rec.Body)
	}
	db.Exec(`DELETE FROM sessions WHERE id = $1`, tokenHash(cookie[0].Value))
	if rec := verify(second, code); rec.Code != 410 {
		t.Fatalf("code reuse got %d", rec.Code)
	}

	db.Exec(`DELETE FROM otp_challenges WHERE actor_id = 'adm-001'`)
	third, code := signIn()
	for i := 0; i < otpMaxAttempts-1; i++ {
		verify(third, wrong(code))
	}
	if rec := verify(third, wrong(code)); rec.Code != 410 {
		t.Fatalf("5th wrong code must burn the challenge, got %d", rec.Code)
	}
	if rec := verify(third, code); rec.Code != 410 {
		t.Fatalf("burned challenge accepted right code: %d", rec.Code)
	}
	req = httptest.NewRequest("POST", "/api/staff/sign-in", strings.NewReader(`{"identifier":"admin","password":"`+testSeedPassword+`"}`))
	rec = httptest.NewRecorder()
	postSignInAs(db, "staff", signInStaff)(rec, req)
	if rec.Code != 429 {
		t.Fatalf("account must cool down after too many wrong codes, got %d", rec.Code)
	}
}

func TestChangePassword(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	ctx := t.Context()
	_, _ = db.ExecContext(ctx, `DELETE FROM vendors WHERE id = 'vnd-pw-test'`)
	hash, err := bcrypt.GenerateFromPassword([]byte("OldPass12"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `
		INSERT INTO vendors (id, company_name, status, password_hash, pic)
		VALUES ('vnd-pw-test', 'PW Test', 'prospect', $1, '{"email":"pwtest@example.com","phone":"081234567890"}'::jsonb)
	`, string(hash)); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(`DELETE FROM vendors WHERE id = 'vnd-pw-test'`)
	token, err := issueSession(ctx, db, "vendor", "vnd-pw-test")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec(`DELETE FROM sessions WHERE id = $1`, tokenHash(token))

	call := func(body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/api/password", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set(realmHeader, "vendor")
		req.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: token})
		rec := httptest.NewRecorder()
		guard(db, anySession, postChangePassword(db))(rec, req)
		return rec
	}
	if rec := call(`{"currentPassword":"wrong","newPassword":"NewPass99"}`); rec.Code != http.StatusForbidden {
		t.Fatalf("wrong current: %d %s", rec.Code, rec.Body)
	}
	if rec := call(`{"currentPassword":"OldPass12","newPassword":"NewPass99"}`); rec.Code != http.StatusOK {
		t.Fatalf("change: %d %s", rec.Code, rec.Body)
	}
	var stored string
	if err := db.QueryRow(`SELECT password_hash FROM vendors WHERE id = 'vnd-pw-test'`).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if bcrypt.CompareHashAndPassword([]byte(stored), []byte("NewPass99")) != nil {
		t.Fatal("db hash not updated")
	}
	if bcrypt.CompareHashAndPassword([]byte(stored), []byte("OldPass12")) == nil {
		t.Fatal("old password still works")
	}
}

func TestForgotPassword(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	ctx := t.Context()
	_, _ = db.ExecContext(ctx, `DELETE FROM vendors WHERE id = 'vnd-forgot'`)
	hash, err := bcrypt.GenerateFromPassword([]byte("OldPass12"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `
		INSERT INTO vendors (id, company_name, status, password_hash, pic)
		VALUES ('vnd-forgot', 'Forgot Co', 'prospect', $1, '{"email":"forgot@example.com","phone":"081234567890"}'::jsonb)
	`, string(hash)); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(`DELETE FROM vendors WHERE id = 'vnd-forgot'`)
	defer db.Exec(`DELETE FROM otp_challenges WHERE actor_id = 'vnd-forgot'`)
	signInThrottle.clear("reset:vendor:ghost@example.com")
	signInThrottle.clear("reset:vendor:forgot@example.com")
	signInThrottle.clear(otpKey("vendor", "vnd-forgot"))

	var mailed string
	sendMail = func(_ context.Context, _, _, body string) error { mailed = body; return nil }
	defer func() { sendMail = webhookMail }()

	ghost := httptest.NewRequest("POST", "/api/password/forgot", strings.NewReader(`{"identifier":"ghost@example.com"}`))
	grec := httptest.NewRecorder()
	postForgotPassword(db, "vendor")(grec, ghost)
	if grec.Code != 200 || !strings.Contains(grec.Body.String(), `"otpRequired":true`) {
		t.Fatalf("unknown account %d %s", grec.Code, grec.Body)
	}

	req := httptest.NewRequest("POST", "/api/password/forgot", strings.NewReader(`{"identifier":"forgot@example.com"}`))
	rec := httptest.NewRecorder()
	postForgotPassword(db, "vendor")(rec, req)
	var out struct {
		Challenge string `json:"challenge"`
	}
	json.Unmarshal(rec.Body.Bytes(), &out)
	if rec.Code != 200 || out.Challenge == "" {
		t.Fatalf("forgot %d %s", rec.Code, rec.Body)
	}
	m := regexp.MustCompile(`>(\d{6})<`).FindStringSubmatch(mailed)
	if m == nil {
		t.Fatalf("no code in mail %q", mailed)
	}
	bad := httptest.NewRequest("POST", "/api/password/reset", strings.NewReader(`{"challenge":"`+out.Challenge+`","code":"`+m[1]+`","newPassword":"short"}`))
	brec := httptest.NewRecorder()
	postResetPassword(db)(brec, bad)
	if brec.Code != 400 {
		t.Fatalf("weak password %d %s", brec.Code, brec.Body)
	}
	ok := httptest.NewRequest("POST", "/api/password/reset", strings.NewReader(`{"challenge":"`+out.Challenge+`","code":"`+m[1]+`","newPassword":"NewPass99"}`))
	orec := httptest.NewRecorder()
	postResetPassword(db)(orec, ok)
	if orec.Code != 200 {
		t.Fatalf("reset %d %s", orec.Code, orec.Body)
	}
	if _, _, status, _ := signInVendor(ctx, db, "forgot@example.com", "OldPass12"); status != 401 {
		t.Fatalf("old password still %d", status)
	}
	if _, _, status, msg := signInVendor(ctx, db, "forgot@example.com", "NewPass99"); status != 200 {
		t.Fatalf("new password %d %s", status, msg)
	}
}

func TestVendorSkuProposal(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	ctx := t.Context()
	_, err = db.ExecContext(ctx, `
		INSERT INTO vendors (id, company_name, status, pic)
		VALUES ('prop-vnd', 'PT Usulan', 'prospect', '{"name":"A","email":"prop@example.com","phone":"081234567890"}')
		ON CONFLICT (id) DO NOTHING
	`)
	if err != nil {
		t.Fatal(err)
	}
	post := func(body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "/api/vendors/prop-vnd/sku-proposals", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.SetPathValue("id", "prop-vnd")
		rec := httptest.NewRecorder()
		postSkuProposal(db)(rec, req)
		return rec
	}
	if rec := post(`{"commodityName":"","generalSpec":"x","level1":"GENERAL SUPPLIES"}`); rec.Code != 400 {
		t.Fatalf("blank name %d %s", rec.Code, rec.Body)
	}
	rec := post(`{"commodityName":"Kasa Steril","generalSpec":"Katun 100%, ukuran 10x10 cm.\nAQL 1.5.","level1":"GENERAL SUPPLIES","uom":"Box","brand":"Medi"}`)
	if rec.Code != 200 {
		t.Fatalf("propose %d %s", rec.Code, rec.Body)
	}
	var out struct {
		ID        string `json:"id"`
		Status    string `json:"status"`
		RawSpec   string `json:"rawSpec"`
		VendorID  string `json:"vendorId"`
		OpenCheck bool   `json:"isOpenForVendor"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil || out.ID == "" || out.Status != "pending_review" || out.VendorID != "prop-vnd" || !strings.Contains(out.RawSpec, "Katun") {
		t.Fatalf("body %#v err=%v", out, err)
	}
	var open, active bool
	var status string
	if err := db.QueryRowContext(ctx, `SELECT is_open_for_vendor, is_active, status FROM master_skus WHERE id=$1`, out.ID).Scan(&open, &active, &status); err != nil || open || active || status != "pending_review" {
		t.Fatalf("db flags open=%v active=%v status=%s err=%v", open, active, status, err)
	}
	bad := httptest.NewRequest("POST", "/api/staff/sku-proposals/"+out.ID+"/review", strings.NewReader(`{"decision":"maybe"}`))
	bad.Header.Set("Content-Type", "application/json")
	bad.SetPathValue("id", out.ID)
	brec := httptest.NewRecorder()
	reviewSkuProposal(db)(brec, bad)
	if brec.Code != 400 {
		t.Fatalf("bad decision %d", brec.Code)
	}
	ok := httptest.NewRequest("POST", "/api/staff/sku-proposals/"+out.ID+"/review", strings.NewReader(`{"decision":"approve","level2":"LINEN","level3":"KASA","level4":"STERIL"}`))
	ok.Header.Set("Content-Type", "application/json")
	ok.SetPathValue("id", out.ID)
	orec := httptest.NewRecorder()
	reviewSkuProposal(db)(orec, ok)
	if orec.Code != 200 {
		t.Fatalf("approve %d %s", orec.Code, orec.Body)
	}
	if err := db.QueryRowContext(ctx, `SELECT is_open_for_vendor, is_active, status, level2, source_row->>'rawSpec' FROM master_skus WHERE id=$1`, out.ID).Scan(&open, &active, &status, new(string), new(string)); err != nil {
		t.Fatal(err)
	}
	var level2, raw string
	if err := db.QueryRowContext(ctx, `SELECT is_open_for_vendor, is_active, status, level2, source_row->>'rawSpec' FROM master_skus WHERE id=$1`, out.ID).Scan(&open, &active, &status, &level2, &raw); err != nil || !open || !active || status != "active" || level2 != "LINEN" || !strings.Contains(raw, "Katun") {
		t.Fatalf("approved open=%v active=%v status=%s l2=%s raw=%q err=%v", open, active, status, level2, raw, err)
	}
	again := httptest.NewRequest("POST", "/api/staff/sku-proposals/"+out.ID+"/review", strings.NewReader(`{"decision":"reject"}`))
	again.Header.Set("Content-Type", "application/json")
	again.SetPathValue("id", out.ID)
	arec := httptest.NewRecorder()
	reviewSkuProposal(db)(arec, again)
	if arec.Code != 409 {
		t.Fatalf("re-review %d %s", arec.Code, arec.Body)
	}
	// second proposal → reject
	rec2 := post(`{"commodityName":"Sarung Tangan","generalSpec":"Latex powder free","level1":"DRUGS & CONSUMABLE"}`)
	if rec2.Code != 200 {
		t.Fatalf("propose2 %d %s", rec2.Code, rec2.Body)
	}
	var out2 struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(rec2.Body.Bytes(), &out2)
	rej := httptest.NewRequest("POST", "/api/staff/sku-proposals/"+out2.ID+"/review", strings.NewReader(`{"decision":"reject"}`))
	rej.Header.Set("Content-Type", "application/json")
	rej.SetPathValue("id", out2.ID)
	rrec := httptest.NewRecorder()
	reviewSkuProposal(db)(rrec, rej)
	if rrec.Code != 200 {
		t.Fatalf("reject %d %s", rrec.Code, rrec.Body)
	}
	if err := db.QueryRowContext(ctx, `SELECT status, is_active FROM master_skus WHERE id=$1`, out2.ID).Scan(&status, &active); err != nil || status != "archived" || active {
		t.Fatalf("rejected status=%s active=%v", status, active)
	}
}

func TestSkuProposalGuardsAndLists(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	// Unauthenticated list staff proposals → guard rejects before handler; call handler alone is fine.
	// Guard: vendor cannot hit staff route (tested via allow funcs).
	if staffOnly(actor{Kind: "vendor", ID: "x"}, nil) {
		t.Fatal("vendor must not be staff")
	}
	own := httptest.NewRequest("POST", "/api/vendors/prop-vnd/sku-proposals", nil)
	own.SetPathValue("id", "prop-vnd")
	if !vendorSelf(actor{Kind: "vendor", ID: "prop-vnd"}, own) {
		t.Fatal("vendorSelf own id")
	}
	reqOther := httptest.NewRequest("POST", "/api/vendors/other/sku-proposals", nil)
	reqOther.SetPathValue("id", "other")
	if vendorSelf(actor{Kind: "vendor", ID: "prop-vnd"}, reqOther) {
		t.Fatal("vendorSelf other id")
	}
	_, _ = db.Exec(`INSERT INTO vendors (id, company_name, status, pic) VALUES ('prop-list', 'List Co', 'prospect', '{"name":"L","email":"list@example.com","phone":"081111111111"}') ON CONFLICT DO NOTHING`)
	req := httptest.NewRequest("POST", "/api/vendors/prop-list/sku-proposals", strings.NewReader(`{"commodityName":"Item List","generalSpec":"Spek panjang\nbaris 2","level1":"UTILITIES"}`))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", "prop-list")
	rec := httptest.NewRecorder()
	postSkuProposal(db)(rec, req)
	if rec.Code != 200 {
		t.Fatalf("propose %d %s", rec.Code, rec.Body)
	}
	lreq := httptest.NewRequest("GET", "/api/vendors/prop-list/sku-proposals", nil)
	lreq.SetPathValue("id", "prop-list")
	lrec := httptest.NewRecorder()
	listVendorSkuProposals(db)(lrec, lreq)
	if lrec.Code != 200 || !strings.Contains(lrec.Body.String(), "Item List") || !strings.Contains(lrec.Body.String(), "pending_review") {
		t.Fatalf("vendor list %d %s", lrec.Code, lrec.Body)
	}
	srec := httptest.NewRecorder()
	listStaffSkuProposals(db)(srec, httptest.NewRequest("GET", "/api/staff/sku-proposals?status=pending_review", nil))
	if srec.Code != 200 || !strings.Contains(srec.Body.String(), "prop-list") {
		t.Fatalf("staff list %d %s", srec.Code, srec.Body)
	}
}

func TestVendorSkuProposalBulk(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO vendors (id, company_name, status, pic) VALUES ('bulk-vnd', 'Bulk Co', 'prospect', '{"name":"B","email":"bulk@example.com","phone":"081222222222"}') ON CONFLICT (id) DO NOTHING`)
	if err != nil {
		t.Fatal(err)
	}
	empty := httptest.NewRequest("POST", "/api/vendors/bulk-vnd/sku-proposals/bulk", strings.NewReader(`{"proposals":[]}`))
	empty.Header.Set("Content-Type", "application/json")
	empty.SetPathValue("id", "bulk-vnd")
	erec := httptest.NewRecorder()
	postSkuProposalsBulk(db)(erec, empty)
	if erec.Code != 400 {
		t.Fatalf("empty bulk %d %s", erec.Code, erec.Body)
	}
	bad := httptest.NewRequest("POST", "/api/vendors/bulk-vnd/sku-proposals/bulk", strings.NewReader(`{"proposals":[{"commodityName":"A","generalSpec":"","level1":"UTILITIES"},{"commodityName":"B","generalSpec":"ok","level1":"UTILITIES"}]}`))
	bad.Header.Set("Content-Type", "application/json")
	bad.SetPathValue("id", "bulk-vnd")
	brec := httptest.NewRecorder()
	postSkuProposalsBulk(db)(brec, bad)
	if brec.Code != 400 || !strings.Contains(brec.Body.String(), "Baris 1") {
		t.Fatalf("bad row %d %s", brec.Code, brec.Body)
	}
ok := httptest.NewRequest("POST", "/api/vendors/bulk-vnd/sku-proposals/bulk", strings.NewReader(`{"proposals":[{"commodityName":"Item A","generalSpec":"Spek A","level1":"UTILITIES","uom":"Pcs"},{"commodityName":"Item B","generalSpec":"Spek B panjang","level1":"GENERAL SUPPLIES","brand":"NB"}]}`))
	ok.Header.Set("Content-Type", "application/json")
	ok.SetPathValue("id", "bulk-vnd")
	orec := httptest.NewRecorder()
	postSkuProposalsBulk(db)(orec, ok)
	if orec.Code != 200 {
		t.Fatalf("bulk ok %d %s", orec.Code, orec.Body)
	}
	var out struct {
		Saved int      `json:"saved"`
		IDs   []string `json:"ids"`
	}
	if err := json.Unmarshal(orec.Body.Bytes(), &out); err != nil || out.Saved != 2 || len(out.IDs) != 2 {
		t.Fatalf("body %#v err=%v", out, err)
	}
	var pending int
	if err := db.QueryRow(`SELECT count(*) FROM master_skus WHERE id IN ($1,$2) AND status='pending_review' AND is_open_for_vendor=false`, out.IDs[0], out.IDs[1]).Scan(&pending); err != nil || pending != 2 {
		t.Fatalf("pending=%d err=%v", pending, err)
	}
}

func TestSkuAttachments(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO vendors (id, company_name, status, pic) VALUES ('att-vnd', 'Att Co', 'prospect', '{"name":"A","email":"att@example.com","phone":"081233333333"}') ON CONFLICT (id) DO NOTHING`)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/api/vendors/att-vnd/sku-proposals", strings.NewReader(`{"commodityName":"Item Att","generalSpec":"Spek","level1":"UTILITIES"}`))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", "att-vnd")
	rec := httptest.NewRecorder()
	postSkuProposal(db)(rec, req)
	if rec.Code != 200 {
		t.Fatalf("propose %d %s", rec.Code, rec.Body)
	}
	var prop struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &prop)

	png := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0}
	b64 := base64.StdEncoding.EncodeToString(png)
	body := `{"kind":"photo","filename":"x.png","contentType":"image/png","dataBase64":"` + b64 + `"}`
	areq := httptest.NewRequest("POST", "/api/vendors/att-vnd/sku-proposals/"+prop.ID+"/attachments", strings.NewReader(body))
	areq.Header.Set("Content-Type", "application/json")
	areq.SetPathValue("id", "att-vnd")
	areq.SetPathValue("skuId", prop.ID)
	arec := httptest.NewRecorder()
	postSkuAttachment(db)(arec, areq)
	if arec.Code != 200 {
		t.Fatalf("attach photo %d %s", arec.Code, arec.Body)
	}
	var att struct {
		ID   string `json:"id"`
		Kind string `json:"kind"`
	}
	_ = json.Unmarshal(arec.Body.Bytes(), &att)
	if att.Kind != "photo" || att.ID == "" {
		t.Fatalf("att %#v", att)
	}

	// wrong kind vs magic
	bad := httptest.NewRequest("POST", "/api/vendors/att-vnd/sku-proposals/"+prop.ID+"/attachments", strings.NewReader(`{"kind":"brochure","filename":"x.pdf","contentType":"application/pdf","dataBase64":"`+b64+`"}`))
	bad.Header.Set("Content-Type", "application/json")
	bad.SetPathValue("id", "att-vnd")
	bad.SetPathValue("skuId", prop.ID)
	brec := httptest.NewRecorder()
	postSkuAttachment(db)(brec, bad)
	if brec.Code != 400 {
		t.Fatalf("mismatch kind %d", brec.Code)
	}

	pdf := []byte("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n(Surgical Gloves Latex AQL 1.5)\ntrailer\n%%EOF")
	pb64 := base64.StdEncoding.EncodeToString(pdf)
	preq := httptest.NewRequest("POST", "/api/vendors/att-vnd/sku-proposals/"+prop.ID+"/attachments", strings.NewReader(`{"kind":"brochure","filename":"brosur.pdf","contentType":"application/pdf","dataBase64":"`+pb64+`"}`))
	preq.Header.Set("Content-Type", "application/json")
	preq.SetPathValue("id", "att-vnd")
	preq.SetPathValue("skuId", prop.ID)
	prec := httptest.NewRecorder()
	postSkuAttachment(db)(prec, preq)
	if prec.Code != 200 || !strings.Contains(prec.Body.String(), `"hasExtractedText":true`) {
		t.Fatalf("pdf %d %s", prec.Code, prec.Body)
	}
	var extracted string
	if err := db.QueryRow(`SELECT extracted_text FROM sku_attachments WHERE sku_id=$1 AND kind='brochure'`, prop.ID).Scan(&extracted); err != nil || !strings.Contains(extracted, "Gloves") {
		t.Fatalf("extracted %q err=%v", extracted, err)
	}

	lreq := httptest.NewRequest("GET", "/api/vendors/att-vnd/sku-proposals/"+prop.ID+"/attachments", nil)
	lreq.SetPathValue("id", "att-vnd")
	lreq.SetPathValue("skuId", prop.ID)
	lreq = lreq.WithContext(context.WithValue(lreq.Context(), actorKey{}, actor{Kind: "vendor", ID: "att-vnd"}))
	lrec := httptest.NewRecorder()
	listSkuAttachments(db)(lrec, lreq)
	if lrec.Code != 200 || !strings.Contains(lrec.Body.String(), "x.png") || !strings.Contains(lrec.Body.String(), "brosur.pdf") {
		t.Fatalf("list %d %s", lrec.Code, lrec.Body)
	}

	dreq := httptest.NewRequest("DELETE", "/api/vendors/att-vnd/sku-proposals/"+prop.ID+"/attachments/"+att.ID, nil)
	dreq.SetPathValue("id", "att-vnd")
	dreq.SetPathValue("skuId", prop.ID)
	dreq.SetPathValue("attId", att.ID)
	drec := httptest.NewRecorder()
	deleteSkuAttachment(db)(drec, dreq)
	if drec.Code != 204 {
		t.Fatalf("delete %d %s", drec.Code, drec.Body)
	}
}

func TestSkuProposalAIStandard(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO vendors (id, company_name, status, pic) VALUES ('ai-vnd', 'AI Co', 'prospect', '{"name":"A","email":"ai@example.com","phone":"081244444444"}') ON CONFLICT (id) DO NOTHING`)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/api/vendors/ai-vnd/sku-proposals", strings.NewReader(`{"commodityName":"Surgical gloves latex powder free ambidextrous","generalSpec":"Natural rubber latex examination gloves, powder-free, ambidextrous, textured, blue, S/M/L/XL, AQL 1.5, EN455 and ASTM.","level1":"DRUGS & CONSUMABLE"}`))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", "ai-vnd")
	rec := httptest.NewRecorder()
	postSkuProposal(db)(rec, req)
	if rec.Code != 200 {
		t.Fatalf("propose %d %s", rec.Code, rec.Body)
	}
	var prop struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &prop)

	aiReq := httptest.NewRequest("POST", "/api/staff/sku-proposals/"+prop.ID+"/ai-standard", strings.NewReader(`{"commodityName":"Examination Gloves Latex Powder Free","generalSpec":"Latex, powder free, textured, AQL 1.5, size S–XL, EN 455 / ASTM.","level1":"DRUGS & CONSUMABLE","level2":"CONSUMABLE","level3":"GLOVES","level4":"EXAM","attributes":{"Material":"Latex","AQL":"1.5"},"model":"test-model"}`))
	aiReq.Header.Set("Content-Type", "application/json")
	aiReq.SetPathValue("id", prop.ID)
	aiRec := httptest.NewRecorder()
	saveSkuProposalAI(db)(aiRec, aiReq)
	if aiRec.Code != 200 || !strings.Contains(aiRec.Body.String(), "Examination Gloves") || !strings.Contains(aiRec.Body.String(), "Natural rubber") {
		t.Fatalf("ai save %d %s", aiRec.Code, aiRec.Body)
	}
	var rawName, rawSpec, aiName string
	if err := db.QueryRow(`SELECT source_row->>'rawName', source_row->>'rawSpec', source_row->'ai'->>'commodityName' FROM master_skus WHERE id=$1`, prop.ID).Scan(&rawName, &rawSpec, &aiName); err != nil || !strings.Contains(rawName, "Surgical") || !strings.Contains(rawSpec, "Natural rubber") || aiName != "Examination Gloves Latex Powder Free" {
		t.Fatalf("layers rawName=%q rawSpec=%q ai=%q err=%v", rawName, rawSpec, aiName, err)
	}

	ok := httptest.NewRequest("POST", "/api/staff/sku-proposals/"+prop.ID+"/review", strings.NewReader(`{"decision":"approve","commodityName":"Examination Gloves Latex Powder Free","generalSpec":"Latex, powder free, textured, AQL 1.5","level2":"CONSUMABLE","level3":"GLOVES","level4":"EXAM"}`))
	ok.Header.Set("Content-Type", "application/json")
	ok.SetPathValue("id", prop.ID)
	orec := httptest.NewRecorder()
	reviewSkuProposal(db)(orec, ok)
	if orec.Code != 200 {
		t.Fatalf("approve %d %s", orec.Code, orec.Body)
	}
	var name, spec, status string
	var open bool
	if err := db.QueryRow(`SELECT commodity_name, general_spec, status, is_open_for_vendor, source_row->>'rawSpec' FROM master_skus WHERE id=$1`, prop.ID).Scan(&name, &spec, &status, &open, &rawSpec); err != nil || name != "Examination Gloves Latex Powder Free" || !strings.Contains(spec, "powder free") || status != "active" || !open || !strings.Contains(rawSpec, "Natural rubber") {
		t.Fatalf("approved name=%q spec=%q status=%s open=%v raw=%q err=%v", name, spec, status, open, rawSpec, err)
	}
}

func TestStaffDiscoverySearch(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`
		INSERT INTO vendors (id, company_name, status, pic) VALUES
		('disc-vnd', 'Discovery Vendor', 'prospect', '{"name":"D","email":"disc@example.com","phone":"081266677788"}')
		ON CONFLICT (id) DO NOTHING`)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/api/vendors/disc-vnd/sku-proposals", strings.NewReader(`{"commodityName":"Examination Gloves Discovery","generalSpec":"Latex powder free AQL 1.5 for discovery test","level1":"DRUGS & CONSUMABLE"}`))
	req.Header.Set("Content-Type", "application/json")
	req.SetPathValue("id", "disc-vnd")
	rec := httptest.NewRecorder()
	postSkuProposal(db)(rec, req)
	if rec.Code != 200 {
		t.Fatalf("propose %d %s", rec.Code, rec.Body)
	}
	var prop struct{ ID string `json:"id"` }
	_ = json.Unmarshal(rec.Body.Bytes(), &prop)
	pdf := []byte("%PDF-1.4\n(sarung tangan latex AQL 1.5 discovery brochure)\n%%EOF")
	pb64 := base64.StdEncoding.EncodeToString(pdf)
	preq := httptest.NewRequest("POST", "/api/vendors/disc-vnd/sku-proposals/"+prop.ID+"/attachments", strings.NewReader(`{"kind":"brochure","filename":"d.pdf","contentType":"application/pdf","dataBase64":"`+pb64+`"}`))
	preq.Header.Set("Content-Type", "application/json")
	preq.SetPathValue("id", "disc-vnd")
	preq.SetPathValue("skuId", prop.ID)
	prec := httptest.NewRecorder()
	postSkuAttachment(db)(prec, preq)
	if prec.Code != 200 {
		t.Fatalf("pdf %d %s", prec.Code, prec.Body)
	}

	empty := httptest.NewRecorder()
	staffDiscoverySearch(db)(empty, httptest.NewRequest("GET", "/api/staff/discovery/search?q=a", nil))
	if empty.Code != 200 || empty.Body.String() != "[]\n" && empty.Body.String() != "[]" {
		// allow pretty/no newline
		if empty.Code != 200 || !strings.Contains(empty.Body.String(), "[]") {
			t.Fatalf("short q %d %s", empty.Code, empty.Body)
		}
	}

	sreq := httptest.NewRequest("GET", "/api/staff/discovery/search?q="+url.QueryEscape("AQL 1.5"), nil)
	srec := httptest.NewRecorder()
	staffDiscoverySearch(db)(srec, sreq)
	if srec.Code != 200 || !strings.Contains(srec.Body.String(), prop.ID) || !strings.Contains(srec.Body.String(), "disc@example.com") {
		t.Fatalf("search spek %d %s", srec.Code, srec.Body)
	}

	breq := httptest.NewRequest("GET", "/api/staff/discovery/search?q="+url.QueryEscape("discovery brochure"), nil)
	brec := httptest.NewRecorder()
	staffDiscoverySearch(db)(brec, breq)
	if brec.Code != 200 || !strings.Contains(brec.Body.String(), `"matchField": "brosur"`) && !strings.Contains(brec.Body.String(), `"matchField":"brosur"`) {
		t.Fatalf("search brosur %d %s", brec.Code, brec.Body)
	}
	if !strings.Contains(brec.Body.String(), "Discovery Vendor") {
		t.Fatalf("missing vendor %s", brec.Body)
	}
}
