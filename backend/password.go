package main

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

type changePasswordForm struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// postChangePassword updates password_hash for the signed-in vendor or staff account.
func postChangePassword(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, ok := actorFrom(r.Context())
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Sesi tidak valid."})
			return
		}
		var in changePasswordForm
		if !readForm(w, r, &in) {
			return
		}
		if in.CurrentPassword == "" || in.NewPassword == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Password lama dan password baru wajib diisi."})
			return
		}

		var stored, email string
		var q string
		switch a.Kind {
		case "vendor":
			q = `SELECT coalesce(password_hash, ''), coalesce(lower(trim(pic->>'email')), '') FROM vendors WHERE id = $1`
		case "staff":
			q = `SELECT coalesce(password_hash, ''), coalesce(lower(trim(email)), '') FROM admin_users WHERE id = $1`
		default:
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akses ditolak."})
			return
		}
		if err := db.QueryRowContext(r.Context(), q, a.ID).Scan(&stored, &email); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "Akun tidak ditemukan."})
				return
			}
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengubah password."})
			return
		}
		if stored == "" || bcrypt.CompareHashAndPassword([]byte(stored), []byte(in.CurrentPassword)) != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Password lama tidak cocok."})
			return
		}
		if problem := passwordProblem(in.NewPassword, email); problem != "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
			return
		}
		if in.NewPassword == in.CurrentPassword {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Password baru harus berbeda dari password lama."})
			return
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(in.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengubah password."})
			return
		}

		var exec string
		switch a.Kind {
		case "vendor":
			exec = `UPDATE vendors SET password_hash = $1, password_created_at = now() WHERE id = $2`
		case "staff":
			exec = `UPDATE admin_users SET password_hash = $1 WHERE id = $2`
		}
		if _, err := db.ExecContext(r.Context(), exec, string(hash), a.ID); err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan password baru."})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}

func writeForgotChallenge(w http.ResponseWriter, challenge, email string) {
	if challenge == "" {
		raw := make([]byte, 32)
		rand.Read(raw)
		challenge = hex.EncodeToString(raw)
	}
	if email == "" {
		email = "••••@••••"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"otpRequired": true,
		"challenge":   challenge,
		"email":       email,
		"expiresIn":   int(otpTTL.Seconds()),
		"resendIn":    int(otpResendAfter.Seconds()),
	})
}

func findAccountID(ctx context.Context, q dbx, realm, identifier string) (string, error) {
	if realm == "staff" {
		kind, value, ok := staffSignKey(identifier)
		if !ok {
			return "", errBadIdentifier
		}
		var id string
		err := q.QueryRowContext(ctx, `
			SELECT a.id FROM admin_users a
			WHERE ($1 = 'username' AND lower(trim(a.username)) = $2)
			   OR ($1 = 'email' AND lower(trim(a.email)) = $2)
		`, kind, value).Scan(&id)
		return id, err
	}
	kind, value, ok := vendorSignKey(identifier)
	if !ok {
		return "", errBadIdentifier
	}
	var id string
	err := q.QueryRowContext(ctx, `
		SELECT v.id FROM vendors v
		WHERE ($1 = 'pic_email' AND lower(trim(v.pic->>'email')) = $2)
		   OR ($1 = 'npwp' AND regexp_replace(coalesce(v.npwp, ''), '\D', '', 'g') = $2)
	`, kind, value).Scan(&id)
	return id, err
}

var errBadIdentifier = errors.New("bad identifier")

