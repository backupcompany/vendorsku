package main

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSkuTaxonomyAndSearchRequireSession(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}

	cache := newBodyCache()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/skus/taxonomy", guard(db, anySession, cachedQuery(db, cache, func(*http.Request) string { return "taxonomy" },
		func(r *http.Request) *sql.Row { return db.QueryRowContext(r.Context(), skuTaxonomy) })))
	mux.HandleFunc("GET /api/skus/search", guard(db, anySession, skuSearch(db)))

	for _, path := range []string{"/api/skus/taxonomy", "/api/skus/search?q=spuit"} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s: want 401, got %d body %s", path, rec.Code, rec.Body.String())
		}
	}
}
