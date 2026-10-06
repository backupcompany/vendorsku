package main

import (
	"bytes"
	"compress/gzip"
	"database/sql"
	"io"
	"log"
	"net/http"
	"strconv"
	"sync"
)

type cacheEntry struct {
	version int64
	gz      []byte
}

// bodyCache keeps gzipped JSON per key until data_version moves; auth still runs per request in guard.
type bodyCache struct {
	mu      sync.Mutex
	entries map[string]cacheEntry
}

const cacheMaxEntries = 64

func newBodyCache() *bodyCache { return &bodyCache{entries: map[string]cacheEntry{}} }

func (c *bodyCache) get(key string, version int64) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[key]
	return e.gz, ok && e.version == version
}

func (c *bodyCache) put(key string, version int64, gz []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.entries[key]; !ok && len(c.entries) >= cacheMaxEntries {
		for k := range c.entries {
			delete(c.entries, k)
			break
		}
	}
	c.entries[key] = cacheEntry{version, gz}
}

func cachedQuery(db *sql.DB, c *bodyCache, key func(*http.Request) string, query func(*http.Request) *sql.Row) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var version int64
		if err := db.QueryRowContext(r.Context(), `SELECT v FROM data_version`).Scan(&version); err != nil {
			log.Println(err)
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
		k := key(r)
		gz, ok := c.get(k, version)
		if !ok {
			var raw []byte
			if err := query(r).Scan(&raw); err != nil {
				log.Println(err)
				http.Error(w, "database error", http.StatusInternalServerError)
				return
			}
			if raw == nil {
				http.Error(w, "not found", http.StatusNotFound)
				return
			}
			var buf bytes.Buffer
			zw := gzip.NewWriter(&buf)
			zw.Write(raw)
			zw.Close()
			gz = buf.Bytes()
			c.put(k, version, gz)
		}
		w.Header().Set("Content-Type", "application/json")
		if gw, ok := w.(*gzipWriter); ok {
			w.Header().Set("Content-Length", strconv.Itoa(len(gz)))
			gw.ResponseWriter.Write(gz)
			return
		}
		zr, err := gzip.NewReader(bytes.NewReader(gz))
		if err != nil {
			log.Println(err)
			http.Error(w, "cache error", http.StatusInternalServerError)
			return
		}
		io.Copy(w, zr)
	}
}
