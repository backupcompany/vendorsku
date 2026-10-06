package main

import (
	"database/sql"
	"errors"
	"log"
	"net/http"

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
