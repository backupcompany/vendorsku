package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
)

const (
	otpTTL         = 5 * time.Minute
	otpResendAfter = 60 * time.Second
	otpMaxAttempts = 5
)

var (
	errOTPCooldown = errors.New("otp cooldown")
	otpDigits      = regexp.MustCompile(`^\d{6}$`)
	mailClient     = &http.Client{Timeout: 20 * time.Second}
	sendMail       = webhookMail
)

// webhookMail posts to the Power Automate HTTP trigger; its URL carries the signature, so errors never include it.
func webhookMail(ctx context.Context, to, subject, body string) error {
	endpoint := os.Getenv("MAIL_WEBHOOK_URL")
	if endpoint == "" {
		return errors.New("MAIL_WEBHOOK_URL is not set")
	}
	payload, err := json.Marshal(map[string]any{"to": to, "subject": subject, "body": body, "isHtml": true})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return errors.New("mail webhook: bad request")
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := mailClient.Do(req)
	if err != nil {
		var ue *url.Error
		if errors.As(err, &ue) {
			err = ue.Err
		}
		return fmt.Errorf("mail webhook: %w", err)
	}
	defer res.Body.Close()
	io.Copy(io.Discard, io.LimitReader(res.Body, 1<<16))
	if res.StatusCode/100 != 2 {
		return fmt.Errorf("mail webhook status %d", res.StatusCode)
	}
	return nil
}

func otpHash(token, code string) string {
	sum := sha256.Sum256([]byte(token + ":" + code))
	return hex.EncodeToString(sum[:])
}

func maskEmail(email string) string {
	local, domain, ok := strings.Cut(email, "@")
	if !ok || local == "" {
		return email
	}
	keep := 2
	if len(local) <= 2 {
		keep = 1
	}
	return local[:keep] + strings.Repeat("•", max(len(local)-keep, 3)) + "@" + domain
}

func isLoopbackHost(hostOrURL string) bool {
	h := strings.ToLower(strings.TrimSpace(hostOrURL))
	h = strings.TrimPrefix(strings.TrimPrefix(h, "https://"), "http://")
	if i := strings.IndexAny(h, "/:"); i >= 0 {
		h = h[:i]
	}
	return h == "127.0.0.1" || h == "localhost" || h == "::1" || h == "0.0.0.0"
}

// Prod portal DNS. Override with PUBLIC_APP_URL only for local/staging.
const defaultPublicAppURL = "https://submityourproduct.cgp-ai.com"

func appBaseURL(r *http.Request) string {
	if v := strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_APP_URL")), "/"); v != "" && !isLoopbackHost(v) {
		return v
	}
	return defaultPublicAppURL // never use r.Host — BFF sets it to 127.0.0.1
}

// issueOTP replaces any previous code for the account, so only the newest email works.
// When reset=true and appBase is set, the email includes a one-click link (challenge+code in query).
func issueOTP(ctx context.Context, db *sql.DB, kind, actorID, email string, reset bool, appBase string) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	token, code := hex.EncodeToString(raw), fmt.Sprintf("%06d", n.Int64())
	id := tokenHash(token)

	db.ExecContext(ctx, `DELETE FROM otp_challenges WHERE expires_at < now() - interval '1 day'`)
	var stored string
	err = db.QueryRowContext(ctx, `
		INSERT INTO otp_challenges (id, kind, actor_id, code_hash, expires_at)
		VALUES ($1, $2, $3, $4, now() + $5::interval)
		ON CONFLICT (kind, actor_id) DO UPDATE
		   SET id = excluded.id, code_hash = excluded.code_hash, attempts = 0,
		       created_at = now(), expires_at = excluded.expires_at
		 WHERE otp_challenges.created_at < now() - $6::interval
		RETURNING id
	`, id, kind, actorID, otpHash(token, code), otpTTL.String(), otpResendAfter.String()).Scan(&stored)
	if errors.Is(err, sql.ErrNoRows) {
		return "", errOTPCooldown
	}
	if err != nil {
		return "", err
	}

	minutes := int(otpTTL.Minutes())
	subject := "Kode verifikasi Portal Rekanan"
	var body string
	if reset {
		subject = "Atur ulang password Portal Rekanan"
		path := "/?reset=1"
		if kind == "staff" {
			path = "/admin?reset=1"
		}
		linkBlock := ""
		if appBase != "" {
			href := html.EscapeString(fmt.Sprintf("%s%s&c=%s&k=%s", appBase, path, url.QueryEscape(token), code))
			linkBlock = fmt.Sprintf(`
<p><a href="%s" style="display:inline-block;background:#1B3F9B;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Atur Password Baru</a></p>
<p style="color:#64748b;font-size:12px">Atau salin tautan ini: %s</p>`, href, href)
		}
		body = fmt.Sprintf(`<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:480px">
<p>Yth. Pengguna Portal Rekanan,</p>
<p>Kami menerima permintaan untuk mengatur ulang password akun Anda. Silakan klik tombol berikut untuk melanjutkan:</p>
%s
<p style="color:#64748b;font-size:13px">Jika tombol tidak dapat dibuka, masukkan kode berikut di halaman reset: <b style="letter-spacing:3px;color:#1B3F9B">%s</b></p>
<p style="color:#64748b;font-size:12px">Tautan berlaku %d menit dan hanya dapat digunakan sekali. Jika Anda tidak mengajukan permintaan ini, abaikan email ini.<br/>Akun: %s</p>
</div>`, linkBlock, code, minutes, html.EscapeString(email))
	} else {
		body = fmt.Sprintf(`<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:480px">
<p>Halo,</p>
<p>Gunakan kode berikut untuk masuk ke <b>Portal Rekanan</b>:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#1B3F9B">%s</p>
<p>Kode berlaku %d menit dan hanya bisa dipakai sekali. Kode lama otomatis tidak berlaku.</p>
<p style="color:#64748b;font-size:12px">Jika Anda tidak meminta ini, abaikan email ini. Akun: %s.</p>
</div>`, code, minutes, html.EscapeString(email))
	}
	if err := sendMail(ctx, email, subject, body); err != nil {
		db.ExecContext(context.WithoutCancel(ctx), `DELETE FROM otp_challenges WHERE id = $1`, id)
		return "", err
	}
	return token, nil
}

