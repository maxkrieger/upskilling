---
name: authenticated-endpoints
description: Ensure every server API endpoint is authenticated. Use this whenever adding, editing, moving, or reviewing a backend route in server/index.ts (any app.get / app.post / app.* under /api/*, including SSE/streaming routes), or whenever touching auth, cookies, or the demo password. Backend endpoints must never be reachable without the demo cookie unless explicitly and deliberately exempted, so consult this skill before shipping any new or changed endpoint.
---

# Authenticated endpoints

This app is gated by a shared demo password (`WEBSITE_DEMO_PASSWORD`). The gate is **not** just client-side — the server enforces it on every `/api/*` route. When you add or change an endpoint, it must stay behind that enforcement.

## How auth works here

- `POST /api/auth` validates the password and, on success, sets an **HttpOnly cookie** `demo_auth` (value = the demo password) via `hono/cookie`'s `setCookie`.
- A global middleware in `server/index.ts` runs for `/api/*` and rejects any request whose `demo_auth` cookie doesn't match `WEBSITE_DEMO_PASSWORD` with `401`:

  ```ts
  const AUTH_EXEMPT = new Set(["/api/health", "/api/auth"]);
  app.use("/api/*", async (c, next) => {
    if (!ENV.WEBSITE_DEMO_PASSWORD) return next();      // no password set -> open (local dev)
    if (AUTH_EXEMPT.has(c.req.path)) return next();      // only these are public
    if (getCookie(c, "demo_auth") === ENV.WEBSITE_DEMO_PASSWORD) return next();
    return c.json({ error: "unauthorized" }, 401);
  });
  ```

- The browser sends the cookie automatically on every **same-origin** `fetch` (the SPA and API share an origin — directly in prod on Cloudflare Pages, via the Vite `/api` proxy in dev). This includes the streaming `POST /api/chat` SSE call. **Client `fetch` calls therefore need no auth headers** — do not add per-request tokens.

## The rule

**Every new `/api/*` route is authenticated by default and must stay that way.** Because the middleware matches `/api/*`, a new route under that prefix is covered automatically — your job is to *not* break that:

- Register the route under `/api/...` (it then inherits the middleware).
- Do **not** add it to `AUTH_EXEMPT`. That set is only for endpoints that must be reachable *before* a session exists: `/api/health` (liveness) and `/api/auth` (to log in). Adding anything else needs an explicit, written justification and almost certainly indicates a design problem.
- Do not register API routes outside the `/api/` prefix (they'd escape the middleware).
- Do not re-introduce auth as a per-route check or trust a field in the request body / client state (e.g. an `authed` flag) — the cookie middleware is the single source of truth.

## When you add or change an endpoint — checklist

1. Path starts with `/api/` so the middleware applies.
2. It is **not** in `AUTH_EXEMPT` (unless it genuinely must be public — justify it in a comment and call it out to the user).
3. If it streams (SSE), confirm it still works behind auth — it does, because the cookie rides on the same-origin request; no change needed.
4. Verify it actually rejects unauthenticated callers (see below).
5. If the endpoint needs to be public, say so explicitly to the user and explain why, rather than silently exempting it.

## Verify (manual)

With the dev server running and `WEBSITE_DEMO_PASSWORD` set:

```bash
# Unauthenticated -> 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:8787/api/<new-endpoint> -H 'content-type: application/json' -d '{}'

# Authenticate, capture the cookie, then call again -> not 401
curl -s -c /tmp/c.txt -X POST localhost:8787/api/auth -H 'content-type: application/json' -d "{\"password\":\"$WEBSITE_DEMO_PASSWORD\"}"
curl -s -o /dev/null -w "%{http_code}\n" -b /tmp/c.txt -X POST localhost:8787/api/<new-endpoint> -H 'content-type: application/json' -d '{}'
```

A new endpoint that returns `401` without the cookie and works with it is correctly authenticated.