func postForgotPassword(db *sql.DB, realm string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Identifier string `json:"identifier"`
		}
		if !readForm(w, r, &in) {
			return
		}
		account, ip := "reset:"+realm+":"+strings.ToLower(strings.TrimSpace(in.Identifier)), clientIP(r)
		if wait := signInThrottle.wait(account, ip); wait > 0 {
			w.Header().Set("Retry-After", strconv.Itoa(int(wait.Seconds())+1))
			writeJSON(w, http.StatusTooManyRequests, map[string]string{
				"error": fmt.Sprintf("Terlalu banyak permintaan. Coba lagi dalam %d menit.", int(wait.Minutes())+1),
			})
			return
		}
		id, err := findAccountID(r.Context(), db, realm, in.Identifier)
		if errors.Is(err, errBadIdentifier) {
			if realm == "staff" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Masuk staf memakai username atau email."})
			} else {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Masuk rekanan memakai email PIC atau NPWP 15/16 digit."})
			}
			return
		}
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memproses permintaan."})
			return
		}
		if errors.Is(err, sql.ErrNoRows) {
			bcrypt.CompareHashAndPassword(dummyHash, []byte("x"))
			signInThrottle.fail(account, ip)
			writeForgotChallenge(w, "", "")
			return
		}
		email, err := accountEmail(r.Context(), db, realm, id)
		if err != nil || !validEmail(email) {
			bcrypt.CompareHashAndPassword(dummyHash, []byte("x"))
			writeForgotChallenge(w, "", "")
			return
		}
		if wait := signInThrottle.wait(otpKey(realm, id), ip); wait > 0 {
			w.Header().Set("Retry-After", fmt.Sprint(int(wait.Seconds())+1))
			writeJSON(w, http.StatusTooManyRequests, map[string]string{
				"error": fmt.Sprintf("Terlalu banyak kode salah. Coba lagi dalam %d menit.", int(wait.Minutes())+1),
			})
			return
		}
		token, err := issueOTP(r.Context(), db, realm, id, email, true)
		if errors.Is(err, errOTPCooldown) {
			w.Header().Set("Retry-After", fmt.Sprint(int(otpResendAfter.Seconds())))
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "Kode baru sudah dikirim. Tunggu 1 menit sebelum meminta kode lagi."})
			return
		}
		if err != nil {
			log.Println("otp:", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Gagal mengirim kode ke email. Coba lagi."})
			return
		}
		writeForgotChallenge(w, token, maskEmail(email))
	}
}

func postResetPassword(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Challenge   string `json:"challenge"`
			Code        string `json:"code"`
			NewPassword string `json:"newPassword"`
		}
		if !readForm(w, r, &in) {
			return
		}
		code := strings.TrimSpace(in.Code)
		if !otpDigits.MatchString(code) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Kode verifikasi berisi 6 angka."})
			return
		}
		expired := map[string]string{"error": "Kode verifikasi kedaluwarsa atau sudah dipakai. Minta kode baru."}
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
				writeJSON(w, http.StatusGone, map[string]string{"error": "Terlalu banyak kode salah. Minta kode baru."})
				return
			}
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": fmt.Sprintf("Kode verifikasi salah. Sisa %d percobaan.", left)})
			return
		}
		email, err := accountEmail(ctx, tx, kind, actorID)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengatur password."})
			return
		}
		if problem := passwordProblem(in.NewPassword, email); problem != "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": problem})
			return
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(in.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengatur password."})
			return
		}
		var exec string
		switch kind {
		case "vendor":
			exec = `UPDATE vendors SET password_hash = $1, password_created_at = now() WHERE id = $2`
		case "staff":
			exec = `UPDATE admin_users SET password_hash = $1 WHERE id = $2`
		default:
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Akses ditolak."})
			return
		}
		if _, err = tx.ExecContext(ctx, exec, string(hash), actorID); err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan password baru."})
			return
		}
		if _, err = tx.ExecContext(ctx, `DELETE FROM otp_challenges WHERE id = $1`, id); err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengatur password."})
			return
		}
		if _, err = tx.ExecContext(ctx, `DELETE FROM sessions WHERE kind = $1 AND actor_id = $2`, kind, actorID); err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengatur password."})
			return
		}
		if err = tx.Commit(); err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengatur password."})
			return
		}
		signInThrottle.clear(otpKey(kind, actorID))
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}
