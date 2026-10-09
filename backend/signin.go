package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

type dbx interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

type vendorForm struct {
	CompanyName      string `json:"companyName"`
	Email            string `json:"email"`
	Phone            string `json:"phone"`
	AuthorizedPerson string `json:"authorizedPerson"`
	NPWP             string `json:"npwp"`
	Password         string `json:"password"`
}

func postVendor(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in vendorForm
		if !readForm(w, r, &in) {
			return
		}
		caller, signedIn, err := sessionActor(r, db)
		if err != nil {
			log.Println(err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Gagal memeriksa sesi."})
			return
		}
		byStaff := signedIn && caller.Kind == "staff"
		ip := ""
		if !byStaff {
			ip = clientIP(r)
			// Per-IP only — a global "register" key used to lock every visitor after 5 signups.
			if wait := signInThrottle.wait("register:"+ip, ip); wait > 0 {
				w.Header().Set("Retry-After", strconv.Itoa(int(wait.Seconds())+1))
				writeJSON(w, http.StatusTooManyRequests, map[string]string{
					"error": fmt.Sprintf("Terlalu banyak pendaftaran dari jaringan ini. Coba lagi dalam %d menit.", int(wait.Minutes())+1),
				})
				return
			}
		}
		doc, status, msg := createVendor(r.Context(), db, byStaff, in)
		if msg != "" {
			if ip != "" {
				signInThrottle.fail("register:"+ip, ip)
			}
			writeJSON(w, status, map[string]string{"error": msg})
			return
		}
		if byStaff {
			writeJSON(w, status, map[string]any{"vendor": json.RawMessage(doc)})
			return
		}
		var id struct {
			ID string `json:"id"`
		}
		json.Unmarshal(doc, &id)
		startOTP(w, r, db, "vendor", id.ID, status, map[string]any{"vendor": json.RawMessage(doc)},
			"Akun sudah dibuat, tetapi kode verifikasi gagal dikirim. Masuk dengan email dan password untuk meminta kode baru.")
	}
}

type signInFn func(ctx context.Context, q dbx, identifier, password string) ([]byte, string, int, string)

// postSignInAs throttles by account and client IP before bcrypt runs; a correct password only earns an email code.
func postSignInAs(db *sql.DB, kind string, signIn signInFn) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Identifier string `json:"identifier"`
			Password   string `json:"password"`
		}
		if !readForm(w, r, &in) {
			return
		}
		account, ip := kind+":"+strings.ToLower(strings.TrimSpace(in.Identifier)), clientIP(r)
		if wait := signInThrottle.wait(account, ip); wait > 0 {
			w.Header().Set("Retry-After", strconv.Itoa(int(wait.Seconds())+1))
			writeJSON(w, http.StatusTooManyRequests, map[string]string{
				"error": fmt.Sprintf("Terlalu banyak percobaan masuk. Coba lagi dalam %d menit.", int(wait.Minutes())+1),
			})
			return
		}
		_, actorID, status, msg := signIn(r.Context(), db, in.Identifier, in.Password)
		// Only count wrong secrets — 403 (no password / common password) is not a guess.
		if status == http.StatusUnauthorized {
			signInThrottle.fail(account, ip)
		}
		if msg != "" {
			writeJSON(w, status, map[string]string{"error": msg})
			return
		}
		signInThrottle.clear(account)
		signInThrottle.clear("ip:" + ip)
		startOTP(w, r, db, kind, actorID, http.StatusOK, nil, "Gagal mengirim kode verifikasi ke email. Coba lagi.")
	}
}

func readForm(w http.ResponseWriter, r *http.Request, dest any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	if err := dec.Decode(dest); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Form tidak valid."})
		return false
	}
	io.Copy(io.Discard, r.Body)
	return true
}

var mobilePhone = regexp.MustCompile(`^(\+?62|0)8\d{7,12}$`)

