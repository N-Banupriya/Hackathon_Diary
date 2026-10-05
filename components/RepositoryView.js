"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BATCHES, YEARS, MAX_FILES_PER_YEAR, batchLabel, currentYearOf } from "@/lib/config";
import { useMe, api } from "./shared";
import DocumentsPanel from "./DocumentsPanel";
import ProjectsPanel from "./ProjectsPanel";

function defaultSel() {
  try { const s = JSON.parse(localStorage.getItem("sp_sel") || "null"); if (s && BATCHES.includes(s.batch) && YEARS.includes(s.year)) return s; } catch {}
  return { batch: "2025-2029", year: currentYearOf("2025-2029") || "II" };
}

export default function RepositoryView() {
  const me = useMe();
  const [summary, setSummary] = useState(null);
  const [sel, setSel] = useState({ batch: "2025-2029", year: "II" });
  const [teams, setTeams] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => { setSel(defaultSel()); }, []);
  const loadSummary = useCallback(() => api("/api/summary").then(setSummary).catch((e) => setErr(e.message)), []);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  const loadTeams = useCallback(async (s) => {
    setTeams(null);
    try { const d = await api(`/api/teams?batch=${s.batch}&year=${s.year}`); setTeams(d.teams); }
    catch (e) { setTeams([]); setErr(e.message); }
  }, []);
  useEffect(() => { loadTeams(sel); }, [sel, loadTeams]);

  function choose(batch, year) {
    const s = { batch, year }; setSel(s); setErr(null);
    try { localStorage.setItem("sp_sel", JSON.stringify(s)); } catch {}
  }

  const dtUploads = useMemo(() => (summary?.uploads || []).filter((u) => !u.collection_id), [summary]);
  const uploads = useMemo(() => dtUploads.filter((u) => u.batch === sel.batch && u.year === sel.year), [dtUploads, sel]);
  const agg = useMemo(() => {
    const a = {};
    for (const u of dtUploads) { const k = u.batch + "_" + u.year; a[k] ||= { files: 0, teams: 0 }; a[k].files++; a[k].teams += u.team_count; }
    return a;
  }, [dtUploads]);
  const totals = summary?.totals;

  return (
    <>
      <section className="hero">
        <div className="container hero-in">
          <div className="hero-text">
            <div className="hero-eyebrow">Design Thinking &amp; Innovation</div>
            <h1 className="hero-title">Student Project Repository</h1>
            <p className="hero-sub">Every II, III and IV year project team, stored batch-wise from 2023–27 to 2027–31, plus SIH, MSME and other project collections, ready to be shortlisted for hackathons.</p>
          </div>
          <dl className="stats">
            <div><dt>Project teams</dt><dd>{totals ? totals.teams.toLocaleString("en-IN") : "–"}</dd></div>
            <div><dt>Students</dt><dd>{totals ? totals.students.toLocaleString("en-IN") : "–"}</dd></div>
            <div><dt>Collections</dt><dd>{totals ? totals.collections : "–"}</dd></div>
            <div><dt>Hackathons</dt><dd>{totals ? totals.hackathons : "–"}</dd></div>
          </dl>
        </div>
      </section>

      <div className="container stack">
        {err && <div className="alert err">{err}</div>}
        <section className="card">
          <div className="card-head">
            <div><h2>Select batch and year</h2><p className="muted small">The gold outline marks the year each batch is studying in now.</p></div>
          </div>
          <div className="scroll-x">
            <table className="slotgrid">
              <thead><tr><th></th>{YEARS.map((y) => <th key={y}>Year {y}</th>)}</tr></thead>
              <tbody>
                {BATCHES.map((b) => (
                  <tr key={b}>
                    <th scope="row">{batchLabel(b)}</th>
                    {YEARS.map((y) => {
                      const a = agg[b + "_" + y]; const on = sel.batch === b && sel.year === y; const now = currentYearOf(b) === y;
                      return (
                        <td key={y}>
                          <button className={`slot${on ? " on" : ""}${now ? " now" : ""}${a ? "" : " empty"}`} onClick={() => choose(b, y)} aria-pressed={on}>
                            {a ? <><b>{a.teams}</b> teams<small>{a.files}/{MAX_FILES_PER_YEAR} documents</small></> : <span>No uploads</span>}
                            {now && <em>Current</em>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <DocumentsPanel
          key={sel.batch + sel.year}
          me={me}
          eyebrow={`Batch ${batchLabel(sel.batch)}`}
          heading={`Year ${sel.year} documents`}
          uploads={uploads}
          max={MAX_FILES_PER_YEAR}
          target={{ batch: sel.batch, year: sel.year }}
          folder={`projects/${sel.batch}/Year-${sel.year}`}
          label={`Batch ${batchLabel(sel.batch)}, Year ${sel.year}`}
          emptyText="No documents stored for this batch and year yet."
          onChanged={() => Promise.all([loadSummary(), loadTeams(sel)])}
        />

        <ProjectsPanel
          teams={teams}
          resetKey={sel.batch + sel.year}
          context={`Batch ${batchLabel(sel.batch)}, Year ${sel.year}`}
          csvName={`Projects_${sel.batch}_Year-${sel.year}.csv`}
          emptyText="Upload the Design Thinking spreadsheet to see projects here."
        />
      </div>
    </>
  );
}
