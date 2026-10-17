// Runs the Edge Functions in Node with stand-ins for Deno, Supabase and the Anthropic API.
// Usage: node test/fn/run.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(here, ".build");
fs.mkdirSync(out, { recursive: true });
const esbuild = "/opt/npm-tools/node_modules/.bin/esbuild";
for (const name of ["read", "delete-account"]) {
  execFileSync(esbuild, [path.join(root, "supabase/functions", name, "index.ts"), "--format=esm", "--log-level=warning", "--outfile=" + path.join(out, name + ".mjs")]);
  let js = fs.readFileSync(path.join(out, name + ".mjs"), "utf8");
  js = js.replace(/from "npm:@supabase\/supabase-js@[^"]+"/, 'from "./fake-supabase.mjs"').replace('from "./prompts.js"', 'from "' + path.join(root, "supabase/functions/read/prompts.js").replace(/\\/g, "/") + '"');
  fs.writeFileSync(path.join(out, name + ".mjs"), js);
}
fs.copyFileSync(path.join(here, "fake-supabase.mjs"), path.join(out, "fake-supabase.mjs"));

const env = {};
const handlers = [];
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (fn) => { handlers.push(fn); } };
env.SUPABASE_URL = "https://proj.supabase.co";
env.SUPABASE_SECRET_KEYS = JSON.stringify({ default: "sb_secret_test" });
const fake = await import(path.join(out, "fake-supabase.mjs"));
const S = fake.state;

let fails = 0;
const eq = (name, got, want) => { const a = JSON.stringify(got), b = JSON.stringify(want); if (a !== b) { fails++; console.log("FAIL", name, "\n   got ", a, "\n   want", b); } else console.log("ok  ", name); };

// ---------- the Anthropic API stand-in ----------
const anthropic = { calls: [], next: null };
globalThis.fetch = async (u, init) => {
  if (String(u) !== "https://api.anthropic.com/v1/messages") throw new Error("unexpected fetch " + u);
  const body = JSON.parse(init.body);
  anthropic.calls.push({ headers: init.headers, body });
  const n = anthropic.next || { kind: "ok", text: '{"rows":[]}' };
  anthropic.next = null;
  if (n.kind === "status") return new Response(n.body || "{}", { status: n.status });
  const enc = new TextEncoder();
  const events = [
    { type: "message_start", message: { id: "m1" } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    ...(n.text.match(/.{1,7}/gs) || []).map((t) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } })),
    { type: "content_block_stop", index: 0 },
    ...(n.error ? [{ type: "error", error: { type: n.error } }] : []),
    { type: "message_delta", delta: { stop_reason: n.stop || "end_turn" } },
    { type: "message_stop" }
  ];
  const sse = events.map((e) => "event: " + e.type + "\ndata: " + JSON.stringify(e) + "\n\n").join("");
  // deliver in awkward chunks to exercise the line buffering
  const parts = sse.match(/[\s\S]{1,37}/g);
  return new Response(new ReadableStream({ start(c) { parts.forEach((p) => c.enqueue(enc.encode(p))); c.close(); } }), { status: 200, headers: { "content-type": "text/event-stream" } });
};

await import(path.join(out, "read.mjs") + "?" + Date.now());
const read = handlers.pop();
const call = async (fn, body, opts = {}) => {
  const headers = { "Content-Type": "application/json", Origin: "https://weijielee04.github.io" };
  if (opts.token !== null) headers.Authorization = "Bearer " + (opts.token || "user-a");
  const res = await fn(new Request("https://proj.supabase.co/functions/v1/x", { method: opts.method || "POST", headers, body: opts.method === "OPTIONS" ? undefined : JSON.stringify(body) }));
  const text = await res.text();
  return { status: res.status, text, json: (() => { try { return JSON.parse(text); } catch (e) { return null; } })(), headers: Object.fromEntries(res.headers) };
};
const IMG = Buffer.from("fake-jpeg").toString("base64");

