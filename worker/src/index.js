export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Basic CORS for browser access from Pages/custom domain
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (path === "/api/health" && request.method === "GET") {
        return json({ ok: true, service: "pomodoro-api" }, 200, corsHeaders);
      }

      if (path === "/api/user" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const userId = String(body.user_id || "").trim();
        if (!userId) {
          return json({ error: "user_id is required" }, 400, corsHeaders);
        }

        const now = new Date().toISOString();
        await env.DB.prepare(`
          INSERT INTO users (id, created_at, last_seen_at)
          VALUES (?1, ?2, ?2)
          ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at
        `)
          .bind(userId, now)
          .run();

        await cacheUser(env, userId, { id: userId, last_seen_at: now });

        return json({ ok: true, user_id: userId }, 200, corsHeaders);
      }

      if (path === "/api/session" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) return json({ error: "Invalid JSON body" }, 400, corsHeaders);

        const sessionId = String(body.id || crypto.randomUUID());
        const userId = String(body.user_id || "").trim();
        const startedAt = String(body.started_at || "").trim();
        const endedAt = String(body.ended_at || "").trim();
        const durationSeconds = Number(body.duration_seconds);
        const completed = body.completed ? 1 : 0;
        const createdAt = new Date().toISOString();

        if (!userId || !startedAt || !endedAt || !Number.isFinite(durationSeconds)) {
          return json(
            { error: "user_id, started_at, ended_at, duration_seconds are required" },
            400,
            corsHeaders,
          );
        }
        if (durationSeconds <= 0 || durationSeconds > 8 * 60 * 60) {
          return json({ error: "duration_seconds must be between 1 second and 8 hours" }, 400, corsHeaders);
        }

        // Make sure user exists / touch last_seen_at
        await env.DB.prepare(`
          INSERT INTO users (id, created_at, last_seen_at)
          VALUES (?1, ?2, ?2)
          ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at
        `)
          .bind(userId, createdAt)
          .run();
        await cacheUser(env, userId, { id: userId, last_seen_at: createdAt });

        await env.DB.prepare(`
          INSERT INTO pomodoro_sessions (
            id, user_id, started_at, ended_at, duration_seconds, completed, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        `)
          .bind(sessionId, userId, startedAt, endedAt, durationSeconds, completed, createdAt)
          .run();

        return json({ ok: true, id: sessionId }, 201, corsHeaders);
      }

      if (path === "/api/heatmap" && request.method === "GET") {
        const userId = String(url.searchParams.get("user_id") || "").trim();
        const year = String(url.searchParams.get("year") || new Date().getUTCFullYear());
        if (!userId) return json({ error: "user_id is required" }, 400, corsHeaders);

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
          .bind(userId, year)
          .all();

        return json({ ok: true, user_id: userId, year, days: rows.results || [] }, 200, corsHeaders);
      }

      if (path === "/api/stats" && request.method === "GET") {
        const userId = String(url.searchParams.get("user_id") || "").trim();
        if (!userId) return json({ error: "user_id is required" }, 400, corsHeaders);

        const totals = await env.DB.prepare(`
          SELECT
            COALESCE(SUM(duration_seconds), 0) AS total_seconds,
            COALESCE(SUM(completed), 0) AS completed_count,
            COUNT(*) AS session_count
          FROM pomodoro_sessions
          WHERE user_id = ?1
        `)
          .bind(userId)
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
          .bind(userId)
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
          .bind(userId)
          .all();

        return json(
          {
            ok: true,
            user_id: userId,
            totals: totals || { total_seconds: 0, completed_count: 0, session_count: 0 },
            monthly: monthly.results || [],
            yearly: yearly.results || [],
          },
          200,
          corsHeaders,
        );
      }

      return json({ error: "Not found" }, 404, corsHeaders);
    } catch (error) {
      return json({ error: error.message || "Internal error" }, 500, corsHeaders);
    }
  },
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

async function cacheUser(env, userId, payload) {
  if (!env.USER_CACHE) return;
  await env.USER_CACHE.put(`user:${userId}`, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 * 30 });
}