// createVendor lets staff leave the password empty; that account cannot sign in until a reset flow exists.
func createVendor(ctx context.Context, q dbx, byStaff bool, in vendorForm) ([]byte, int, string) {
	company := strings.TrimSpace(in.CompanyName)
	email := strings.ToLower(strings.TrimSpace(in.Email))
	phone := strings.TrimSpace(in.Phone)
	name := strings.TrimSpace(in.AuthorizedPerson)
	if company == "" {
		return nil, http.StatusBadRequest, "Nama perusahaan wajib diisi."
	}
	if !validEmail(email) {
		return nil, http.StatusBadRequest, "Email PIC wajib diisi."
	}
	if phone == "" {
		return nil, http.StatusBadRequest, "Nomor WhatsApp PIC wajib diisi."
	}
	// ERP and staff records may carry office lines; a self-registering vendor must give a reachable WhatsApp.
	if !byStaff && !mobilePhone.MatchString(strings.NewReplacer(" ", "", "-", "", "(", "", ")", "", ".", "").Replace(phone)) {
		return nil, http.StatusBadRequest, "Nomor WhatsApp harus nomor seluler Indonesia, contoh 0812-3456-7890."
	}
	if !(byStaff && in.Password == "") {
		if problem := passwordProblem(in.Password, email); problem != "" {
			return nil, http.StatusBadRequest, problem
		}
	}
	npwp, ok := canonicalNPWP(in.NPWP)
	if !ok {
		return nil, http.StatusBadRequest, "NPWP harus 15 atau 16 digit."
	}
	pic := map[string]any{"email": email, "phone": phone, "name": nil}
	if name != "" {
		pic["name"] = name
	}
	picJSON, err := json.Marshal(pic)
	if err != nil {
		return nil, http.StatusInternalServerError, "Gagal menyimpan form."
	}
	var hash any
	if in.Password != "" {
		made, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, http.StatusInternalServerError, "Gagal menyimpan form."
		}
		hash = string(made)
	}
	source := "self_registered"
	if byStaff {
		source = "manual_admin"
	}
	id, err := newID("vnd-")
	if err != nil {
		return nil, http.StatusInternalServerError, "Gagal menyimpan form."
	}
	var doc []byte
	_, err = q.ExecContext(ctx, `
		INSERT INTO vendors (
			id, company_name, npwp, status, source, pic, password_hash, password_created_at, registration_date
		) VALUES ($1, $2, $3, 'prospect', $6, $4::jsonb, $5, CASE WHEN $5::text IS NULL THEN NULL ELSE now() END, now())
	`, id, company, npwp, picJSON, hash, source)
	if err == nil {
		err = q.QueryRowContext(ctx, `SELECT vendor_doc($1)`, id).Scan(&doc)
	}
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			if strings.Contains(pgErr.ConstraintName, "npwp") {
				return nil, http.StatusConflict, "NPWP sudah dipakai rekanan lain."
			}
			return nil, http.StatusConflict, "Email PIC sudah dipakai rekanan lain."
		}
		log.Println(err)
		return nil, http.StatusInternalServerError, "Gagal menyimpan form."
	}
	return doc, http.StatusCreated, ""
}

func signInVendor(ctx context.Context, q dbx, identifier, password string) ([]byte, string, int, string) {
	if strings.TrimSpace(identifier) == "" || password == "" {
		return nil, "", http.StatusBadRequest, "Email / NPWP dan password wajib diisi."
	}
	kind, value, ok := vendorSignKey(identifier)
	if !ok {
		return nil, "", http.StatusBadRequest, "Masuk rekanan memakai email PIC atau NPWP 15/16 digit."
	}
	var id, stored string
	err := q.QueryRowContext(ctx, `
		SELECT v.id, coalesce(v.password_hash, '')
		FROM vendors v
		WHERE ($1 = 'pic_email' AND lower(trim(v.pic->>'email')) = $2)
		   OR ($1 = 'npwp' AND regexp_replace(coalesce(v.npwp, ''), '\D', '', 'g') = $2)
	`, kind, value).Scan(&id, &stored)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Println(err)
		return nil, "", http.StatusInternalServerError, "Gagal memeriksa form masuk."
	}
	if err == nil && stored == "" {
		return nil, "", http.StatusForbidden, "Akun rekanan belum punya password. Minta staf Siloam menyetel password awal, atau daftar ulang dengan password."
	}
	if errors.Is(err, sql.ErrNoRows) {
		bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
	}
	if errors.Is(err, sql.ErrNoRows) || !sameSecret(stored, password) {
		return nil, "", http.StatusUnauthorized, "Email, NPWP, atau password tidak cocok."
	}
	// Matching hash on the common list: force a reset, but do not burn the guess budget (403).
	if commonPasswords[strings.ToLower(password)] {
		return nil, "", http.StatusForbidden, "Password ini sudah tidak diizinkan. Ganti password lewat Lupa password."
	}
	var doc []byte
	if err := q.QueryRowContext(ctx, `SELECT vendor_doc($1)`, id).Scan(&doc); err != nil {
		log.Println(err)
		return nil, "", http.StatusInternalServerError, "Gagal memeriksa form masuk."
	}
	if !docHasSignIn(doc, kind, value) {
		log.Println("vendor sign-in key drifted", id, kind)
		return nil, "", http.StatusInternalServerError, "Gagal memeriksa form masuk."
	}
	body, err := json.Marshal(map[string]any{
		"matched": map[string]string{"kind": kind, "value": value},
		"vendor":  json.RawMessage(doc),
	})
	if err != nil {
		return nil, "", http.StatusInternalServerError, "Gagal memeriksa form masuk."
	}
	return body, id, http.StatusOK, ""
}

