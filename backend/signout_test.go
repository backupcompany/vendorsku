package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSignOutDeletesSessionSoCookieCannotReuse(t *testing.T) {
	db, err := openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	unlockSeedPasswords(t, db)

	token, err := issueSession(t.Context(), db, "vendor", "vnd-001")
	if err != nil {
		t.Fatal(err)
	}

	signOut := postSignOut(db)
	req := httptest.NewRequest("POST", "/api/sign-out", nil)
	req.Header.Set(realmHeader, "vendor")
	req.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: token})
	rec := httptest.NewRecorder()
	signOut(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("sign-out status %d", rec.Code)
	}

	var n int
	if err := db.QueryRow(`SELECT count(*) FROM sessions WHERE id = $1`, tokenHash(token)).Scan(&n); err != nil || n != 0 {
		t.Fatalf("session row still present: n=%d err=%v", n, err)
	}

	// Same cookie must no longer authenticate.
	guarded := guard(db, anySession, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	probe := httptest.NewRequest("GET", "/api/x", nil)
	probe.Header.Set(realmHeader, "vendor")
	probe.AddCookie(&http.Cookie{Name: sessionCookieName("vendor"), Value: token})
	prec := httptest.NewRecorder()
	guarded(prec, probe)
	if prec.Code != http.StatusUnauthorized {
		t.Fatalf("reused cookie want 401, got %d", prec.Code)
	}
}
