package main

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

const hospitalObjectSQL = `jsonb_build_object(
	'id', id, 'code', code, 'name', name, 'city', city, 'province', province,
	'island', island, 'type', type, 'bedCapacity', bed_capacity,
	'address', address, 'phone', phone, 'isActive', is_active,
	'createdAt', created_at, 'updatedAt', updated_at
)`

// Public list omits phone/address/bedCapacity — those stay staff-only.
const hospitalPublicSQL = `jsonb_build_object(
	'id', id, 'code', code, 'name', name, 'city', city, 'province', province,
	'island', island, 'type', type, 'isActive', is_active
)`

func listHospitals(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cols := hospitalPublicSQL
		if a, ok, err := sessionActor(r, db); err == nil && ok && a.Kind == "staff" {
			cols = hospitalObjectSQL
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `SELECT coalesce(jsonb_agg(`+cols+` ORDER BY name), '[]'::jsonb) FROM hospitals`))
	}
}

type hospitalForm struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	City        string `json:"city"`
	Province    string `json:"province"`
	Island      string `json:"island"`
	Type        string `json:"type"`
	BedCapacity int    `json:"bedCapacity"`
	Address     string `json:"address"`
	Phone       string `json:"phone"`
	IsActive    *bool  `json:"isActive"`
}

func postHospital(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in hospitalForm
		if !readForm(w, r, &in) {
			return
		}
		name := strings.TrimSpace(in.Name)
		city := strings.TrimSpace(in.City)
		if name == "" || city == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Nama dan kota rumah sakit wajib diisi."})
			return
		}
		code := strings.ToUpper(strings.TrimSpace(in.Code))
		if code == "" {
			code = strings.ToUpper(name)
			if len(code) > 4 {
				code = code[:4]
			}
		}
		id := strings.TrimSpace(in.ID)
		if id == "" {
			var err error
			id, err = newID("hosp-")
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan rumah sakit."})
				return
			}
		}
		island := strings.TrimSpace(in.Island)
		if island == "" {
			island = "Jawa"
		}
		kind := strings.TrimSpace(in.Type)
		if kind == "" {
			kind = "Rumah Sakit Umum"
		}
		active := true
		if in.IsActive != nil {
			active = *in.IsActive
		}
		_, err := db.ExecContext(r.Context(), `
			INSERT INTO hospitals (
				id, code, name, city, province, island, type, bed_capacity, address, phone, is_active, created_at, updated_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now(), now())
			ON CONFLICT (id) DO UPDATE SET
				code = EXCLUDED.code,
				name = EXCLUDED.name,
				city = EXCLUDED.city,
				province = EXCLUDED.province,
				island = EXCLUDED.island,
				type = EXCLUDED.type,
				bed_capacity = EXCLUDED.bed_capacity,
				address = EXCLUDED.address,
				phone = EXCLUDED.phone,
				is_active = EXCLUDED.is_active,
				updated_at = now()
		`, id, code, name, city, strings.TrimSpace(in.Province), island, kind, in.BedCapacity, emptyNil(in.Address), emptyNil(in.Phone), active)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "Kode unit sudah dipakai rumah sakit lain."})
				return
			}
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menyimpan rumah sakit."})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `SELECT `+hospitalObjectSQL+` FROM hospitals WHERE id = $1`, id))
	}
}

func patchHospital(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			IsActive *bool `json:"isActive"`
		}
		if !readForm(w, r, &in) {
			return
		}
		if in.IsActive == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Status rumah sakit wajib diisi."})
			return
		}
		id := r.PathValue("id")
		res, err := db.ExecContext(r.Context(), `UPDATE hospitals SET is_active = $2, updated_at = now() WHERE id = $1`, id, *in.IsActive)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal mengubah rumah sakit."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Rumah sakit tidak ditemukan."})
			return
		}
		writeQuery(w, db.QueryRowContext(r.Context(), `SELECT `+hospitalObjectSQL+` FROM hospitals WHERE id = $1`, id))
	}
}

func deleteHospital(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, err := db.ExecContext(r.Context(), `DELETE FROM hospitals WHERE id = $1`, r.PathValue("id"))
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal menghapus rumah sakit."})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Rumah sakit tidak ditemukan."})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
