package main

import (
	"net/http"
	"os"
	"testing"
)

func TestAppBaseURLPrefersPublicAndRejectsLoopback(t *testing.T) {
	t.Setenv("PUBLIC_APP_URL", "https://submityourproduct.cgp-ai.com/")
	r, _ := http.NewRequest("POST", "http://127.0.0.1:8096/api/password/forgot", nil)
	r.Host = "127.0.0.1:8096"
	r.Header.Set("Origin", "http://127.0.0.1:3060")
	if got := appBaseURL(r); got != "https://submityourproduct.cgp-ai.com" {
		t.Fatalf("got %q", got)
	}

	os.Unsetenv("PUBLIC_APP_URL")
	r2, _ := http.NewRequest("POST", "http://127.0.0.1:8096/api/password/forgot", nil)
	r2.Host = "127.0.0.1:8096"
	if got := appBaseURL(r2); got != "" {
		t.Fatalf("loopback should be empty, got %q", got)
	}

	r3, _ := http.NewRequest("POST", "/", nil)
	r3.Header.Set("X-Forwarded-Host", "submityourproduct.cgp-ai.com")
	r3.Header.Set("X-Forwarded-Proto", "https")
	r3.Host = "127.0.0.1:8096"
	if got := appBaseURL(r3); got != "https://submityourproduct.cgp-ai.com" {
		t.Fatalf("fwd host got %q", got)
	}
}
