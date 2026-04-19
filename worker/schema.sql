CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  completed INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_started_at
ON pomodoro_sessions(user_id, started_at);
