"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BATCHES, YEARS, MAX_FILES_PER_YEAR, ALLOWED_EXT, batchLabel, currentYearOf } from "@/lib/config";
import { useMe, api, fmtDate, fmtSize, downloadCsv, FileIcon } from "./shared";

const PAGE = 20;

function defaultSel() {
  try { const s = JSON.parse(localStorage.getItem("sp_sel") || "null"); if (s && BATCHES.includes(s.batch) && YEARS.includes(s.year)) return s; } catch {}
  return { batch: "2025-2029", year: currentYearOf("2025-2029") || "II" };
}

export default function RepositoryView() {
  const me = useMe();
  const [summary, setSummary] = useState(null);
  const [sel, setSel] = useState({ batch: "2025-2029", year: "II" });
  const [teams, setTeams] = useState(null);
  const [f, setF] = useState({ q: "", dept: "", domain: "", sector: "" });
  const [showList, setShowList] = useState(false);
  const [page, setPage] = useState(0);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => { setSel(defaultSel()); }, []);
  const loadSummary = useCallback(() => api("/api/summary").then(setSummary).catch((e) => setMsg({ kind: "err", text: e.message })), []);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  const loadTeams = useCallback(async (s) => {
    setTeams(null);
    try { const d = await api(`/api/teams?batch=${s.batch}&year=${s.year}`); setTeams(d.teams); }
    catch (e) { setTeams([]); setMsg({ kind: "err", text: e.message }); }
  }, []);
  useEffect(() => { loadTeams(sel); }, [sel, loadTeams]);

  function choose(batch, year) {
    const s = { batch, year }; setSel(s); setF({ q: "", dept: "", domain: "", sector: "" }); setShowList(false); setPage(0); setMsg(null); setConfirmDel(null);
    try { localStorage.setItem("sp_sel", JSON.stringify(s)); } catch {}
  }

  const uploads = useMemo(() => (summary?.uploads || []).filter((u) => u.batch === sel.batch && u.year === sel.year), [summary, sel]);
  const agg = useMemo(() => {
    const a = {};
    for (const u of summary?.uploads || []) { const k = u.batch + "_" + u.year; a[k] ||= { files: 0, teams: 0 }; a[k].files++; a[k].teams += u.team_count; }
    return a;
  }, [summary]);

  const filtered = useMemo(() => {
    if (!teams) return [];
    const q = f.q.trim().toLowerCase();
    return teams.filter((t) => (!f.dept || t.dept === f.dept)
      && (!f.domain || t.domain_tags.includes(f.domain))
      && (!f.sector || t.sector_tags.includes(f.sector))
      && (!q || [t.title, t.mentor, t.domain, t.sector, t.dept, ...t.members.flatMap((m) => [m.roll, m.name])].join(" ").toLowerCase().includes(q)));
  }, [teams, f]);

  // Option lists with counts, based on the other active filters
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
    const m = new Map(); for (const t of teams || []) m.set(t.dept, (m.get(t.dept) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [teams]);

  const active = f.q || f.dept || f.domain || f.sector;
  const setFilter = (k, v) => { setF((o) => ({ ...o, [k]: v })); setPage(0); if (k === "q" && v) setShowList(true); };

  async function handleFiles(files) {
    if (busy || !files.length) return;
    const room = MAX_FILES_PER_YEAR - uploads.length;
    if (files.length > room) { setMsg({ kind: "err", text: `Only ${room} more document${room === 1 ? "" : "s"} can be stored for Year ${sel.year}. Choose fewer files.` }); return; }
    const bad = files.filter((x) => !ALLOWED_EXT.includes(x.name.split(".").pop().toLowerCase()));
    if (bad.length) { setMsg({ kind: "err", text: `${bad.map((x) => x.name).join(", ")}: use .xlsx, .csv, .pdf, .docx or .pptx.` }); return; }
    setBusy(true);
    try {
      for (const file of files) {
        let parsed = { teams: [], warnings: [] };
        if (/\.(xlsx|csv)$/i.test(file.name)) {
          setMsg({ text: `Reading ${file.name}…` });
          const XLSX = await import("xlsx");
          const { parseWorkbook } = await import("@/lib/parser");
          parsed = parseWorkbook(XLSX, XLSX.read(await file.arrayBuffer(), { type: "array" }));
        }
        setMsg({ text: `Saving ${file.name}…` });
        let fileUrl;
        if (me?.blob) {
          const { upload } = await import("@vercel/blob/client");
          const safe = file.name.replace(/[^\w.\-]+/g, "_");
          const r = await upload(`projects/${sel.batch}/Year-${sel.year}/${safe}`, file, { access: me.blobAccess, handleUploadUrl: "/api/blob", multipart: file.size > 5e6 });
          fileUrl = r.url;
        } else {
          const fd = new FormData(); fd.append("file", file);
          fileUrl = (await api("/api/files/local", { method: "POST", body: fd })).url;
        }
        await api("/api/uploads", { method: "POST", json: { batch: sel.batch, year: sel.year, fileName: file.name, sizeBytes: file.size, contentType: file.type, fileUrl, teams: parsed.teams, warnings: parsed.warnings } });
      }
      setMsg({ kind: "ok", text: `Saved ${files.length} document${files.length > 1 ? "s" : ""} to Batch ${batchLabel(sel.batch)}, Year ${sel.year}.` });
      await Promise.all([loadSummary(), loadTeams(sel)]);
    } catch (e) { setMsg({ kind: "err", text: e.message || "The upload failed. Try again." }); }
    finally { setBusy(false); }
  }

  async function del(u) {
    try { await api(`/api/uploads/${u.id}`, { method: "DELETE" }); setConfirmDel(null); setMsg({ kind: "ok", text: `Deleted ${u.file_name}.` }); await Promise.all([loadSummary(), loadTeams(sel)]); }
    catch (e) { setMsg({ kind: "err", text: e.message }); }
  }

  function exportCsv() {
    const rows = [["Batch", "Year", "Dept", "Section", "Team No", "Roll No", "Student Name", "Faculty Mentor", "Project Title", "Technology Domain", "Sector"]];
    for (const t of filtered) for (const m of (t.members.length ? t.members : [{ roll: "", name: "" }])) rows.push([batchLabel(t.batch), t.year, t.dept, t.section, t.team_no, m.roll, m.name, t.mentor, t.title, t.domain, t.sector]);
    downloadCsv(`Projects_${sel.batch}_Year-${sel.year}.csv`, rows);
  }

  const totals = summary?.totals;
  const isAdmin = me?.role === "admin";
  const pages = Math.ceil(filtered.length / PAGE);
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <>
      <section className="hero">
        <div className="container hero-in">
          <div className="hero-text">
            <div className="hero-eyebrow">Design Thinking &amp; Innovation</div>
            <h1 className="hero-title">Student Project Repository</h1>
            <p className="hero-sub">Every II, III and IV year project team, stored batch-wise from 2023–27 to 2027–31, ready to be shortlisted for hackathons.</p>
          </div>
          <dl className="stats">
            <div><dt>Project teams</dt><dd>{totals ? totals.teams.toLocaleString("en-IN") : "–"}</dd></div>
            <div><dt>Students</dt><dd>{totals ? totals.students.toLocaleString("en-IN") : "–"}</dd></div>
            <div><dt>Departments</dt><dd>{totals ? totals.depts : "–"}</dd></div>
            <div><dt>Hackathons</dt><dd>{totals ? totals.hackathons : "–"}</dd></div>
          </dl>
        </div>
      </section>

      <div className="container stack">
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

        <section className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Batch {batchLabel(sel.batch)}</div>
              <h2>Year {sel.year} documents</h2>
            </div>
            <span className="pill">{uploads.length} of {MAX_FILES_PER_YEAR} stored</span>
          </div>
          <div className="doclist">
            {uploads.map((u) => (
              <div className="doc" key={u.id}>
                <FileIcon name={u.file_name} />
                <div className="doc-main">
                  <div className="doc-name">{u.file_name}</div>
                  <div className="muted small">
                    {u.team_count ? `${u.team_count} teams · ${u.student_count} students · ` : "Stored as a document · "}{fmtSize(u.size_bytes)} · {fmtDate(u.uploaded_at)}
                  </div>
                  {u.warnings?.length > 0 && <div className="warn small">{u.warnings.join("; ")}</div>}
                </div>
                <div className="doc-acts">
                  {confirmDel === u.id ? (
                    <>
                      <span className="small">Delete this document and its {u.team_count} teams?</span>
                      <button className="btn danger sm" onClick={() => del(u)}>Delete</button>
                      <button className="btn sm" onClick={() => setConfirmDel(null)}>Keep</button>
                    </>
                  ) : (
                    <>
                      <a className="btn sm" href={`/api/uploads/${u.id}/file`}>Download</a>
                      {isAdmin && <button className="btn ghost-danger sm" onClick={() => setConfirmDel(u.id)}>Delete</button>}
                    </>
                  )}
                </div>
              </div>
            ))}
            {!uploads.length && <div className="empty">No documents stored for this batch and year yet.</div>}
          </div>
          {isAdmin && uploads.length < MAX_FILES_PER_YEAR && (
            <label className={`dropzone${drag ? " over" : ""}${busy ? " busy" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles([...e.dataTransfer.files]); }}>
              <input id="fileIn" type="file" multiple accept=".xlsx,.csv,.pdf,.docx,.pptx" disabled={busy} onChange={(e) => { handleFiles([...e.target.files]); e.target.value = ""; }} />
              <strong>{busy ? "Uploading…" : "Upload documents"}</strong>
              <span className="muted small">Drop files here or click to choose (up to {MAX_FILES_PER_YEAR - uploads.length} more). Excel sheets in the Design Thinking format are read into the project list. PDF, Word and PowerPoint files are stored as they are.</span>
            </label>
          )}
          {me && !isAdmin && <p className="muted small">Only the portal admin can upload or delete documents.</p>}
          {msg && <div className={`alert ${msg.kind || ""}`}>{msg.text}</div>}
        </section>

        <section className="card">
          <div className="card-head">
            <div><h2>Projects</h2><p className="muted small">{teams === null ? "Loading…" : teams.length ? `${teams.length} teams in Batch ${batchLabel(sel.batch)}, Year ${sel.year}. Pick a department or filter to narrow the list.` : "Upload the Design Thinking spreadsheet to see projects here."}</p></div>
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
                  <input id="q" type="search" value={f.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="Title, student, roll no. or mentor" />
                </label>
                <label className="field"><span>Department</span>
                  <select id="fDept" value={f.dept} onChange={(e) => setFilter("dept", e.target.value)}>
                    <option value="">All departments</option>
                    {options.dept.map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}
                  </select>
                </label>
                <label className="field"><span>Technology domain</span>
                  <select id="fDomain" value={f.domain} onChange={(e) => setFilter("domain", e.target.value)}>
                    <option value="">All domains</option>
                    {options.domain.map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}
                  </select>
                </label>
                <label className="field"><span>Sector</span>
                  <select id="fSector" value={f.sector} onChange={(e) => setFilter("sector", e.target.value)}>
                    <option value="">All sectors</option>
                    {options.sector.map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}
                  </select>
                </label>
              </div>

              <div className="resultbar">
                <span><b>{filtered.length}</b> of {teams.length} teams{active ? " match" : ""}</span>
                {active && <button className="linkbtn" onClick={() => { setF({ q: "", dept: "", domain: "", sector: "" }); setPage(0); }}>Clear filters</button>}
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
                            <td className="nowrap"><b>{t.dept}</b>{t.section && ` – ${t.section}`}</td>
                            <td className="mono">#{t.team_no}</td>
                            <td className="title-cell">{t.title || <span className="muted">Title not given</span>}</td>
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
      </div>
    </>
  );
}
