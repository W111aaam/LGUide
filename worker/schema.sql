CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT,
  username_normalized TEXT,
  password_hash TEXT,
  password_salt TEXT,
  password_iterations INTEGER,
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

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_normalized
ON users(username_normalized);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS blackboard_connections (
  user_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_sync_at TEXT,
  source TEXT NOT NULL DEFAULT 'bbwatch',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS blackboard_courses (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_name TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS blackboard_tasks (
  user_id TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_name TEXT,
  title TEXT NOT NULL,
  due_utc TEXT,
  status TEXT NOT NULL,
  score REAL,
  content_id TEXT,
  manual_done INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, entity_key),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS blackboard_announcements (
  user_id TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_name TEXT,
  title TEXT NOT NULL,
  body TEXT,
  created_utc TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, entity_key),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS blackboard_materials (
  user_id TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_name TEXT,
  title TEXT NOT NULL,
  handler TEXT,
  modified_utc TEXT,
  local_path TEXT,
  downloaded INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, entity_key),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
