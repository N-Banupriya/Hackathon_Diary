// Setup check page: /api/health. Shows which settings are present (never their values).
import { findDbUrl, db } from "@/lib/db";
import { explain } from "@/lib/auth";
import { SITE } from "@/lib/config";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = process.env;
  const checks = [];
  const add = (ok, name, detail) => checks.push({ ok, name, detail });
  add(!!env.ADMIN_PASSWORD, "ADMIN_PASSWORD", env.ADMIN_PASSWORD ? "Set" : "Missing. Add it in Settings → Environment Variables, then Redeploy.");
  add(!!env.STAFF_PASSWORD, "STAFF_PASSWORD", env.STAFF_PASSWORD ? "Set" : "Missing (optional, needed for faculty sign-in).");
  add((env.SESSION_SECRET || "").length >= 16, "SESSION_SECRET", (env.SESSION_SECRET || "").length >= 16 ? "Set" : "Missing or shorter than 16 characters.");
  const found = findDbUrl();
  add(!!found, "Database address", found ? `Found in ${found.name}` : "Not found. Connect the Neon database in Storage, then Redeploy.");
  if (found) {
    try {
      const p = await db();
      const r = await p.query("SELECT (SELECT count(*) FROM uploads)::int u, (SELECT count(*) FROM teams)::int t, (SELECT count(*) FROM hackathons)::int h");
      add(true, "Database connection", `Connected · ${r.rows[0].u} documents, ${r.rows[0].t} teams, ${r.rows[0].h} hackathons`);
    } catch (e) { add(false, "Database connection", explain(e)); }
  }
  add(!!env.BLOB_READ_WRITE_TOKEN, "File storage (Blob)", env.BLOB_READ_WRITE_TOKEN ? `Connected · access ${env.BLOB_ACCESS === "public" ? "public" : "private"}` : "Not connected. Create a Blob store in Storage, connect it, then Redeploy.");
  add(true, "AI matching", env.ANTHROPIC_API_KEY ? `Key set · model ${env.ANTHROPIC_MODEL || "claude-sonnet-5-5"}` : "No key: keyword matching is used (optional).");
  const allOk = checks.every((c) => c.ok);
  const rows = checks.map((c) => `<tr><td>${c.ok ? "✅" : "❌"}</td><td><b>${c.name}</b></td><td>${c.detail.replace(/</g, "&lt;")}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Setup check</title>
<style>body{font:15px/1.5 system-ui,sans-serif;background:#f3f5fa;color:#0f1b33;margin:0;padding:24px}main{max-width:820px;margin:auto;background:#fff;border-radius:12px;padding:24px;border-top:4px solid #f2a900}
h1{margin:0 0 4px;font-size:22px;color:#061a40}table{border-collapse:collapse;width:100%;margin-top:16px}td{padding:10px;border-top:1px solid #dbe1ec;vertical-align:top}.s{padding:10px 14px;border-radius:8px;margin-top:12px;background:${allOk ? "#e1f4ea" : "#fdecea"}}</style></head>
<body><main><h1>${SITE.portalTitle} · Setup check</h1><div>Values are never shown here, only whether each setting is present.</div>
<div class="s">${allOk ? "Everything is set up." : "Fix the items marked ❌, then Redeploy in Vercel and reload this page."}</div><table>${rows}</table></main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
