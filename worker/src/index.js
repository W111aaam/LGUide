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
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_blackboard_token_hash ON blackboard_connections(token_hash)",
  "CREATE INDEX IF NOT EXISTS idx_blackboard_tasks_user_due ON blackboard_tasks(user_id, due_utc)",
  "CREATE INDEX IF NOT EXISTS idx_blackboard_announcements_user_created ON blackboard_announcements(user_id, created_utc)",
  "CREATE INDEX IF NOT EXISTS idx_blackboard_materials_user_modified ON blackboard_materials(user_id, modified_utc)",
];

const BLACKBOARD_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS blackboard_connections (
    user_id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_sync_at TEXT,
    source TEXT NOT NULL DEFAULT 'bbwatch',
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS blackboard_courses (
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    course_name TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, course_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS blackboard_tasks (
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
  )`,
  `CREATE TABLE IF NOT EXISTS blackboard_announcements (
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
  )`,
  `CREATE TABLE IF NOT EXISTS blackboard_materials (
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
  )`,
  `CREATE TABLE IF NOT EXISTS blackboard_pairing_codes (
    code_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
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
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
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

        const beijingNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const year = String(url.searchParams.get("year") || beijingNow.getUTCFullYear());

        const rows = await env.DB.prepare(`
          SELECT
            strftime('%Y-%m-%d', datetime(started_at, '+8 hours')) AS date,
            SUM(duration_seconds) AS total_seconds,
            SUM(completed) AS completed_count
          FROM pomodoro_sessions
          WHERE user_id = ?1
            AND strftime('%Y', datetime(started_at, '+8 hours')) = ?2
          GROUP BY strftime('%Y-%m-%d', datetime(started_at, '+8 hours'))
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
            strftime('%Y-%m', datetime(started_at, '+8 hours')) AS month,
            SUM(duration_seconds) AS total_seconds,
            SUM(completed) AS completed_count
          FROM pomodoro_sessions
          WHERE user_id = ?1
          GROUP BY strftime('%Y-%m', datetime(started_at, '+8 hours'))
          ORDER BY month DESC
          LIMIT 12
        `)
          .bind(authSession.user.id)
          .all();

        const yearly = await env.DB.prepare(`
          SELECT
            strftime('%Y', datetime(started_at, '+8 hours')) AS year,
            SUM(duration_seconds) AS total_seconds,
            SUM(completed) AS completed_count
          FROM pomodoro_sessions
          WHERE user_id = ?1
          GROUP BY strftime('%Y', datetime(started_at, '+8 hours'))
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

      if (path === "/api/blackboard/pairing-code" && request.method === "POST") {
        const authSession = await requireAuthenticatedSession(request, env, defaultHeaders, requestId);
        if (authSession instanceof Response) return authSession;
        const code = createPairingCode();
        const codeHash = await sha256(normalizePairingCode(code));
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
        await env.DB.batch([
          env.DB.prepare("DELETE FROM blackboard_pairing_codes WHERE user_id=?1 OR expires_at<=?2").bind(authSession.user.id, now.toISOString()),
          env.DB.prepare("INSERT INTO blackboard_pairing_codes (code_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)")
            .bind(codeHash, authSession.user.id, now.toISOString(), expiresAt.toISOString()),
        ]);
        return json({ ok: true, code, created_at: now.toISOString(), expires_at: expiresAt.toISOString(), request_id: requestId }, 201, { ...defaultHeaders, "Cache-Control": "no-store" });
      }

      if (path === "/api/blackboard/pair" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const code = normalizePairingCode(body.code);
        if (!/^[A-Z2-9]{10}$/.test(code)) {
          return json({ error: "配对码格式无效", request_id: requestId }, 400, defaultHeaders);
        }
        const codeHash = await sha256(code);
        const now = new Date().toISOString();
        const token = `lgbb_${createRandomToken(32)}`;
        const tokenHash = await sha256(token);
        const [redeemed] = await env.DB.batch([
          env.DB.prepare(`
            INSERT INTO blackboard_connections (user_id, token_hash, created_at, source)
            SELECT user_id, ?2, ?3, 'bbwatch' FROM blackboard_pairing_codes
            WHERE code_hash=?1 AND used_at IS NULL AND expires_at>?3
            ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash, created_at=excluded.created_at, source=excluded.source
          `).bind(codeHash, tokenHash, now),
          env.DB.prepare("DELETE FROM blackboard_pairing_codes WHERE code_hash=?1").bind(codeHash),
        ]);
        if (!redeemed.meta.changes) {
          return json({ error: "配对码无效、已使用或已过期", request_id: requestId }, 401, defaultHeaders);
        }
        return json({ ok: true, token, created_at: now, request_id: requestId }, 201, { ...defaultHeaders, "Cache-Control": "no-store" });
      }

      if (path === "/api/blackboard/connect-token" && request.method === "POST") {
        const authSession = await requireAuthenticatedSession(request, env, defaultHeaders, requestId);
        if (authSession instanceof Response) return authSession;

        const token = `lgbb_${createRandomToken(32)}`;
        const tokenHash = await sha256(token);
        const now = new Date().toISOString();
        await env.DB.prepare(`
          INSERT INTO blackboard_connections (user_id, token_hash, created_at, source)
          VALUES (?1, ?2, ?3, 'bbwatch')
          ON CONFLICT(user_id) DO UPDATE SET
            token_hash=excluded.token_hash,
            created_at=excluded.created_at,
            last_sync_at=NULL,
            source=excluded.source
        `).bind(authSession.user.id, tokenHash, now).run();

        return json({ ok: true, token, created_at: now, request_id: requestId }, 201, defaultHeaders);
      }

      if (path === "/api/blackboard/status" && request.method === "GET") {
        const authSession = await requireAuthenticatedSession(request, env, defaultHeaders, requestId);
        if (authSession instanceof Response) return authSession;
        const status = await getBlackboardStatus(env, authSession.user.id);
        return json({ ok: true, ...status, request_id: requestId }, 200, defaultHeaders);
      }

      if (path === "/api/blackboard/data" && request.method === "GET") {
        const authSession = await requireAuthenticatedSession(request, env, defaultHeaders, requestId);
        if (authSession instanceof Response) return authSession;
        const userId = authSession.user.id;
        const [courses, tasks, announcements, materials] = await Promise.all([
          env.DB.prepare("SELECT course_id, course_name FROM blackboard_courses WHERE user_id=?1 ORDER BY course_name").bind(userId).all(),
          env.DB.prepare("SELECT entity_key, course_id, course_name, title, due_utc, status, score, content_id, manual_done FROM blackboard_tasks WHERE user_id=?1 ORDER BY due_utc IS NULL, due_utc").bind(userId).all(),
          env.DB.prepare("SELECT entity_key, course_id, course_name, title, body, created_utc FROM blackboard_announcements WHERE user_id=?1 ORDER BY created_utc DESC LIMIT 200").bind(userId).all(),
          env.DB.prepare("SELECT entity_key, course_id, course_name, title, handler, modified_utc, local_path, downloaded FROM blackboard_materials WHERE user_id=?1 ORDER BY modified_utc DESC LIMIT 500").bind(userId).all(),
        ]);
        const status = await getBlackboardStatus(env, userId);
        return json({
          ok: true,
          status,
          courses: courses.results || [],
          tasks: tasks.results || [],
          announcements: announcements.results || [],
          materials: materials.results || [],
          request_id: requestId,
        }, 200, defaultHeaders);
      }

      if (path === "/api/blackboard/disconnect" && request.method === "DELETE") {
        const authSession = await requireAuthenticatedSession(request, env, defaultHeaders, requestId);
        if (authSession instanceof Response) return authSession;
        const userId = authSession.user.id;
        await env.DB.batch([
          env.DB.prepare("DELETE FROM blackboard_pairing_codes WHERE user_id=?1").bind(userId),
          env.DB.prepare("DELETE FROM blackboard_courses WHERE user_id=?1").bind(userId),
          env.DB.prepare("DELETE FROM blackboard_tasks WHERE user_id=?1").bind(userId),
          env.DB.prepare("DELETE FROM blackboard_announcements WHERE user_id=?1").bind(userId),
          env.DB.prepare("DELETE FROM blackboard_materials WHERE user_id=?1").bind(userId),
          env.DB.prepare("DELETE FROM blackboard_connections WHERE user_id=?1").bind(userId),
        ]);
        return json({ ok: true, request_id: requestId }, 200, defaultHeaders);
      }

      if (path === "/api/blackboard/sync" && request.method === "POST") {
        const syncToken = getBearerToken(request);
        if (!syncToken.startsWith("lgbb_")) {
          return json({ error: "无效的 Blackboard 同步令牌", request_id: requestId }, 401, defaultHeaders);
        }
        const tokenHash = await sha256(syncToken);
        const connection = await env.DB.prepare(`
          SELECT user_id FROM blackboard_connections WHERE token_hash=?1 LIMIT 1
        `).bind(tokenHash).first();
        if (!connection) {
          return json({ error: "同步令牌已失效，请在 LGUide 中重新连接", request_id: requestId }, 401, defaultHeaders);
        }

        const raw = await request.json().catch(() => null);
        const validationError = validateBlackboardPayload(raw);
        if (validationError) {
          return json({ error: validationError, request_id: requestId }, 400, defaultHeaders);
        }
        const snapshot = normalizeBlackboardPayload(raw);
        const syncedAt = new Date().toISOString();
        const userId = connection.user_id;
        const statements = [
          env.DB.prepare("DELETE FROM blackboard_courses WHERE user_id=?1").bind(userId),
          env.DB.prepare("DELETE FROM blackboard_tasks WHERE user_id=?1").bind(userId),
          env.DB.prepare("DELETE FROM blackboard_announcements WHERE user_id=?1").bind(userId),
          env.DB.prepare("DELETE FROM blackboard_materials WHERE user_id=?1").bind(userId),
        ];
        for (const course of snapshot.courses) {
          statements.push(env.DB.prepare(`INSERT INTO blackboard_courses (user_id, course_id, course_name, updated_at) VALUES (?1, ?2, ?3, ?4)`)
            .bind(userId, course.course_id, course.course_name, syncedAt));
        }
        for (const task of snapshot.tasks) {
          statements.push(env.DB.prepare(`INSERT INTO blackboard_tasks (user_id, entity_key, course_id, course_name, title, due_utc, status, score, content_id, manual_done, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`)
            .bind(userId, task.entity_key, task.course_id, task.course_name, task.title, task.due_utc, task.status, task.score, task.content_id, task.manual_done ? 1 : 0, syncedAt));
        }
        for (const announcement of snapshot.announcements) {
          statements.push(env.DB.prepare(`INSERT INTO blackboard_announcements (user_id, entity_key, course_id, course_name, title, body, created_utc, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`)
            .bind(userId, announcement.entity_key, announcement.course_id, announcement.course_name, announcement.title, announcement.body, announcement.created_utc, syncedAt));
        }
        for (const material of snapshot.materials) {
          statements.push(env.DB.prepare(`INSERT INTO blackboard_materials (user_id, entity_key, course_id, course_name, title, handler, modified_utc, local_path, downloaded, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
            .bind(userId, material.entity_key, material.course_id, material.course_name, material.title, material.handler, material.modified_utc, material.local_path, material.downloaded ? 1 : 0, syncedAt));
        }
        statements.push(env.DB.prepare("UPDATE blackboard_connections SET last_sync_at=?2 WHERE user_id=?1").bind(userId, syncedAt));
        await runD1Batches(env, statements);

        return json({
          ok: true,
          synced_at: syncedAt,
          counts: {
            courses: snapshot.courses.length,
            tasks: snapshot.tasks.length,
            announcements: snapshot.announcements.length,
            materials: snapshot.materials.length,
          },
          request_id: requestId,
        }, 200, defaultHeaders);
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

async function getBlackboardStatus(env, userId) {
  const connection = await env.DB.prepare(`
    SELECT created_at, last_sync_at, source FROM blackboard_connections WHERE user_id=?1 LIMIT 1
  `).bind(userId).first();
  if (!connection) {
    return { connected: false, last_sync_at: null, counts: { courses: 0, tasks: 0, announcements: 0, materials: 0 } };
  }
  const counts = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM blackboard_courses WHERE user_id=?1) AS courses,
      (SELECT COUNT(*) FROM blackboard_tasks WHERE user_id=?1) AS tasks,
      (SELECT COUNT(*) FROM blackboard_announcements WHERE user_id=?1) AS announcements,
      (SELECT COUNT(*) FROM blackboard_materials WHERE user_id=?1) AS materials
  `).bind(userId).first();
  return {
    connected: true,
    created_at: connection.created_at,
    last_sync_at: connection.last_sync_at,
    source: connection.source,
    counts: {
      courses: Number(counts?.courses || 0),
      tasks: Number(counts?.tasks || 0),
      announcements: Number(counts?.announcements || 0),
      materials: Number(counts?.materials || 0),
    },
  };
}

function validateBlackboardPayload(payload) {
  if (!payload || typeof payload !== "object") return "请求体必须是 JSON 对象";
  for (const key of ["courses", "tasks", "announcements", "materials"]) {
    if (!Array.isArray(payload[key])) return `${key} 必须是数组`;
  }
  if (payload.courses.length > 200 || payload.tasks.length > 1000 || payload.announcements.length > 1000 || payload.materials.length > 2000) {
    return "同步数据量超过安全限制";
  }
  return "";
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanOptional(value, maxLength = 500) {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

function normalizeBlackboardPayload(payload) {
  const courses = payload.courses.map((item) => ({
    course_id: cleanText(item.course_id, 160),
    course_name: cleanOptional(item.course_name, 300),
  })).filter((item) => item.course_id);
  const courseNames = new Map(courses.map((item) => [item.course_id, item.course_name]));
  const tasks = payload.tasks.map((item) => ({
    entity_key: cleanText(item.entity_key, 240),
    course_id: cleanText(item.course_id, 160),
    course_name: cleanOptional(item.course_name, 300) || courseNames.get(cleanText(item.course_id, 160)) || null,
    title: cleanText(item.title || item.name, 500),
    due_utc: cleanOptional(item.due_utc, 64),
    status: cleanText(item.status || (item.done ? "done" : "todo"), 40) || "todo",
    score: item.score !== null && item.score !== undefined && item.score !== "" && Number.isFinite(Number(item.score)) ? Number(item.score) : null,
    content_id: cleanOptional(item.content_id, 160),
    manual_done: Boolean(item.manual_done ?? item.done),
  })).filter((item) => item.entity_key && item.course_id && item.title);
  const announcements = payload.announcements.map((item) => ({
    entity_key: cleanText(item.entity_key, 240),
    course_id: cleanText(item.course_id, 160),
    course_name: cleanOptional(item.course_name, 300) || courseNames.get(cleanText(item.course_id, 160)) || null,
    title: cleanText(item.title, 500),
    body: cleanOptional(item.body, 4000),
    created_utc: cleanOptional(item.created_utc || item.created, 64),
  })).filter((item) => item.entity_key && item.course_id && item.title);
  const materials = payload.materials.map((item) => ({
    entity_key: cleanText(item.entity_key, 240),
    course_id: cleanText(item.course_id, 160),
    course_name: cleanOptional(item.course_name, 300) || courseNames.get(cleanText(item.course_id, 160)) || null,
    title: cleanText(item.title, 500),
    handler: cleanOptional(item.handler, 160),
    modified_utc: cleanOptional(item.modified_utc || item.modified, 64),
    local_path: cleanOptional(item.local_path, 1000),
    downloaded: Boolean(item.downloaded || item.local_path),
  })).filter((item) => item.entity_key && item.course_id && item.title);
  return { courses, tasks, announcements, materials };
}

async function runD1Batches(env, statements, batchSize = 80) {
  for (let index = 0; index < statements.length; index += batchSize) {
    await env.DB.batch(statements.slice(index, index + batchSize));
  }
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

function createPairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const value = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${value.slice(0, 5)}-${value.slice(5)}`;
}

function normalizePairingCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
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
    await env.DB.batch(BLACKBOARD_SCHEMA_STATEMENTS.map((statement) => env.DB.prepare(statement)));
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
