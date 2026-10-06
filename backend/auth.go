package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
)

type actor struct {
	Kind string
	ID   string
}

type actorKey struct{}

const (
	sessionTTL    = "12 hours"
	sessionMaxAge = 12 * 60 * 60
	realmHeader   = "X-Session-Realm"
)

func sessionCookieName(kind string) string { return "sku_" + kind + "_session" }

// The token lives only in an HttpOnly cookie, so page scripts never see it.
func setSessionCookie(w http.ResponseWriter, r *http.Request, kind, token string) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookieName(kind), Value: token, Path: "/api", MaxAge: sessionMaxAge,
		HttpOnly: true, Secure: secureRequest(r), SameSite: http.SameSiteStrictMode,
	})
}

func clearSessionCookie(w http.ResponseWriter, r *http.Request, kind string) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookieName(kind), Value: "", Path: "/api", MaxAge: -1,
		HttpOnly: true, Secure: secureRequest(r), SameSite: http.SameSiteStrictMode,
	})
}

func secureRequest(r *http.Request) bool {
	return r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
}

// requestToken needs the realm header as well as the cookie: a cross-site form cannot set custom headers,
// which closes CSRF on top of SameSite=Strict.
func requestToken(r *http.Request) (token, realm string) {
	realm = r.Header.Get(realmHeader)
	if realm != "staff" && realm != "vendor" {
		return "", ""
	}
	c, err := r.Cookie(sessionCookieName(realm))
	if err != nil || c.Value == "" {
		return "", ""
	}
	return c.Value, realm
}

// issueSession stores only the token hash, so a leaked sessions table cannot be replayed.
func issueSession(ctx context.Context, q dbx, kind, actorID string) (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	token := hex.EncodeToString(buf)
	if _, err := q.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at < now()`); err != nil {
		return "", err
	}
	_, err := q.ExecContext(ctx, `
		INSERT INTO sessions (id, kind, actor_id, expires_at) VALUES ($1, $2, $3, now() + $4::interval)
	`, tokenHash(token), kind, actorID, sessionTTL)
	return token, err
}

func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func sessionActor(r *http.Request, db *sql.DB) (actor, bool, error) {
	token, realm := requestToken(r)
	if token == "" {
		return actor{}, false, nil
	}
	var a actor
	err := db.QueryRowContext(r.Context(), `
		SELECT kind, actor_id FROM sessions WHERE id = $1 AND kind = $2 AND expires_at > now()
	`, tokenHash(token), realm).Scan(&a.Kind, &a.ID)
	if errors.Is(err, sql.ErrNoRows) {
		return actor{}, false, nil
	}
	if err != nil {
		return actor{}, false, err
	}
	return a, true, nil
}

func actorFrom(ctx context.Context) (actor, bool) {
	a, ok := ctx.Value(actorKey{}).(actor)
	return a, ok
}

func guard(db *sql.DB, allow func(actor, *http.Request) bool, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		a, ok, err := sessionActor(r, db)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memeriksa sesi."})
			return
		}
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Sesi berakhir. Silakan masuk lagi."})
			return
		}
		if !allow(a, r) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akses ditolak."})
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), actorKey{}, a)))
	}
}

func staffOnly(a actor, _ *http.Request) bool { return a.Kind == "staff" }

func anySession(actor, *http.Request) bool { return true }

func vendorSelf(a actor, r *http.Request) bool {
	return a.Kind == "vendor" && a.ID == r.PathValue("id")
}

func selfOrStaff(a actor, r *http.Request) bool { return a.Kind == "staff" || vendorSelf(a, r) }

// getSession lets a reloaded page restore the signed-in user from the cookie.
func getSession(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		a, ok := actorFrom(r.Context())
		if !ok {
			var err error
			if a, ok, err = sessionActor(r, db); err != nil {
				log.Println(err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memeriksa sesi."})
				return
			}
		}
		if !ok {
			writeJSON(w, http.StatusOK, map[string]any{"kind": nil})
			return
		}
		query := `SELECT vendor_doc($1)`
		if a.Kind == "staff" {
			query = `SELECT staff_doc($1)`
		}
		var doc json.RawMessage
		if err := db.QueryRowContext(r.Context(), query, a.ID).Scan(&doc); err != nil || doc == nil {
			if err != nil && !errors.Is(err, sql.ErrNoRows) {
				log.Println(err)
			}
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Sesi berakhir. Silakan masuk lagi."})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"kind": a.Kind, "actorId": a.ID, a.Kind: doc})
	}
}

func postSignOut(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if token, realm := requestToken(r); token != "" {
			if _, err := db.ExecContext(r.Context(), `DELETE FROM sessions WHERE id = $1`, tokenHash(token)); err != nil {
				log.Println(err)
			}
			clearSessionCookie(w, r, realm)
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
