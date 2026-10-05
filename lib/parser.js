// Reads project-team workbooks into teams. Handles:
//  - the Design Thinking format (one sheet per department/section, one row per student,
//    a team starts at each new Batch No.), and
//  - other lists such as SIH or MSME, found by column headings: one row per student,
//    or one row per team with members in columns (Member 1 Name, Member 1 Roll No, ...).
// Only identity and project columns are kept (no CoE or other extra columns).
import { domainTags, sectorTags } from "./taxonomy";

const clean = (v) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());

// Roll-number department codes used at SECE (e.g. 25AD012 -> AIDS).
const ROLL_DEPT = { AD: "AIDS", AM: "AIML", CS: "CSE", EC: "ECE", CC: "CCE", CB: "CSBS", SY: "CYBER", ME: "MECH", EE: "EEE", IT: "IT", CE: "CIVIL", MT: "MECHATRONICS", BM: "BME" };
export function rollInfo(roll) {
  const m = String(roll || "").toUpperCase().match(/^(\d{2})([A-Z]{2})\d+/);
  if (!m) return {};
  const y = 2000 + Number(m[1]);
  return { dept: ROLL_DEPT[m[2]] || "", batch: `${y}-${y + 4}` };
}

function detectColumns(H) {
  const idx = (re, not) => H.findIndex((h) => re.test(h) && !(not && not.test(h)));
  const all = (re, not) => H.map((h, i) => (re.test(h) && !(not && not.test(h)) ? i : -1)).filter((i) => i >= 0);
  const NOT_PERSON = /team ?name|mentor|faculty|guide|college|institut|project|idea|problem|title|dept|department|branch|company|organi[sz]|startup|father|parent|spoc|coordinator/;
  const col = {
    no: idx(/^(batch|team|group)\s*(no|number|id|#)|^s\.?\s*no|^sl\.?\s*no|^sr\.?\s*no/),
    teamName: idx(/team ?name|group ?name/),
    title: idx(/project ?title|idea ?title|title of (the )?(project|idea)|solution ?title|product ?name/),
    psTitle: idx(/problem ?statement ?(title|name)|^problem ?statement$|ps ?title/),
    psId: idx(/problem ?statement ?(id|code|no|number)|^ps ?(id|code|no)/),
    category: idx(/^theme|category|track|^domain bucket/),
    mentor: idx(/mentor|guide|faculty|spoc|coordinator/, /student|member/),
    domain: idx(/technology ?domain|^domain|tech ?stack|technology/),
    sector: idx(/sector|industry/),
    dept: idx(/^dept|department|branch|discipline/, /department of /),
    year: idx(/^year|year of study|study year|^yr\b/),
    batch: idx(/^batch\b|academic ?batch|batch ?\(/, /no|number|id/),
    section: idx(/^section|^sec\b/),
    rolls: all(/roll|reg(ister|istration)?\.? ?(no|number)|register ?number|\busn\b|student ?id|admission ?no/),
    names: all(/name/, NOT_PERSON),
  };
  if (col.title < 0 && col.psTitle >= 0) { col.title = col.psTitle; col.psTitle = -1; }
  if (col.title < 0) col.title = idx(/title/);
  return col;
}

export function parseWorkbook(XLSX, wb) {
  const out = [];
  const warnings = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, blankrows: true, raw: true });
    // Header row: the first row (in the top 20) with a roll/name column and a title or team column.
    let hdr = -1, col = null;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const H = (rows[i] || []).map((c) => clean(c).toLowerCase());
      const c = detectColumns(H);
      if ((c.rolls.length || c.names.length) && (c.title >= 0 || c.no >= 0 || c.teamName >= 0 || c.rolls.length)) { hdr = i; col = c; break; }
    }
    if (hdr < 0) continue; // e.g. a "Lists" or instructions sheet

    // Department / section from heading lines ("Department of AIDS | II Year", "Section: A") or the sheet name.
    const top = rows.slice(0, hdr).map((r) => (r || []).map(clean).join(" ")).join(" | ");
    let sheetDept = "", sheetSection = "";
    const dm = top.match(/Department of\s+(.+?)\s*(\||$)/i);
    if (dm) sheetDept = dm[1].trim();
    const sm = top.match(/Section\s*:\s*([A-Z])\b/i);
    if (sm) sheetSection = sm[1].toUpperCase();
    const sn = sheetName.match(/^\s*([A-Za-z&]+)\s*[-–]\s*([A-Z])\s*$/);
    if (!sheetDept && sn) sheetDept = sn[1];
    if (!sheetSection && sn) sheetSection = sn[2];
    if (!sheetDept && /^[A-Za-z&]{2,8}$/.test(sheetName.trim()) && !/^sheet/i.test(sheetName)) sheetDept = sheetName.trim();
    const normDept = canonDept;

    const g = (r, i) => (i >= 0 ? clean(r[i]) : "");
    const wide = col.rolls.length > 1 || col.names.length > 1;
    const extraOf = (r) => {
      const e = {};
      if (g(r, col.teamName)) e.teamName = g(r, col.teamName);
      if (g(r, col.psId)) e.psId = g(r, col.psId);
      if (g(r, col.psTitle)) e.psTitle = g(r, col.psTitle);
      if (g(r, col.category)) e.category = g(r, col.category);
      return e;
    };
    const newTeam = (r, no) => ({
      dept: normDept(g(r, col.dept)) || normDept(sheetDept),
      section: g(r, col.section) || sheetSection,
      teamNo: no,
      title: g(r, col.title),
      mentor: g(r, col.mentor),
      domain: g(r, col.domain),
      sector: g(r, col.sector),
      year: g(r, col.year),
      batch: g(r, col.batch),
      extra: extraOf(r),
      members: [],
    });

    let cur = null, blanks = 0, count = 0;
    for (let i = hdr + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      if (!r.some((v) => clean(v))) { if (++blanks > 25) break; continue; }
      blanks = 0;
      if (wide) {
        // One row per team: pair the roll and name columns in order.
        const n = Math.max(col.rolls.length, col.names.length);
        const members = [];
        for (let k = 0; k < n; k++) {
          const roll = g(r, col.rolls[k] ?? -1).toUpperCase(), name = g(r, col.names[k] ?? -1);
          if (roll || name) members.push({ roll, name });
        }
        if (!members.length && !g(r, col.title)) continue;
        count++;
        const t = newTeam(r, g(r, col.no) || String(count));
        t.members = members;
        out.push(t);
        continue;
      }
      const roll = g(r, col.rolls[0] ?? -1).toUpperCase(), name = g(r, col.names[0] ?? -1);
      const no = g(r, col.no), title = g(r, col.title), teamName = g(r, col.teamName);
      if (!roll && !name && !title && !no && !teamName) continue;
      const startsNew = !cur || no
        || (col.no < 0 && teamName && teamName !== (cur.extra.teamName || ""))
        || (col.no < 0 && col.teamName < 0 && title && cur.title && title !== cur.title);
      if (!startsNew) {
        for (const k of ["title", "mentor", "domain", "sector", "year", "batch"]) if (!cur[k]) cur[k] = g(r, col[k]);
        cur.extra = { ...extraOf(r), ...cur.extra };
      } else {
        count++;
        cur = newTeam(r, no || String(count));
        out.push(cur);
      }
      if (roll || name) cur.members.push({ roll, name });
    }
  }
  const teams = out.filter((t) => t.members.length || t.title).map((t) => {
    const info = rollInfo(t.members[0]?.roll);
    const title = t.title || t.extra.psTitle || t.extra.teamName || "";
    return { ...t, title, dept: t.dept || info.dept || "", batch: normBatch(t.batch) || info.batch || "", year: normYear(t.year), domainTags: domainTags(t.domain), sectorTags: sectorTags(t.sector) };
  });
  const noTitle = teams.filter((t) => !t.title).length;
  if (noTitle) warnings.push(`${noTitle} team${noTitle > 1 ? "s have" : " has"} no project title yet`);
  if (!teams.length) warnings.push("No project table found (expected columns such as Roll No., Name and Project Title)");
  return { teams, warnings };
}

