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
  const teams = (await p.query(
    `SELECT batch, year, dept, section, team_no, title, mentor, domain, sector, domain_tags, sector_tags, members FROM teams
      WHERE batch = ANY($1) AND year = ANY($2) AND coalesce(title,'') <> ''`, [h.batches, h.years])).rows;
  if (!teams.length) throw new HttpError(400, "No projects are stored for the chosen batches and years. Upload the spreadsheets first, or widen the hackathon's batches.");

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
      matches: (Array.isArray(ai.matches) ? ai.matches : []).map((m) => ({ team: byId.get(String(m.id || "").trim()), fit: "strong", track: String(m.track || "").slice(0, 120), reason: String(m.reason || "").slice(0, 400) })).filter((m) => m.team),
    };
    how = "claude";
  } else { result = matchByKeywords(h, teams); how = "keywords"; }

  const matches = result.matches.slice(0, 40).map(({ team: t, ...m }) => ({ ...m, batch: t.batch, year: t.year, dept: t.dept, section: t.section, teamNo: t.team_no, title: t.title, mentor: t.mentor, domain: t.domain, sector: t.sector, members: t.members }));
  await p.query(`UPDATE hackathons SET matches=$2, themes=$3, summary=$4, matched_at=now(), matched_with=$5, scanned=$6 WHERE id=$1`,
    [id, JSON.stringify(matches), JSON.stringify(result.themes), result.summary, how, teams.length]);
  return Response.json({ ok: true });
});