let r = await call(read, {}, { method: "OPTIONS" });
eq("preflight", [r.status, r.headers["access-control-allow-origin"], /authorization/.test(r.headers["access-control-allow-headers"])], [200, "*", true]);
r = await call(read, { ping: true }, { token: null });
eq("no sign-in", [r.status, r.json.code], [401, "session_expired"]);
r = await call(read, { ping: true }, { token: "nobody" });
eq("bad token", [r.status, r.json.code], [401, "session_expired"]);
r = await call(read, { ping: true });
eq("ping without a key", [r.status, r.json], [200, { ready: false, limit: 40, used: 0 }]);
r = await call(read, { task: "route", from: "A", to: "B" });
eq("reading without a key", [r.status, r.json.code], [503, "not_configured"]);

env.ANTHROPIC_API_KEY = "sk-ant-test";
env.READS_PER_ACCOUNT_PER_DAY = "3";
env.READS_PER_DAY = "4";
await import(path.join(out, "read.mjs") + "?" + Date.now() + "b");
const read2 = handlers.pop();
r = await call(read2, { ping: true });
eq("ping with a key and limits", r.json, { ready: true, limit: 3, used: 0 });
for (const [label, body] of [
  ["unknown task", { task: "essay" }],
  ["route without places", { task: "route", from: "", to: "B" }],
  ["route with pictures", { task: "route", from: "A", to: "B", images: [{ type: "image/jpeg", data: IMG }] }],
  ["text read without text", { task: "extract", ctx: { type: "mixed" }, part: { mode: "text", text: "" } }],
  ["unknown type", { task: "extract", ctx: { type: "gambling" }, part: { mode: "image" }, images: [{ type: "image/jpeg", data: IMG }] }],
  ["too many pictures", { task: "shot", images: [1, 2, 3, 4].map(() => ({ type: "image/jpeg", data: IMG })) }],
  ["svg picture", { task: "shot", images: [{ type: "image/svg+xml", data: IMG }] }],
  ["not base64", { task: "shot", images: [{ type: "image/jpeg", data: "<script>" }] }],
  ["huge text", { task: "extract", ctx: { type: "mixed" }, part: { mode: "text", text: "x".repeat(15000) } }]
]) {
  r = await call(read2, body);
  eq("rejects " + label, [r.status, r.json.code], [400, "bad_request"]);
}
eq("nothing was counted for rejected jobs", S.usage["user-a"] || 0, 0);

anthropic.next = { kind: "ok", text: '{"source":"tng","period":"","rows":[{"date":"2026-10-11","amount":2.1}]}' };
r = await call(read2, { task: "extract", today: "2026-10-17", ctx: { type: "mixed", parkKind: "" }, part: { mode: "image", period: "" }, images: [{ type: "image/jpeg", data: IMG }, { type: "image/png", data: IMG }] });
const [body1, tail1] = r.text.split("\u0000");
eq("streams the reply then a status line", [r.status, r.headers["content-type"], body1, JSON.parse(tail1), r.headers["x-reads-left"]], [200, "text/plain; charset=utf-8", '{"source":"tng","period":"","rows":[{"date":"2026-10-11","amount":2.1}]}', { stop: "end_turn", error: "" }, "2"]);
const sent = anthropic.calls[anthropic.calls.length - 1];
eq("asks Claude with the server-built prompt", [sent.headers["x-api-key"], sent.headers["anthropic-version"], sent.body.model, sent.body.stream, sent.body.max_tokens, sent.body.messages[0].content.length, sent.body.messages[0].content[0].type, sent.body.messages[0].content[1].source.media_type, /2 attached images are consecutive slices/.test(sent.body.messages[0].content[2].text), /Today is 2026-10-17/.test(sent.body.messages[0].content[2].text)],
  ["sk-ant-test", "2023-06-01", "claude-sonnet-5-5", true, 8192, 3, "image", "image/png", true, true]);

anthropic.next = { kind: "ok", text: '{"routes":[]}' };
r = await call(read2, { task: "route", from: "Subang Jaya", to: "KL Sentral", today: "1999-01-01" });
const rp = anthropic.calls[anthropic.calls.length - 1].body;
eq("route prompt, and an implausible date is replaced", [rp.max_tokens, /From: "Subang Jaya"/.test(rp.messages[0].content[0].text), /Today is 1999/.test(rp.messages[0].content[0].text)], [3000, true, false]);

