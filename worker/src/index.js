const SESSION_COOKIE_NAME = "lguide_session";
const AUTHORIZATION_PREFIX = "Bearer ";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 100000;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,24}$/;
const textEncoder = new TextEncoder();

const SCHEMA_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT,
      username_normalized TEXT,
      password_hash TEXT,
      password_salt TEXT,
      password_iterations INTEGER,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      completed INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,
];

const USER_COLUMN_MIGRATIONS = [
  { name: "username", sql: "ALTER TABLE users ADD COLUMN username TEXT" },
  { name: "username_normalized", sql: "ALTER TABLE users ADD COLUMN username_normalized TEXT" },
  { name: "password_hash", sql: "ALTER TABLE users ADD COLUMN password_hash TEXT" },
  { name: "password_salt", sql: "ALTER TABLE users ADD COLUMN password_salt TEXT" },
  { name: "password_iterations", sql: "ALTER TABLE users ADD COLUMN password_iterations INTEGER" },
];

const INDEX_STATEMENTS = [
  "CREATE INDEX IF NOT EXISTS idx_sessions_user_started_at ON pomodoro_sessions(user_id, started_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_normalized ON users(username_normalized)",
  "CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id)",
];

let schemaReadyPromise = null;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const requestId = crypto.randomUUID();

    const corsHeaders = buildCorsHeaders(request);

    // Basic CORS for browser access from Pages/custom domain
    const defaultHeaders = {
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...corsHeaders,
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: defaultHeaders });
    }

    try {
      const logContext = {
        requestId,
        method: request.method,
        pathname: path,
        hasDB: !!env.DB,
      };
      console.log("[request]", JSON.stringify(logContext));

      if (!env.DB) {
        console.error("[request] missing DB binding", JSON.stringify(logContext));
        return json(
          {
            error: "D1 binding unavailable",
            request_id: requestId,
            has_db: false,
          },
          500,
          defaultHeaders,
        );
      }

      await ensureSchema(env, requestId);

      if (path === "/api/auth/session" && request.method === "GET") {
        const authSession = await getAuthenticatedSession(request, env);
        if (!authSession) {
          return json({ ok: true, authenticated: false, request_id: requestId }, 200, defaultHeaders);
        }

        await touchAuthenticatedSession(env, authSession);

        return json(
          {
            ok: true,
            authenticated: true,
            user: serializeUser(authSession.user),
            request_id: requestId,
          },
          200,
          defaultHeaders,
        );
      }

      if (path === "/api/auth/register" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const username = String(body.username || "").trim();
        const password = String(body.password || "");
        const validationError = validateCredentials(username, password);

        if (validationError) {
          return json({ error: validationError, request_id: requestId }, 400, defaultHeaders);
        }

        const usernameNormalized = normalizeUsername(username);
        const existingUser = await env.DB.prepare(`
          SELECT id
          FROM users
          WHERE username_normalized = ?1
          LIMIT 1
        `)
          .bind(usernameNormalized)
          .first();

        if (existingUser) {
          return json({ error: "用户名已存在", request_id: requestId }, 409, defaultHeaders);
        }

        const now = new Date().toISOString();
        const userId = crypto.randomUUID();
        const passwordSalt = createRandomToken(16);
        const passwordHash = await hashPassword(password, passwordSalt, PASSWORD_ITERATIONS);

        await env.DB.prepare(`
          INSERT INTO users (
            id,
            username,
            username_normalized,
            password_hash,
            password_salt,
            password_iterations,
            created_at,
            last_seen_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
        `)
          .bind(userId, username, usernameNormalized, passwordHash, passwordSalt, PASSWORD_ITERATIONS, now)
          .run();

        const user = {
          id: userId,
          username,
          created_at: now,
          last_seen_at: now,
        };
        const sessionCookie = await createAuthSession(env, user.id);

        return json(
          {
            ok: true,
            user: serializeUser(user),
            session_token: sessionCookie,
            request_id: requestId,
          },
          201,
          {
            ...defaultHeaders,
            "Set-Cookie": buildSessionCookie(sessionCookie, request),
          },
        );
      }

      if (path === "/api/auth/login" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const username = String(body.username || "").trim();
        const password = String(body.password || "");

        if (!username || !password) {
          return json({ error: "请输入用户名和密码", request_id: requestId }, 400, defaultHeaders);
        }

        const user = await env.DB.prepare(`
          SELECT id, username, password_hash, password_salt, password_iterations, created_at, last_seen_at
          FROM users
          WHERE username_normalized = ?1
          LIMIT 1
        `)
          .bind(normalizeUsername(username))
          .first();

        if (!user?.password_hash || !user?.password_salt) {
          return json({ error: "用户名或密码错误", request_id: requestId }, 401, defaultHeaders);
        }

        const passwordHash = await hashPassword(password, user.password_salt, Number(user.password_iterations || PASSWORD_ITERATIONS));
        if (passwordHash !== user.password_hash) {
          return json({ error: "用户名或密码错误", request_id: requestId }, 401, defaultHeaders);
        }

        const now = new Date().toISOString();
        await env.DB.prepare(`
          UPDATE users
          SET last_seen_at = ?2
          WHERE id = ?1
        `)
          .bind(user.id, now)
          .run();

        const sessionToken = await createAuthSession(env, user.id);

        return json(
          {
            ok: true,
            user: serializeUser({
              id: user.id,
              username: user.username,
              created_at: user.created_at,
              last_seen_at: now,
            }),
            session_token: sessionToken,
            request_id: requestId,
          },
          200,
          {
            ...defaultHeaders,
            "Set-Cookie": buildSessionCookie(sessionToken, request),
          },
        );
      }

      if (path === "/api/auth/logout" && request.method === "POST") {
        const authSession = await getAuthenticatedSession(request, env);
        if (authSession) {
          await env.DB.prepare(`
            DELETE FROM auth_sessions
            WHERE id = ?1
          `)
            .bind(authSession.sessionId)
            .run();
        }

        return json(
          {
            ok: true,
            request_id: requestId,
          },
          200,
          {
            ...defaultHeaders,
            "Set-Cookie": buildExpiredSessionCookie(request),
          },
        );
      }

      if (path === "/api/ping" && request.method === "GET") {
        const result = await env.DB.prepare("SELECT 1 AS ok").first();
        console.log("[ping]", JSON.stringify({ requestId, result }));
        return json(
          {
            ok: true,
            service: "pomodoro-api",
            db: result || { ok: 1 },
            request_id: requestId,
          },
          200,
          defaultHeaders,
        );
      }

      if (path === "/api/health" && request.method === "GET") {
        return json({ ok: true, service: "pomodoro-api", request_id: requestId }, 200, defaultHeaders);
      }

      if (path === "/api/user" && request.method === "GET") {
        const authSession = await requireAuthenticatedSession(request, env, defaultHeaders, requestId);
        if (authSession instanceof Response) return authSession;

        return json(
          {
            ok: true,
            user: serializeUser(authSession.user),
            request_id: requestId,
          },
          200,
          defaultHeaders,
        );
      }

      if (path === "/api/user" && request.method === "POST") {
        const authSession = await requireAuthenticatedSession(request, env, defaultHeaders, requestId);
        if (authSession instanceof Response) return authSession;

        await touchAuthenticatedSession(env, authSession);

        return json(
          {
            ok: true,
            user: serializeUser(authSession.user),
            request_id: requestId,
          },
          200,
          defaultHeaders,
        );
      }

      if (path === "/api/session" && request.method === "POST") {
        const authSession = await requireAuthenticatedSession(request, env, defaultHeaders, requestId);
        if (authSession instanceof Response) return authSession;

        const body = await request.json().catch(() => null);
        if (!body) return json({ error: "Invalid JSON body" }, 400, defaultHeaders);

        const sessionId = String(body.id || crypto.randomUUID());
        const startedAt = String(body.started_at || "").trim();
        const endedAt = String(body.ended_at || "").trim();
        const durationSeconds = Number(body.duration_seconds);
        const completed = body.completed ? 1 : 0;
        const createdAt = new Date().toISOString();

        if (!startedAt || !endedAt || !Number.isFinite(durationSeconds)) {
          return json(
            { error: "started_at, ended_at, duration_seconds are required" },
            400,
            defaultHeaders,
          );
        }
        if (durationSeconds <= 0 || durationSeconds > 8 * 60 * 60) {
          return json({ error: "duration_seconds must be between 1 second and 8 hours" }, 400, defaultHeaders);
        }

        await env.DB.prepare(`
          UPDATE users
          SET last_seen_at = ?2
          WHERE id = ?1
        `)
          .bind(authSession.user.id, createdAt)
          .run();

        await env.DB.prepare(`
          INSERT INTO pomodoro_sessions (
            id, user_id, started_at, ended_at, duration_seconds, completed, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        `)
          .bind(sessionId, authSession.user.id, startedAt, endedAt, durationSeconds, completed, createdAt)
          .run();

        return json({ ok: true, id: sessionId, request_id: requestId }, 201, defaultHeaders);
      }

      if (path === "/api/heatmap" && request.method === "GET") {
        const authSession = await requireAuthenticatedSession(request, env, defaultHeaders, requestId);
        if (authSession instanceof Response) return authSession;

        const year = String(url.searchParams.get("year") || new Date().getUTCFullYear());

        const rows = await env.DB.prepare(`
          SELECT
            substr(started_at, 1, 10) AS date,
            SUM(duration_seconds) AS total_seconds,
            SUM(completed) AS completed_count
          FROM pomodoro_sessions
          WHERE user_id = ?1
            AND substr(started_at, 1, 4) = ?2
          GROUP BY substr(started_at, 1, 10)
          ORDER BY date ASC
        `)
          .bind(authSession.user.id, year)
          .all();

        return json(
          {
            ok: true,
            user: serializeUser(authSession.user),
            year,
            days: rows.results || [],
            request_id: requestId,
          },
          200,
          defaultHeaders,
        );
      }

      if (path === "/api/stats" && request.method === "GET") {
        const authSession = await requireAuthenticatedSession(request, env, defaultHeaders, requestId);
        if (authSession instanceof Response) return authSession;

        const totals = await env.DB.prepare(`
          SELECT
            COALESCE(SUM(duration_seconds), 0) AS total_seconds,
            COALESCE(SUM(completed), 0) AS completed_count,
            COUNT(*) AS session_count
          FROM pomodoro_sessions
          WHERE user_id = ?1
        `)
          .bind(authSession.user.id)
          .first();

        const monthly = await env.DB.prepare(`
          SELECT
            substr(started_at, 1, 7) AS month,
            SUM(duration_seconds) AS total_seconds,
            SUM(completed) AS completed_count
          FROM pomodoro_sessions
          WHERE user_id = ?1
          GROUP BY substr(started_at, 1, 7)
          ORDER BY month DESC
          LIMIT 12
        `)
          .bind(authSession.user.id)
          .all();

        const yearly = await env.DB.prepare(`
          SELECT
            substr(started_at, 1, 4) AS year,
            SUM(duration_seconds) AS total_seconds,
            SUM(completed) AS completed_count
          FROM pomodoro_sessions
          WHERE user_id = ?1
          GROUP BY substr(started_at, 1, 4)
          ORDER BY year DESC
        `)
          .bind(authSession.user.id)
          .all();

        return json(
          {
            ok: true,
            user: serializeUser(authSession.user),
            totals: totals || { total_seconds: 0, completed_count: 0, session_count: 0 },
            monthly: monthly.results || [],
            yearly: yearly.results || [],
            request_id: requestId,
          },
          200,
          defaultHeaders,
        );
      }

      return json({ error: "Not found" }, 404, defaultHeaders);
    } catch (error) {
      console.error(
        "[request.error]",
        JSON.stringify({
          requestId,
          method: request.method,
          pathname: path,
          message: error?.message || "Internal error",
          stack: error?.stack || null,
          hasDB: !!env.DB,
        }),
      );
      return json(
        {
          error: error.message || "Internal error",
          request_id: requestId,
          pathname: path,
          method: request.method,
          has_db: !!env.DB,
        },
        500,
        defaultHeaders,
      );
    }
  },
};

