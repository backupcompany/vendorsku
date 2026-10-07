package main

import (
	"net/http"
	"testing"
)

func TestAppBaseURLUsesPortalDNS(t *testing.T) {
	t.Setenv("PUBLIC_APP_URL", "")
	r, _ := http.NewRequest("POST", "http://127.0.0.1:8096/api/password/forgot", nil)
	r.Host = "127.0.0.1:8096"
	if got := appBaseURL(r); got != defaultPublicAppURL {
		t.Fatalf("default got %q", got)
	}

	t.Setenv("PUBLIC_APP_URL", "https://staging.example.com/")
	if got := appBaseURL(r); got != "https://staging.example.com" {
		t.Fatalf("override got %q", got)
	}

	t.Setenv("PUBLIC_APP_URL", "http://127.0.0.1:3000")
	if got := appBaseURL(r); got != defaultPublicAppURL {
		t.Fatalf("loopback override should fall back, got %q", got)
	}
}