anthropic.next = { kind: "ok", text: '{"rows":[{"date":"2026-10-0', stop: "max_tokens" };
r = await call(read2, { task: "extract", ctx: { type: "food" }, part: { mode: "text", text: "02/10/2026 NASI LEMAK 8.50", label: "page 1 of 1" } });
eq("a cut-off reply says so", JSON.parse(r.text.split("\u0000")[1]), { stop: "max_tokens", error: "" });
eq("text prompt carries the text", /BEGIN\n02\/10\/2026 NASI LEMAK 8.50\nEND/.test(anthropic.calls[anthropic.calls.length - 1].body.messages[0].content[0].text), true);

r = await call(read2, { task: "shot", images: [{ type: "image/jpeg", data: IMG }] });
eq("the account's daily limit", [r.status, r.json.code, S.usage["user-a"]], [429, "daily_limit", 3]);
anthropic.next = { kind: "status", status: 529, body: '{"type":"error","error":{"type":"overloaded_error"}}' };
r = await call(read2, { task: "shot", images: [{ type: "image/jpeg", data: IMG }] }, { token: "user-b" });
eq("Claude busy: told to wait and the reading is given back", [r.status, r.json.code, S.usage["user-b"]], [429, "rate_limited", 0]);
anthropic.next = { kind: "status", status: 401, body: '{"type":"error","error":{"type":"authentication_error"}}' };
r = await call(read2, { task: "shot", images: [{ type: "image/jpeg", data: IMG }] }, { token: "user-b" });
eq("a wrong API key turns reading off", [r.json.code, S.usage["user-b"]], ["not_configured", 0]);
anthropic.next = { kind: "status", status: 400, body: '{"type":"error","error":{"type":"invalid_request_error","message":"Could not process image"}}' };
r = await call(read2, { task: "shot", images: [{ type: "image/jpeg", data: IMG }] }, { token: "user-b" });
eq("a picture Claude can't use", r.json.code, "image_rejected");
anthropic.next = { kind: "ok", text: "", stop: "refusal" };
r = await call(read2, { task: "shot", images: [{ type: "image/jpeg", data: IMG }] }, { token: "user-b" });
eq("a refusal comes back as refused", [JSON.parse(r.text.split("\u0000")[1]).error, S.usage["user-b"]], ["refused", 1]);
r = await call(read2, { task: "shot", images: [{ type: "image/jpeg", data: IMG }] }, { token: "user-c" });
eq("the site's daily limit", [r.status, r.json.code], [429, "site_limit"]);
anthropic.next = { kind: "ok", text: "nul\u0000inside" };
S.usage = {};
r = await call(read2, { task: "shot", images: [{ type: "image/jpeg", data: IMG }] }, { token: "user-c" });
eq("a NUL in Claude's text can't fake the status line", r.text.split("\u0000").length, 2);

// ---------- delete-account ----------
await import(path.join(out, "delete-account.mjs") + "?" + Date.now());
const del = handlers.pop();
S.files = { "user-a": ["a1.jpg", "a2.pdf"], "user-b": ["b1.jpg"] };
r = await call(del, {});
eq("delete needs the word DELETE", [r.status, r.json.code, S.deletedUsers.length], [400, "bad_request", 0]);
r = await call(del, { confirm: "DELETE" }, { token: null });
eq("delete needs a sign-in", r.status, 401);
r = await call(del, { confirm: "DELETE" });
eq("delete removes the account's files and the account", [r.status, r.json, S.removed, S.files["user-a"], S.files["user-b"], S.deletedUsers], [200, { deleted: true }, ["user-a/a1.jpg", "user-a/a2.pdf"], [], ["b1.jpg"], ["user-a"]]);
eq("admin calls used the secret key", S.keys.every((k) => k === "sb_secret_test"), true);

console.log(fails ? fails + " FAILED" : "all function checks passed");
process.exit(fails ? 1 : 0);
