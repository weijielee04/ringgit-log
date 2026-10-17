// Ringgit Log: deletes the signed-in account, its receipt files and (through the database's
// "on delete cascade" rules) its profile, records and reading counts.
//
// The website calls this from Settings > Your account > Delete account, sending { "confirm": "DELETE" }.
// Optional secret: ALLOWED_ORIGINS, comma-separated origins allowed to call this, default *.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*").split(",").map((s) => s.trim()).filter(Boolean);
const BUCKET = "receipts";

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allow = ORIGINS.includes("*") ? "*" : ORIGINS.includes(origin) ? origin : ORIGINS[0] || "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function reply(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}
function adminClient() {
  let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    key = keys.default || Object.values(keys)[0] || key;
  } catch (_) { /* keep the legacy key */ }
  return createClient(Deno.env.get("SUPABASE_URL")!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { code: "bad_request" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(req, { code: "session_expired" }, 401);
  const admin = adminClient();
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  const user = auth && auth.user;
  if (authError || !user) return reply(req, { code: "session_expired" }, 401);

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch (_) { body = {}; }
  if (!body || body.confirm !== "DELETE") return reply(req, { code: "bad_request", message: "confirm with DELETE" }, 400);

  // 1. Receipt files: everything in the account's own folder.
  const bucket = admin.storage.from(BUCKET);
  for (let round = 0; round < 200; round++) {
    const { data, error } = await bucket.list(user.id, { limit: 1000 });
    if (error) { console.error("list", error); return reply(req, { code: "unavailable" }, 500); }
    const paths = (data || []).filter((o) => o && o.id).map((o) => user.id + "/" + o.name);
    if (!paths.length) break;
    const { error: removeError } = await bucket.remove(paths);
    if (removeError) { console.error("remove", removeError); return reply(req, { code: "unavailable" }, 500); }
  }

  // 2. The account itself; its profile, records and reading counts are deleted with it.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) { console.error("deleteUser", deleteError); return reply(req, { code: "unavailable" }, 500); }
  return reply(req, { deleted: true });
});
