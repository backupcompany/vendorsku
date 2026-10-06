package main

import (
	"context"
	"database/sql"
	"log"
	"math"
	"net/http"
	"strings"
)

const aiLogDoc = `jsonb_build_object(
	'id', l.id,
	'sessionId', l.session_id,
	'timestamp', l.logged_at,
	'model', l.model,
	'action', l.action,
	'promptPreview', l.prompt_preview,
	'tokensUsed', l.tokens_used,
	'estimatedCostUsd', l.estimated_cost_usd
)`

type aiLogIn struct {
	SessionID     string `json:"sessionId"`
	Action        string `json:"action"`
	PromptPreview string `json:"promptPreview"`
	TokensUsed    int    `json:"tokensUsed"`
	Model         string `json:"model"`
}

func listAiLogs(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeQuery(w, db.QueryRowContext(r.Context(), `
			SELECT coalesce(jsonb_agg(doc ORDER BY logged_at DESC), '[]'::jsonb)
			FROM (
				SELECT `+aiLogDoc+` AS doc, l.logged_at
				FROM ai_logs l
			) q
		`))
	}
}

func postAiLog(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in aiLogIn
		if !readForm(w, r, &in) {
			return
		}
		raw, code, msg := saveAiLog(r.Context(), db, in)
		if msg != "" {
			writeJSON(w, code, map[string]string{"error": msg})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		w.Write(raw)
	}
}

func saveAiLog(ctx context.Context, q dbx, in aiLogIn) ([]byte, int, string) {
	sessionID := strings.TrimSpace(in.SessionID)
	model := strings.TrimSpace(in.Model)
	preview := strings.TrimSpace(in.PromptPreview)
	switch in.Action {
	case "sku_parse", "tender_analysis", "rag_search", "chat_assist":
	default:
		return nil, http.StatusBadRequest, "Aksi log AI tidak dikenal."
	}
	if sessionID == "" || model == "" || preview == "" {
		return nil, http.StatusBadRequest, "Sesi, model, dan cuplikan prompt wajib diisi."
	}
	if in.TokensUsed < 0 {
		return nil, http.StatusBadRequest, "Jumlah token tidak boleh minus."
	}
	if len([]rune(preview)) > 120 {
		preview = string([]rune(preview)[:120])
	}
	id, err := newID("log-")
	if err != nil {
		return nil, http.StatusInternalServerError, "Gagal menyimpan log AI."
	}
	cost := math.Round((float64(in.TokensUsed)/1000000)*0.15*1e6) / 1e6
	if _, err = q.ExecContext(ctx, `
		INSERT INTO ai_logs (id, session_id, logged_at, model, action, prompt_preview, tokens_used, estimated_cost_usd)
		VALUES ($1, $2, now(), $3, $4, $5, $6, $7)
	`, id, sessionID, model, in.Action, preview, in.TokensUsed, cost); err != nil {
		log.Println(err)
		return nil, http.StatusInternalServerError, "Gagal menyimpan log AI."
	}
	var raw []byte
	if err = q.QueryRowContext(ctx, `SELECT `+aiLogDoc+` FROM ai_logs l WHERE id = $1`, id).Scan(&raw); err != nil {
		log.Println(err)
		return nil, http.StatusInternalServerError, "Gagal menyimpan log AI."
	}
	return raw, http.StatusCreated, ""
}