func signInStaff(ctx context.Context, q dbx, identifier, password string) ([]byte, string, int, string) {
	if strings.TrimSpace(identifier) == "" || password == "" {
		return nil, "", http.StatusBadRequest, "Username / email dan password wajib diisi."
	}
	kind, value, ok := staffSignKey(identifier)
	if !ok {
		return nil, "", http.StatusBadRequest, "Masuk staf memakai username atau email."
	}
	var id, stored string
	err := q.QueryRowContext(ctx, `
		SELECT a.id, coalesce(a.password_hash, '')
		FROM admin_users a
		WHERE ($1 = 'username' AND lower(trim(a.username)) = $2)
		   OR ($1 = 'email' AND lower(trim(a.email)) = $2)
	`, kind, value).Scan(&id, &stored)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Println(err)
		return nil, "", http.StatusInternalServerError, "Gagal memeriksa form masuk."
	}
	if errors.Is(err, sql.ErrNoRows) {
		bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
	}
	if errors.Is(err, sql.ErrNoRows) || !sameSecret(stored, password) {
		return nil, "", http.StatusUnauthorized, "Username, email, atau password tidak cocok."
	}
	if commonPasswords[strings.ToLower(password)] {
		return nil, "", http.StatusForbidden, "Password ini sudah tidak diizinkan. Ganti password lewat Lupa password."
	}
	var doc []byte
	if err := q.QueryRowContext(ctx, `SELECT staff_doc($1)`, id).Scan(&doc); err != nil {
		log.Println(err)
		return nil, "", http.StatusInternalServerError, "Gagal memeriksa form masuk."
	}
	if !docHasSignIn(doc, kind, value) {
		log.Println("staff sign-in key drifted", id, kind)
		return nil, "", http.StatusInternalServerError, "Gagal memeriksa form masuk."
	}
	body, err := json.Marshal(map[string]any{
		"matched": map[string]string{"kind": kind, "value": value},
		"staff":   json.RawMessage(doc),
	})
	if err != nil {
		return nil, "", http.StatusInternalServerError, "Gagal memeriksa form masuk."
	}
	return body, id, http.StatusOK, ""
}

func validEmail(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	return strings.Contains(email, "@") && !strings.HasPrefix(email, "@") && !strings.HasSuffix(email, "@") && !strings.Contains(email, " ")
}

func vendorSignKey(raw string) (kind, value string, ok bool) {
	raw = strings.TrimSpace(raw)
	if strings.Contains(raw, "@") {
		email := strings.ToLower(raw)
		if !validEmail(email) {
			return "", "", false
		}
		return "pic_email", email, true
	}
	npwp, good := canonicalNPWP(raw)
	digits, _ := npwp.(string)
	if !good || digits == "" {
		return "", "", false
	}
	return "npwp", digits, true
}

func staffSignKey(raw string) (kind, value string, ok bool) {
	raw = strings.TrimSpace(raw)
	if strings.Contains(raw, "@") {
		email := strings.ToLower(raw)
		if !validEmail(email) {
			return "", "", false
		}
		return "email", email, true
	}
	name := strings.ToLower(raw)
	if name == "" {
		return "", "", false
	}
	return "username", name, true
}

func docHasSignIn(doc []byte, kind, value string) bool {
	var parsed struct {
		SignIn []struct {
			Kind  string `json:"kind"`
			Value string `json:"value"`
		} `json:"signIn"`
	}
	if json.Unmarshal(doc, &parsed) != nil {
		return false
	}
	for _, key := range parsed.SignIn {
		if key.Kind == kind && key.Value == value {
			return true
		}
	}
	return false
}

func canonicalNPWP(raw string) (any, bool) {
	digits := strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) {
			return r
		}
		return -1
	}, raw)
	if digits == "" || strings.Trim(digits, "0") == "" {
		return nil, true
	}
	if len(digits) != 15 && len(digits) != 16 {
		return nil, false
	}
	return digits, true
}

func sameSecret(stored, given string) bool {
	if stored == "" || given == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(stored), []byte(given)) == nil
}

// dummyHash gives unknown accounts the same bcrypt cost as wrong passwords, so timing does not reveal accounts.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("siloam-unknown-account"), bcrypt.DefaultCost)

var commonPasswords = map[string]bool{
	"password1": true, "password123": true, "passw0rd": true, "p@ssw0rd": true, "12345678a": true,
	"a12345678": true, "abc12345": true, "abcd1234": true, "qwerty123": true, "qwerty12": true,
	"1qaz2wsx": true, "admin123": true, "admin1234": true, "siloam123": true, "siloam2026": true,
	"vendor123": true, "rahasia123": true, "bismillah1": true, "welcome1": true, "iloveyou1": true,
}

// passwordProblem is the rule for every new password; src/core/auth/signInRules.ts mirrors it.
func passwordProblem(password, email string) string {
	var letter, digit bool
	for _, r := range password {
		letter = letter || unicode.IsLetter(r)
		digit = digit || unicode.IsDigit(r)
	}
	lower := strings.ToLower(password)
	local, _, _ := strings.Cut(strings.ToLower(strings.TrimSpace(email)), "@")
	switch {
	case utf8.RuneCountInString(password) < 8:
		return "Password minimal 8 karakter."
	case len(password) > 72:
		return "Password maksimal 72 karakter."
	case strings.TrimSpace(password) != password:
		return "Password tidak boleh diawali atau diakhiri spasi."
	case !letter || !digit:
		return "Password wajib berisi huruf dan angka."
	case commonPasswords[lower]:
		return "Password terlalu umum. Pilih yang lain."
	case len(local) >= 4 && strings.Contains(lower, local):
		return "Password tidak boleh memuat nama email."
	}
	return ""
}

func newID(prefix string) (string, error) {
	buf := make([]byte, 4)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(buf), nil
}