function buildCorsHeaders(request) {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    created_at: user.created_at,
    last_seen_at: user.last_seen_at,
  };
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function validateCredentials(username, password) {
  if (!USERNAME_PATTERN.test(username)) {
    return "用户名需为 3-24 位，仅支持字母、数字、下划线和连字符";
  }

  if (password.length < 8 || password.length > 72) {
    return "密码长度需在 8 到 72 位之间";
  }

  return "";
}

function createRandomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function hashPassword(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const digest = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: base64UrlToBytes(salt),
      iterations,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

function getCookieValue(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(/;\s*/);
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.split("=");
    if (cookieName === name) {
      return rest.join("=");
    }
  }
  return "";
}

function getBearerToken(request) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith(AUTHORIZATION_PREFIX)) {
    return "";
  }

  return authorization.slice(AUTHORIZATION_PREFIX.length).trim();
}

function buildSessionCookie(token, request) {
  const url = new URL(request.url);
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];

  if (url.protocol === "https:") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function buildExpiredSessionCookie(request) {
  const url = new URL(request.url);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (url.protocol === "https:") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

async function createAuthSession(env, userId) {
  const token = createRandomToken(32);
  const sessionTokenHash = await sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

  await env.DB.prepare(`
    INSERT INTO auth_sessions (
      id,
      user_id,
      session_token_hash,
      created_at,
      expires_at,
      last_seen_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?4)
  `)
    .bind(crypto.randomUUID(), userId, sessionTokenHash, now.toISOString(), expiresAt.toISOString())
    .run();

  return token;
}

async function getAuthenticatedSession(request, env) {
  const sessionToken = getBearerToken(request) || getCookieValue(request, SESSION_COOKIE_NAME);
  if (!sessionToken) return null;

  const sessionTokenHash = await sha256(sessionToken);
  const now = new Date().toISOString();

  const row = await env.DB.prepare(`
    SELECT
      auth_sessions.id AS session_id,
      users.id AS id,
      users.username AS username,
      users.created_at AS created_at,
      users.last_seen_at AS last_seen_at,
      auth_sessions.last_seen_at AS session_last_seen_at
    FROM auth_sessions
    JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.session_token_hash = ?1
      AND auth_sessions.expires_at > ?2
      AND users.username IS NOT NULL
    LIMIT 1
  `)
    .bind(sessionTokenHash, now)
    .first();

  if (!row) return null;

  return {
    sessionId: row.session_id,
    user: {
      id: row.id,
      username: row.username,
      created_at: row.created_at,
      last_seen_at: row.last_seen_at,
    },
  };
}

async function touchAuthenticatedSession(env, authSession) {
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE auth_sessions
      SET last_seen_at = ?2
      WHERE id = ?1
    `).bind(authSession.sessionId, now),
    env.DB.prepare(`
      UPDATE users
      SET last_seen_at = ?2
      WHERE id = ?1
    `).bind(authSession.user.id, now),
  ]);
  authSession.user.last_seen_at = now;
}

async function requireAuthenticatedSession(request, env, headers, requestId) {
  const authSession = await getAuthenticatedSession(request, env);
  if (!authSession) {
    return json({ error: "请先登录", request_id: requestId }, 401, headers);
  }
  return authSession;
}

async function ensureSchema(env, requestId) {
  if (schemaReadyPromise) {
    await schemaReadyPromise;
    return;
  }

  schemaReadyPromise = (async () => {
    await env.DB.batch(SCHEMA_STATEMENTS.map((statement) => env.DB.prepare(statement)));
    await ensureUserColumns(env);
    await env.DB.batch(INDEX_STATEMENTS.map((statement) => env.DB.prepare(statement)));
    console.log("[schema.ready]", JSON.stringify({ requestId }));
  })().catch((error) => {
    schemaReadyPromise = null;
    console.error(
      "[schema.error]",
      JSON.stringify({
        requestId,
        message: error?.message || "Failed to initialize schema",
        stack: error?.stack || null,
      }),
    );
    throw error;
  });

  await schemaReadyPromise;
}

async function ensureUserColumns(env) {
  const tableInfo = await env.DB.prepare("PRAGMA table_info(users)").all();
  const existingColumns = new Set((tableInfo.results || []).map((column) => column.name));
  const migrations = USER_COLUMN_MIGRATIONS
    .filter((migration) => !existingColumns.has(migration.name))
    .map((migration) => env.DB.prepare(migration.sql));

  if (migrations.length > 0) {
    await env.DB.batch(migrations);
  }
}
