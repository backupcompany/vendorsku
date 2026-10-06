-- One live email code per account. id is sha256 of the challenge token the browser holds;
-- code_hash is sha256(token:code), so a leaked table cannot be replayed or brute-forced offline.
CREATE TABLE IF NOT EXISTS otp_challenges (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('vendor', 'staff')),
  actor_id text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (kind, actor_id)
);
