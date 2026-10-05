import { db } from "@/lib/db";
import { handle, requireRole, HttpError } from "@/lib/auth";
import { BATCHES, YEARS, MAX_FILES_PER_YEAR, MAX_FILES_PER_COLLECTION, ALLOWED_EXT, currentYearOf } from "@/lib/config";
import { domainTags, sectorTags } from "@/lib/taxonomy";
import { useBlob } from "@/lib/storage";

const s = (v, n = 500) => String(v ?? "").slice(0, n);
const UUID = /^[0-9a-f-]{36}$/i;

// Saves an uploaded document and the project teams read from it, either into a
// Design Thinking batch/year or into a named collection (SIH, MSME, ...).
export const POST = handle(async (req) => {
  await requireRole("admin");
  const b = await req.json();
  const collectionId = b.collectionId && UUID.test(b.collectionId) ? b.collectionId : null;
  if (!collectionId && (!BATCHES.includes(b.batch) || !YEARS.includes(b.year))) throw new HttpError(400, "Choose a valid batch and year.");
  const ext = String(b.fileName || "").split(".").pop().toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) throw new HttpError(400, "Use .xlsx, .csv, .pdf, .docx or .pptx files.");
  const url = String(b.fileUrl || "");
  const okUrl = useBlob() ? /^https:\/\/[\w.-]+\.blob\.vercel-storage\.com\//.test(url) : url.startsWith("local:");
  if (!okUrl) throw new HttpError(400, "The file was not stored correctly. Upload it again.");
  const teams = Array.isArray(b.teams) ? b.teams.slice(0, 5000) : [];
  const p = await db();
  const c = await p.connect();
  try {
    await c.query("BEGIN");
    if (collectionId) {
      const col = (await c.query("SELECT id FROM collections WHERE id=$1", [collectionId])).rows[0];
      if (!col) throw new HttpError(404, "That collection was deleted.");
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [collectionId]);
      const n = (await c.query("SELECT count(*)::int n FROM uploads WHERE collection_id=$1", [collectionId])).rows[0].n;
      if (n >= MAX_FILES_PER_COLLECTION) throw new HttpError(409, `This collection already has ${MAX_FILES_PER_COLLECTION} documents. Delete one first.`);
    } else {
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [b.batch + "_" + b.year]);
      const n = (await c.query("SELECT count(*)::int n FROM uploads WHERE collection_id IS NULL AND batch=$1 AND year=$2", [b.batch, b.year])).rows[0].n;
      if (n >= MAX_FILES_PER_YEAR) throw new HttpError(409, `Year ${b.year} of this batch already has ${MAX_FILES_PER_YEAR} documents. Delete one first.`);
    }
    const students = teams.reduce((k, t) => k + (Array.isArray(t.members) ? t.members.length : 0), 0);
    const up = (await c.query(
      `INSERT INTO uploads (batch, year, collection_id, file_name, size_bytes, content_type, file_url, team_count, student_count, warnings, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [collectionId ? null : b.batch, collectionId ? null : b.year, collectionId, s(b.fileName, 200), Number(b.sizeBytes) || 0, s(b.contentType, 120), url, teams.length, students,
       JSON.stringify((b.warnings || []).map((w) => s(w, 200)).slice(0, 10)), "admin"])).rows[0];
    for (let i = 0; i < teams.length; i += 200) {
      const chunk = teams.slice(i, i + 200);
      const vals = [], params = [];
      chunk.forEach((t) => {
        const members = (Array.isArray(t.members) ? t.members : []).slice(0, 12).map((m) => ({ roll: s(m.roll, 40), name: s(m.name, 120) }));
        // In a collection, batch/year come from the file (or the roll number); otherwise from the chosen slot.
        const batch = collectionId ? (BATCHES.includes(t.batch) ? t.batch : null) : b.batch;
        const year = collectionId ? (YEARS.includes(t.year) ? t.year : (batch ? currentYearOf(batch) : null)) : b.year;
        const extra = {};
        for (const k of ["teamName", "psId", "psTitle", "category"]) if (t.extra && t.extra[k]) extra[k] = s(t.extra[k], 300);
        const row = [up.id, collectionId, batch, year, s(t.dept, 60), s(t.section, 10), s(t.teamNo, 20), s(t.title, 400), s(t.mentor, 200),
          s(t.domain, 200), s(t.sector, 200), JSON.stringify(domainTags(t.domain)), JSON.stringify(sectorTags(t.sector)), JSON.stringify(members), JSON.stringify(extra)];
        vals.push("(" + row.map((_, k) => "$" + (params.length + k + 1)).join(",") + ")");
        params.push(...row);
      });
      await c.query(`INSERT INTO teams (upload_id, collection_id, batch, year, dept, section, team_no, title, mentor, domain, sector, domain_tags, sector_tags, members, extra) VALUES ${vals.join(",")}`, params);
    }
    await c.query("COMMIT");
    return Response.json({ id: up.id, teams: teams.length, students });
  } catch (e) { await c.query("ROLLBACK"); throw e; }
  finally { c.release(); }
});
