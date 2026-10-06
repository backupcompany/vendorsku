package main

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	failWindow     = 15 * time.Minute
	maxFailsPerKey = 5
	maxFailsPerIP  = 30
)

// throttle counts failed sign-ins per account and per client IP inside a sliding window.
type throttle struct {
	mu    sync.Mutex
	fails map[string][]time.Time
}

var signInThrottle = &throttle{fails: map[string][]time.Time{}}

func (t *throttle) recent(key string, now time.Time) []time.Time {
	kept := t.fails[key][:0]
	for _, at := range t.fails[key] {
		if now.Sub(at) < failWindow {
			kept = append(kept, at)
		}
	}
	if len(kept) == 0 {
		delete(t.fails, key)
		return nil
	}
	t.fails[key] = kept
	return kept
}

// wait returns how long the caller must back off, or 0 when another attempt is allowed.
func (t *throttle) wait(account, ip string) time.Duration {
	t.mu.Lock()
	defer t.mu.Unlock()
	now := time.Now()
	var longest time.Duration
	for _, c := range []struct {
		key   string
		limit int
	}{{account, maxFailsPerKey}, {"ip:" + ip, maxFailsPerIP}} {
		if fails := t.recent(c.key, now); len(fails) >= c.limit {
			if d := fails[len(fails)-c.limit].Add(failWindow).Sub(now); d > longest {
				longest = d
			}
		}
	}
	return longest
}

func (t *throttle) fail(account, ip string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	now := time.Now()
	t.fails[account] = append(t.fails[account], now)
	t.fails["ip:"+ip] = append(t.fails["ip:"+ip], now)
}

func (t *throttle) clear(account string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.fails, account)
}

// clientIP trusts X-Forwarded-For only from the local BFF, and takes the hop that proxy appended.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if ip := net.ParseIP(host); ip != nil && ip.IsLoopback() {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			return strings.TrimSpace(parts[len(parts)-1])
		}
	}
	return host
}