// Full department names -> the short codes used across the portal.
const DEPT_NAMES = [
  [/business ?systems|csbs/i, "CSBS"], [/cyber/i, "CYBER"], [/data ?science|aids|ai ?& ?ds|ai ?and ?ds/i, "AIDS"],
  [/machine ?learning|aiml|ai ?& ?ml|ai ?and ?ml/i, "AIML"], [/computer ?and ?communication|\bcce\b/i, "CCE"],
  [/computer ?science|\bcse\b/i, "CSE"], [/electronics ?(and|&) ?communication|\bece\b/i, "ECE"],
  [/electrical|\beee\b/i, "EEE"], [/information ?technology|^it$/i, "IT"], [/mechatronics/i, "MECHATRONICS"],
  [/mechanical|^mech$/i, "MECH"], [/civil/i, "CIVIL"], [/bio ?medical|\bbme\b/i, "BME"],
];
export function canonDept(d) {
  const v = clean(d).replace(/^department of\s+/i, "").replace(/\s+engineering$/i, (m) => m);
  if (!v) return "";
  for (const [re, code] of DEPT_NAMES) if (re.test(v)) return code;
  return v.length <= 8 ? v.toUpperCase() : v;
}

function normBatch(v) {
  const m = String(v || "").replace(/[–—]/g, "-").match(/(20)?(\d{2})\s*-\s*(20)?(\d{2})/);
  return m ? `20${m[2]}-20${m[4]}` : "";
}
function normYear(v) {
  const s = String(v || "").toUpperCase().replace(/YEAR|YR|\./g, "").trim();
  return { "1": "I", "2": "II", "3": "III", "4": "IV", I: "I", II: "II", III: "III", IV: "IV", FIRST: "I", SECOND: "II", THIRD: "III", FOURTH: "IV" }[s] || "";
}
