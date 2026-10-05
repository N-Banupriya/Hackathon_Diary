import { db } from "@/lib/db";
import { handle, requireRole, HttpError } from "@/lib/auth";
import { preRank, matchWithClaude, matchByKeywords, fetchLinkText } from "@/lib/match";

export const maxDuration = 300;
const LIMIT = 900;

export const POST = handle(async (req, { params }) => {
  await requireRole("admin", "staff");
  const { id } = await params;
  const p = await db();
  const h = (await p.query(`SELECT *, to_char(deadline,'YYYY-MM-DD') AS deadline FROM hackathons WHERE id=$1`, [id])).rows[0];
  if (!h) throw new HttpError(404, "That hackathon was deleted.");
  // No themes given? Try to read them from the hackathon's link and keep them.
  if (String(h.description || "").length < 150 && h.link) {
    try {
      const page = await fetchLinkText(h.link);
      if (page.text && page.text.length > 150) {
        h.description = [h.description, page.text].filter(Boolean).join("\n\n");
        await p.query(`UPDATE hackathons SET description=$2 WHERE id=$1`, [id, h.description]);
      }
    } catch { /* keep going with what we have */ }
  }
  // Where to look: every list, or the chosen Design Thinking batches/years plus the chosen collections.
  const teams = (await p.query(
    `SELECT t.batch, t.year, t.dept, t.section, t.team_no, t.title, t.mentor, t.domain, t.sector, t.domain_tags, t.sector_tags, t.members, t.extra,
            t.collection_id, c.name AS collection
       FROM teams t LEFT JOIN collections c ON c.id = t.collection_id
      WHERE coalesce(t.title,'') <> ''
        AND ($1::boolean
             OR (t.collection_id IS NULL AND t.batch = ANY($2) AND t.year = ANY($3))
             OR (t.collection_id IS NOT NULL AND t.collection_id::text = ANY($4)))`,
    [h.scope_all, h.batches, h.years, h.collections || []])).rows;
  if (!teams.length) throw new HttpError(400, "No projects are stored in the lists chosen for this hackathon. Upload the spreadsheets first, or choose more lists (Edit the hackathon).");

  let result, how;
  if (process.env.ANTHROPIC_API_KEY) {
    const pool = teams.length > LIMIT ? preRank(teams, `${h.title} ${h.description}`, LIMIT).map((x) => x.t) : teams;
    let ai;
    try { ai = await matchWithClaude(h, pool); }
    catch (e) { console.error("Claude matching failed", e); throw new HttpError(502, "The AI service did not answer properly. Try again in a minute."); }
    const byId = new Map(pool.map((t, i) => ["P" + i, t]));
    result = {
      summary: String(ai.summary || "").slice(0, 400),
      themes: (Array.isArray(ai.themes) ? ai.themes : []).map(String).slice(0, 15),
      matches: (Array.isArray(ai.matches) ? ai.matches : []).map((m) => ({ team: byId.get(String(m.id || "").trim()), fit: m.fit === "strong" ? "strong" : "medium", track: String(m.track || "").slice(0, 120), reason: String(m.reason || "").slice(0, 400) })).filter((m) => m.team),
    };
    how = "claude";
  } else { result = matchByKeywords(h, teams); how = "keywords"; }

  const rank = { strong: 0, medium: 1 };
  const matches = result.matches.filter((m) => m.fit === "strong" || m.fit === "medium")
    .sort((a, b) => rank[a.fit] - rank[b.fit]).slice(0, 80)
    .map(({ team: t, ...m }) => ({ ...m, batch: t.batch, year: t.year, dept: t.dept, section: t.section, teamNo: t.team_no, title: t.title, mentor: t.mentor, domain: t.domain, sector: t.sector, members: t.members, collection: t.collection || "", extra: t.extra || {} }));
  await p.query(`UPDATE hackathons SET matches=$2, themes=$3, summary=$4, matched_at=now(), matched_with=$5, scanned=$6 WHERE id=$1`,
    [id, JSON.stringify(matches), JSON.stringify(result.themes), result.summary, how, teams.length]);
  return Response.json({ ok: true });
});
