"use client";
import { useMemo, useState, useEffect } from "react";
import { batchLabel } from "@/lib/config";
import { downloadCsv } from "./shared";

const PAGE = 20;
const EMPTY = { q: "", dept: "", domain: "", sector: "" };

// Project teams with department chips, search, Domain/Sector filters, a hidden-by-default list and CSV export.
export default function ProjectsPanel({ teams, context, csvName, emptyText, resetKey, showBatch }) {
  const [f, setF] = useState(EMPTY);
  const [showList, setShowList] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => { setF(EMPTY); setShowList(false); setPage(0); }, [resetKey]);

  const filtered = useMemo(() => {
    if (!teams) return [];
    const q = f.q.trim().toLowerCase();
    return teams.filter((t) => (!f.dept || t.dept === f.dept)
      && (!f.domain || t.domain_tags.includes(f.domain))
      && (!f.sector || t.sector_tags.includes(f.sector))
      && (!q || [t.title, t.mentor, t.domain, t.sector, t.dept, ...Object.values(t.extra || {}), ...t.members.flatMap((m) => [m.roll, m.name])].join(" ").toLowerCase().includes(q)));
  }, [teams, f]);

  const options = useMemo(() => {
    const count = (key, pick) => {
      const m = new Map();
      for (const t of teams || []) {
        if (key !== "dept" && f.dept && t.dept !== f.dept) continue;
        if (key !== "domain" && f.domain && !t.domain_tags.includes(f.domain)) continue;
        if (key !== "sector" && f.sector && !t.sector_tags.includes(f.sector)) continue;
        for (const v of pick(t)) if (v) m.set(v, (m.get(v) || 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    };
    return { dept: count("dept", (t) => [t.dept]), domain: count("domain", (t) => t.domain_tags), sector: count("sector", (t) => t.sector_tags) };
  }, [teams, f.dept, f.domain, f.sector]);

  const deptCounts = useMemo(() => {
    const m = new Map(); for (const t of teams || []) m.set(t.dept || "–", (m.get(t.dept || "–") || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [teams]);

  const active = f.q || f.dept || f.domain || f.sector;
  const setFilter = (k, v) => { setF((o) => ({ ...o, [k]: v })); setPage(0); if (k === "q" && v) setShowList(true); };
  const hasExtra = (teams || []).some((t) => t.extra && (t.extra.teamName || t.extra.psId || t.extra.category));

  function exportCsv() {
    const rows = [["Batch", "Year", "Dept", "Section", "Team No", "Team Name", "Problem Statement ID", "Theme / Category", "Roll No", "Student Name", "Faculty Mentor", "Project Title", "Technology Domain", "Sector"]];
    for (const t of filtered) for (const m of (t.members.length ? t.members : [{ roll: "", name: "" }]))
      rows.push([t.batch ? batchLabel(t.batch) : "", t.year || "", t.dept, t.section, t.team_no, t.extra?.teamName || "", t.extra?.psId || "", t.extra?.category || "", m.roll, m.name, t.mentor, t.title, t.domain, t.sector]);
    downloadCsv(csvName, rows);
  }

  const pages = Math.ceil(filtered.length / PAGE);
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <section className="card">
      <div className="card-head">
        <div><h2>Projects</h2><p className="muted small">{teams === null ? "Loading…" : teams.length ? `${teams.length} teams in ${context}. Pick a department or filter to narrow the list.` : emptyText}</p></div>
      </div>
      {teams?.length > 0 && (
        <>
          <div className="deptchips">
            {deptCounts.map(([d, n]) => (
              <button key={d} className={`deptchip${f.dept === d ? " on" : ""}`} onClick={() => setFilter("dept", f.dept === d ? "" : d)}>
                <span>{d}</span><b>{n}</b>
              </button>
            ))}
          </div>
          <div className="filters">
            <label className="field grow"><span>Search</span>
              <input type="search" value={f.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="Title, student, roll no., mentor, team" />
            </label>
            <label className="field"><span>Department</span>
              <select value={f.dept} onChange={(e) => setFilter("dept", e.target.value)}>
                <option value="">All departments</option>
                {options.dept.map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}
              </select>
            </label>
            <label className="field"><span>Technology domain</span>
              <select value={f.domain} onChange={(e) => setFilter("domain", e.target.value)}>
                <option value="">All domains</option>
                {options.domain.map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}
              </select>
            </label>
            <label className="field"><span>Sector</span>
              <select value={f.sector} onChange={(e) => setFilter("sector", e.target.value)}>
                <option value="">All sectors</option>
                {options.sector.map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}
              </select>
            </label>
          </div>
          <div className="resultbar">
            <span><b>{filtered.length}</b> of {teams.length} teams{active ? " match" : ""}</span>
            {active && <button className="linkbtn" onClick={() => { setF(EMPTY); setPage(0); }}>Clear filters</button>}
            <span className="spacer" />
            <button className="btn sm" onClick={exportCsv} disabled={!filtered.length}>Download CSV</button>
            <button className="btn primary sm" onClick={() => setShowList((v) => !v)} aria-expanded={showList}>{showList ? "Hide project list" : "Show project list"}</button>
          </div>
          {showList && (
            <>
              <div className="scroll-x tablebox">
                <table className="data">
                  <thead><tr><th>Dept</th><th>Team</th><th>Project title</th><th>Students</th><th>Mentor</th><th>Domain · Sector</th></tr></thead>
                  <tbody>
                    {shown.map((t) => (
                      <tr key={t.id}>
                        <td className="nowrap"><b>{t.dept || "–"}</b>{t.section && ` – ${t.section}`}{showBatch && t.batch && <div className="muted small">{batchLabel(t.batch)}{t.year ? ` · Yr ${t.year}` : ""}</div>}</td>
                        <td className="mono">#{t.team_no}{t.extra?.teamName && <div className="small" style={{ fontFamily: "var(--f-body)" }}>{t.extra.teamName}</div>}</td>
                        <td className="title-cell">{t.title || <span className="muted">Title not given</span>}
                          {hasExtra && (t.extra?.psId || t.extra?.category) && <div className="muted small" style={{ fontWeight: 400 }}>{[t.extra.psId, t.extra.category].filter(Boolean).join(" · ")}</div>}</td>
                        <td><div className="members">{t.members.map((m, i) => <div key={i}><span className="mono">{m.roll}</span><span>{m.name}</span></div>)}</div></td>
                        <td>{t.mentor}</td>
                        <td>{t.domain_tags.map((d) => <span key={d} className="tag">{d}</span>)}{t.sector_tags.map((s) => <span key={s} className="tag alt">{s}</span>)}</td>
                      </tr>
                    ))}
                    {!shown.length && <tr><td colSpan={6} className="empty">No teams match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <div className="pager">
                  <button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                  <span className="small">Page {page + 1} of {pages}</span>
                  <button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