func otpKey(kind, actorID string) string { return "otp:" + kind + ":" + actorID }

func accountEmail(ctx context.Context, q dbx, kind, actorID string) (string, error) {
	query := `SELECT coalesce(lower(trim(pic->>'email')), '') FROM vendors WHERE id = $1`
	if kind == "staff" {
		query = `SELECT coalesce(lower(trim(email)), '') FROM admin_users WHERE id = $1`
	}
	var email string
	err := q.QueryRowContext(ctx, query, actorID).Scan(&email)
	return email, err
}

// startOTP answers a correct password with a code challenge instead of a session.
func startOTP(w http.ResponseWriter, r *http.Request, db *sql.DB, kind, actorID string, status int, extra map[string]any, mailFail string) {
	if wait := signInThrottle.wait(otpKey(kind, actorID), clientIP(r)); wait > 0 {
		w.Header().Set("Retry-After", fmt.Sprint(int(wait.Seconds())+1))
		writeJSON(w, http.StatusTooManyRequests, map[string]string{
			"error": fmt.Sprintf("Terlalu banyak kode salah. Coba lagi dalam %d menit.", int(wait.Minutes())+1),
		})
		return
	}
	email, err := accountEmail(r.Context(), db, kind, actorID)
	if err != nil || !validEmail(email) {
		if err != nil {
			log.Println(err)
		}
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akun belum punya email aktif untuk kode verifikasi. Hubungi Procurement Siloam."})
		return
	}
	token, err := issueOTP(r.Context(), db, kind, actorID, email, false, "")
	if errors.Is(err, errOTPCooldown) {
		w.Header().Set("Retry-After", fmt.Sprint(int(otpResendAfter.Seconds())))
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "Kode baru sudah dikirim. Tunggu 1 menit sebelum meminta kode lagi."})
		return
	}
	if err != nil {
		log.Println("otp:", err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": mailFail})
		return
	}
	out := map[string]any{
		"otpRequired": true,
		"challenge":   token,
		"email":       maskEmail(email),
		"expiresIn":   int(otpTTL.Seconds()),
		"resendIn":    int(otpResendAfter.Seconds()),
	}
	for k, v := range extra {
		out[k] = v
	}
	writeJSON(w, status, out)
}

func postVerifyOTP(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Challenge string `json:"challenge"`
			Code      string `json:"code"`
		}
		if !readForm(w, r, &in) {
			return
		}
		code := strings.TrimSpace(in.Code)
		if !otpDigits.MatchString(code) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Kode verifikasi berisi 6 angka."})
			return
		}
		expired := map[string]string{"error": "Kode verifikasi kedaluwarsa atau sudah dipakai. Masuk lagi untuk kode baru."}
		if in.Challenge == "" {
			writeJSON(w, http.StatusGone, expired)
			return
		}
		ctx := r.Context()
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memeriksa kode."})
			return
		}
		defer tx.Rollback()
		id := tokenHash(in.Challenge)
		var kind, actorID, stored string
		var attempts int
		err = tx.QueryRowContext(ctx, `
			SELECT kind, actor_id, code_hash, attempts FROM otp_challenges
			WHERE id = $1 AND expires_at > now() FOR UPDATE
		`, id).Scan(&kind, &actorID, &stored, &attempts)
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusGone, expired)
			return
		}
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memeriksa kode."})
			return
		}
		if subtle.ConstantTimeCompare([]byte(stored), []byte(otpHash(in.Challenge, code))) != 1 {
			signInThrottle.fail(otpKey(kind, actorID), clientIP(r))
			left := otpMaxAttempts - attempts - 1
			if left <= 0 {
				_, err = tx.ExecContext(ctx, `DELETE FROM otp_challenges WHERE id = $1`, id)
			} else {
				_, err = tx.ExecContext(ctx, `UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1`, id)
			}
			if err == nil {
				err = tx.Commit()
			}
			if err != nil {
				log.Println(err)
			}
			if left <= 0 {
				writeJSON(w, http.StatusGone, map[string]string{"error": "Terlalu banyak kode salah. Masuk lagi untuk kode baru."})
				return
			}
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": fmt.Sprintf("Kode verifikasi salah. Sisa %d percobaan.", left)})
			return
		}
		docQuery := `SELECT vendor_doc($1)`
		if kind == "staff" {
			docQuery = `SELECT staff_doc($1)`
		}
		var doc json.RawMessage
		if _, err = tx.ExecContext(ctx, `DELETE FROM otp_challenges WHERE id = $1`, id); err == nil {
			err = tx.QueryRowContext(ctx, docQuery, actorID).Scan(&doc)
		}
		var token string
		if err == nil {
			token, err = issueSession(ctx, tx, kind, actorID)
		}
		if err == nil {
			err = tx.Commit()
		}
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal membuat sesi."})
			return
		}
		signInThrottle.clear(otpKey(kind, actorID))
		setSessionCookie(w, r, kind, token)
		writeJSON(w, http.StatusOK, map[string]any{"kind": kind, kind: doc})
	}
}
