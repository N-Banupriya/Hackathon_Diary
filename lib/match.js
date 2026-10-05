// Picks project teams that fit a hackathon, using Claude when an API key is set,
// otherwise a keyword-overlap score.
const STOP = new Set("the and for with from that this into your our are will can using based smart system systems solution solutions project projects students student team teams hackathon open track tracks theme themes problem statement statements build develop innovation innovative technology technologies india national level round submission submit".split(" "));
export const words = (s) => (String(s || "").toLowerCase().match(/[a-z][a-z0-9+]{2,}/g) || []).filter((w) => !STOP.has(w));

export function preRank(teams, text, limit) {
  const want = new Set(words(text));
  return teams.map((t) => ({ t, s: words(`${t.title} ${t.domain} ${t.sector} ${(t.domain_tags || []).join(" ")} ${(t.sector_tags || []).join(" ")}`).filter((w) => want.has(w)).length }))
    .sort((a, b) => b.s - a.s).slice(0, limit);
}

export function buildPrompt(h, pool) {
  const lines = pool.map((t, i) => `P${i} | ${t.dept}${t.section ? "-" + t.section : ""} | Yr ${t.year} | ${t.title} | ${t.domain || "-"} | ${t.sector || "-"}`).join("\n");
  return `You help engineering-college faculty shortlist student project teams for a hackathon.

HACKATHON
Name: ${h.title}
Link: ${h.link || "-"}
Deadline: ${h.deadline || "-"}
Description, themes and problem statements:
${String(h.description || "(none given; infer the likely themes from the name)").slice(0, 30000)}

STUDENT PROJECTS (${pool.length}), one per line: id | dept-section | study year | project title | technology domain | sector
${lines}

Task: recommend ONLY the projects that are a strong fit for this hackathon: the project idea directly addresses one of its stated themes, tracks or problem statements as it is (not after major changes), and meets any eligibility rule in the description. Leave out partial or loose fits entirely. Return at most 40, best first; returning few or none is fine.

Tracks: if the hackathon names its own tracks, themes or problem statements, set "track" to the exact name (or code and name, e.g. "SIH1234 - Smart Water Meter") of the one the project fits. If the hackathon does not name any tracks, set "track" to "".

Reply with only this JSON and no other text:
{"summary":"one sentence on how well the stored projects fit","themes":["each track or theme exactly as the hackathon names it; empty list if it names none"],"matches":[{"id":"P12","track":"track name or empty string","reason":"one sentence, specific to this project"}]}`;
}

function parseJson(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("Could not read the AI reply");
}

export async function matchWithClaude(h, pool) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    max_tokens: 8000,
    messages: [{ role: "user", content: buildPrompt(h, pool) }],
  });
  const text = msg.content.filter((c) => c.type === "text").map((c) => c.text).join("");
  return parseJson(text);
}

export function matchByKeywords(h, teams) {
  const all = preRank(teams, `${h.title} ${h.description}`, 60);
  const top = all[0]?.s || 0;
  const ranked = all.filter((x) => x.s > 0 && x.s >= Math.max(2, top * 0.6)).slice(0, 40);
  return {
    summary: "Matched by shared keywords (add an Anthropic API key for smarter matching).",
    themes: [],
    matches: ranked.map((x) => ({ team: x.t, fit: "strong", track: "", reason: `Shares ${x.s} keyword${x.s > 1 ? "s" : ""} with the hackathon description.` })),
  };
}

export async function fetchLinkText(url) {
  let u;
  try { u = new URL(url); } catch { throw Object.assign(new Error("That link is not a valid web address."), { status: 400 }); }
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname)) throw Object.assign(new Error("Only public web links can be read."), { status: 400 });
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(u, { signal: ctl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (ProjectPortal link reader)" } });
    if (!r.ok) throw Object.assign(new Error(`The page answered with error ${r.status}.`), { status: 400 });
    const html = (await r.text()).slice(0, 2_000_000);
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
    const meta = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) || [])[1] || "";
    const text = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    return { title: title.replace(/\s+/g, " ").trim(), text: [meta, text].filter(Boolean).join("\n").slice(0, 15000) };
  } catch (e) {
    if (e.name === "AbortError") throw Object.assign(new Error("The page took too long to answer."), { status: 400 });
    throw e.status ? e : Object.assign(new Error("Could not open that link from the server."), { status: 400 });
  } finally { clearTimeout(timer); }
}
