"use client";
import { useCallback, useEffect, useState } from "react";
import { BATCHES, YEARS, batchLabel, currentYearOf } from "@/lib/config";
import { useMe, api, fmtDate } from "./shared";

const blank = () => ({ title: "", link: "", deadline: "", description: "", batches: BATCHES.filter((b) => currentYearOf(b)), years: ["II", "III", "IV"] });

export default function HackathonsView() {
  const me = useMe();
  const [list, setList] = useState(null);
  const [selId, setSelId] = useState(null);
  const [editing, setEditing] = useState(null); // null | "new" | "edit"
  const [form, setForm] = useState(blank());
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [checked, setChecked] = useState(() => new Set());
  const [progress, setProgress] = useState(null); // {total, done, current, failed:[]}
  const [bulk, setBulk] = useState(null); // {fileName, rows, errors}
  const [bulkMsg, setBulkMsg] = useState(null);

  const load = useCallback(async (keep) => {
    try {
      const d = await api("/api/hackathons"); setList(d.hackathons);
      setSelId((cur) => keep || cur || d.hackathons[0]?.id || null);
    } catch (e) { setList([]); setMsg({ kind: "err", text: e.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const h = list?.find((x) => x.id === selId);
  const set = (k, v) => setForm((o) => ({ ...o, [k]: v }));
  const toggle = (k, v) => setForm((o) => ({ ...o, [k]: o[k].includes(v) ? o[k].filter((x) => x !== v) : [...o[k], v] }));

  function startNew() { setForm(blank()); setEditing("new"); setMsg(null); }
  function startEdit() { setForm({ title: h.title, link: h.link || "", deadline: h.deadline || "", description: h.description || "", batches: h.batches, years: h.years }); setEditing("edit"); setMsg(null); }

  async function readLink() {
    if (!form.link) { setMsg({ kind: "err", text: "Paste the hackathon link first." }); return; }
    setBusy("link"); setMsg(null);
    try {
      const d = await api("/api/link-text", { method: "POST", json: { url: form.link } });
      if (!d.text || d.text.length < 80) setMsg({ kind: "warn", text: "That page shows very little text to a server (it may need JavaScript or a login). Copy the themes or problem statements from the page and paste them into the description." });
      else { setForm((o) => ({ ...o, title: o.title || d.title, description: (o.description ? o.description + "\n\n" : "") + d.text })); setMsg({ kind: "ok", text: "Page text added to the description. Remove anything that is not about themes, rules or eligibility." }); }
    } catch (e) { setMsg({ kind: "err", text: e.message }); }
    finally { setBusy(""); }
  }

  async function save(e) {
    e.preventDefault(); setBusy("save"); setMsg(null);
    try {
      if (editing === "new") { const d = await api("/api/hackathons", { method: "POST", json: form }); await load(d.id); setSelId(d.id); }
      else { await api(`/api/hackathons/${selId}`, { method: "PUT", json: form }); await load(selId); }
      setEditing(null);
    } catch (e2) { setMsg({ kind: "err", text: e2.message }); }
    finally { setBusy(""); }
  }

  async function runMatch() {
    setBusy("match"); setMsg(null);
    try { await api(`/api/hackathons/${selId}/match`, { method: "POST" }); await load(selId); }
    catch (e) { setMsg({ kind: "err", text: e.message }); }
    finally { setBusy(""); }
  }

  async function remove() {
    try { await api(`/api/hackathons/${selId}`, { method: "DELETE" }); setConfirmDel(false); setSelId(null); await load(); }
    catch (e) { setMsg({ kind: "err", text: e.message }); }
  }


  /* ---------- many hackathons ---------- */
  const toggleCheck = (id) => setChecked((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allChecked = list?.length > 0 && list.every((x) => checked.has(x.id));
  const chosen = (list || []).filter((x) => checked.has(x.id));
  const chosenMatched = chosen.filter((x) => x.matches);

  function startBulk() { setEditing("bulk"); setBulk(null); setMsg(null); }

  function toISODate(v) {
    if (v == null || v === "") return "";
    if (typeof v === "number" && v > 30000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10);
    const t = String(v).trim();
    let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const d = new Date(t);
    return isNaN(d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  }

  async function readBulkFile(file) {
    setMsg(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets["Hackathons"] || wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, blankrows: false });
      const head = (grid[0] || []).map((c) => String(c).toLowerCase());
      const col = (...k) => head.findIndex((h) => k.some((x) => h.includes(x)));
      const c = { title: col("name", "hackathon"), link: col("link", "url"), deadline: col("deadline", "date"), description: col("theme", "track", "problem", "description"), batches: col("batch"), years: col("year") };
      if (c.title < 0) throw new Error("Could not find a 'Hackathon Name' column. Use the template.");
      const rows = [];
      grid.slice(1).forEach((r, i) => {
        const g = (k) => (c[k] >= 0 ? r[c[k]] : "");
        const title = String(g("title") || "").trim();
        if (!title || /^e\.g\./i.test(title)) return;
        rows.push({ row: i + 2, title, link: String(g("link") || "").trim(), deadline: toISODate(g("deadline")), description: String(g("description") || "").trim(), batches: String(g("batches") || ""), years: String(g("years") || "") });
      });
      if (!rows.length) throw new Error("No hackathons found. Fill one row per hackathon from row 3 of the template.");
      if (rows.length > 50) throw new Error(`The file has ${rows.length} hackathons. Add at most 50 at a time.`);
      setBulk({ fileName: file.name, rows, errors: [] });
    } catch (e) { setBulk(null); setMsg({ kind: "err", text: e.message || "Could not read that file." }); }
  }

  async function addBulk() {
    setBusy("bulk"); setMsg(null);
    try {
      const r = await fetch("/api/hackathons/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: bulk.rows }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setBulk((b) => ({ ...b, errors: d.errors || [] })); setMsg({ kind: "err", text: d.errors?.length ? "Fix the rows marked below in your Excel file, then choose it again. Nothing was added." : d.error || "Could not add the hackathons." }); return; }
      await load(d.ids[0]);
      setChecked(new Set(d.ids)); setEditing(null); setBulk(null);
      setMsg(null); setBulkMsg({ kind: "ok", text: `Added ${d.added} hackathons and selected them. Press "Match selected" to find teams for all of them.` });
    } finally { setBusy(""); }
  }

  async function matchMany(ids) {
    const todo = ids.slice();
    const failed = [];
    let done = 0;
    setProgress({ total: todo.length, done: 0, current: [], failed: [] });
    setBulkMsg(null);
    const titleOf = (id) => list.find((x) => x.id === id)?.title || "";
    const worker = async () => {
      while (todo.length) {
        const id = todo.shift();
        setProgress((p) => ({ ...p, current: [...p.current, titleOf(id)] }));
        try { await api(`/api/hackathons/${id}/match`, { method: "POST" }); }
        catch (e) { failed.push(`${titleOf(id)}: ${e.message}`); }
        done++;
        setProgress((p) => ({ ...p, done, failed: [...failed], current: p.current.filter((t) => t !== titleOf(id)) }));
      }
    };
    await Promise.all([worker(), worker()]);
    await load(selId);
    setProgress(null);
    setBulkMsg(failed.length ? { kind: "warn", text: `Matched ${done - failed.length} of ${done}. Not matched: ${failed.join(" · ")}` } : { kind: "ok", text: `Matched all ${done} hackathons. Press "Download Excel (ZIP)" to get the files.` });
  }

  const matches = (h?.matches || []).filter((m) => m.fit !== "possible");
  const hasTrack = matches.some((m) => m.track);
  const depts = [...new Set(matches.map((m) => m.dept))].sort();

  return (
    <>
      <section className="hero slim">
        <div className="container hero-in">
          <div className="hero-text">
            <div className="hero-eyebrow">Hackathon matching</div>
            <h1 className="hero-title">Find teams for every hackathon</h1>
            <p className="hero-sub">Add a hackathon with its link and problem statements. The portal reads every stored project and recommends only the teams that are a strong fit, with batch, year, track, roll numbers, names, project title and faculty mentor.</p>
          </div>
          <div className="hero-cta row"><button className="btn gold" onClick={startNew}>+ Add hackathon</button><button className="btn" onClick={startBulk}>Add many from Excel</button></div>
        </div>
      </section>

      {list?.length > 0 && (
        <div className="container">
          <div className="bulkbar">
            <label className="checkline"><input id="checkAll" type="checkbox" checked={allChecked} onChange={() => setChecked(allChecked ? new Set() : new Set(list.map((x) => x.id)))} /> Select all</label>
            <button className="linkbtn" onClick={() => setChecked(new Set(list.filter((x) => !x.matches).map((x) => x.id)))}>Select not-matched</button>
            <span className="muted small">{chosen.length} selected</span>
            <span className="spacer" />
            <button className="btn primary sm" disabled={!chosen.length || !!progress} onClick={() => matchMany(chosen.map((x) => x.id))}>Match selected ({chosen.length})</button>
            {chosenMatched.length > 0 && !progress
              ? <a className="btn gold sm" href={`/api/hackathons/export-zip?ids=${chosenMatched.map((x) => x.id).join(",")}`}>Download Excel (ZIP) · {chosenMatched.length}</a>
              : <button className="btn gold sm" disabled>Download Excel (ZIP)</button>}
          </div>
          {progress && (
            <div className="progress">
              <div className="progress-top"><b>Matching {Math.min(progress.done + 1, progress.total)} of {progress.total}…</b><span className="muted small">{progress.current.join(" · ")}</span></div>
              <div className="bar"><span style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
              <div className="muted small">Each hackathon takes up to a minute. Keep this page open until it finishes.</div>
            </div>
          )}
          {bulkMsg && <div className={`alert ${bulkMsg.kind || ""}`}>{bulkMsg.text}</div>}
        </div>
      )}

      <div className="container hk">
        <aside className="hk-list">
          <div className="eyebrow">Hackathons ({list?.length ?? "…"})</div>
          {list?.length === 0 && <div className="empty small">No hackathons added yet.</div>}
          {list?.map((x) => (
            <div key={x.id} className="hk-row">
            <input type="checkbox" aria-label={`Select ${x.title}`} checked={checked.has(x.id)} onChange={() => toggleCheck(x.id)} />
            <button className={`hk-item${x.id === selId && !editing ? " on" : ""}`} onClick={() => { setSelId(x.id); setEditing(null); setMsg(null); setConfirmDel(false); setShowAll(false); }}>
              <span className="hk-title">{x.title}</span>
              <span className="muted small">{x.deadline ? `Deadline ${fmtDate(x.deadline)}` : "No deadline set"}</span>
              <span className={`small ${x.matches ? "okc" : "muted"}`}>{x.matches ? `${x.matches.filter((m) => m.fit !== "possible").length} strong recommendations` : "Not matched yet"}</span>
            </button>
            </div>
          ))}
        </aside>

        <section className="card hk-panel">
          {editing === "bulk" ? (
            <div className="form">
              <h2>Add many hackathons from Excel</h2>
              <ol className="steps">
                <li><a href="/api/hackathons/template">Download the template</a> and fill one row per hackathon: name, link, deadline and the themes or problem statements. Batches and years are optional.</li>
                <li>Choose the filled file below and check the list.</li>
                <li>Press <b>Add</b>, then <b>Match selected</b>, then <b>Download Excel (ZIP)</b>.</li>
              </ol>
              <label className="dropzone">
                <input id="bulkFile" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { if (e.target.files[0]) readBulkFile(e.target.files[0]); e.target.value = ""; }} />
                <strong>{bulk ? bulk.fileName : "Choose the filled template"}</strong>
                <span className="muted small">.xlsx or .csv, up to 50 hackathons</span>
              </label>
              {bulk && (
                <div className="scroll-x tablebox">
                  <table className="data">
                    <thead><tr><th>Row</th><th>Hackathon</th><th>Deadline</th><th>Themes</th><th>Batches · Years</th></tr></thead>
                    <tbody>
                      {bulk.rows.map((r) => {
                        const err = bulk.errors.find((x) => x.row === r.row);
                        return (
                          <tr key={r.row}>
                            <td className="mono">{r.row}</td>
                            <td className="title-cell">{r.title}{r.link && <div className="muted small">{r.link}</div>}{err && <div className="small" style={{ color: "var(--red)" }}>{err.error}</div>}</td>
                            <td className="nowrap">{r.deadline ? fmtDate(r.deadline) : <span className="muted">–</span>}</td>
                            <td className="small">{r.description ? `${r.description.slice(0, 90)}${r.description.length > 90 ? "…" : ""}` : <span className="warn">{r.link ? "Will be read from the link" : "Missing"}</span>}</td>
                            <td className="small">{r.batches || "All current"} · {r.years || "II, III, IV"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {msg && <div className={`alert ${msg.kind || ""}`}>{msg.text}</div>}
              <div className="row">
                <button className="btn primary" disabled={!bulk || busy === "bulk"} onClick={addBulk}>{busy === "bulk" ? "Adding…" : bulk ? `Add ${bulk.rows.length} hackathons` : "Add"}</button>
                <button className="btn" onClick={() => { setEditing(null); setBulk(null); setMsg(null); }}>Cancel</button>
              </div>
            </div>
          ) : editing ? (
            <form onSubmit={save} className="form">
              <h2>{editing === "new" ? "Add a hackathon" : "Edit hackathon"}</h2>
              <label className="field"><span>Hackathon name</span><input id="hTitle" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Smart India Hackathon 2026" /></label>
              <div className="two">
                <label className="field"><span>Link</span>
                  <div className="inline"><input id="hLink" type="url" value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="https://…" />
                    <button type="button" className="btn sm" onClick={readLink} disabled={busy === "link"}>{busy === "link" ? "Reading…" : "Read page"}</button></div>
                </label>
                <label className="field"><span>Submission deadline</span><input id="hDeadline" type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} /></label>
              </div>
              <label className="field"><span>Themes, tracks and problem statements</span>
                <textarea id="hDesc" rows={9} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Paste the themes or problem statements, or press Read page to pull the text from the link." />
              </label>
              <div className="field"><span>Look for teams in these batches</span>
                <div className="chips">{BATCHES.map((b) => <button type="button" key={b} className={`chip${form.batches.includes(b) ? " on" : ""}`} onClick={() => toggle("batches", b)}>{batchLabel(b)}</button>)}</div>
              </div>
              <div className="field"><span>and these years</span>
                <div className="chips">{YEARS.map((y) => <button type="button" key={y} className={`chip${form.years.includes(y) ? " on" : ""}`} onClick={() => toggle("years", y)}>Year {y}</button>)}</div>
              </div>
              {msg && <div className={`alert ${msg.kind || ""}`}>{msg.text}</div>}
              <div className="row"><button className="btn primary" disabled={busy === "save"}>{busy === "save" ? "Saving…" : "Save hackathon"}</button><button type="button" className="btn" onClick={() => { setEditing(null); setMsg(null); }}>Cancel</button></div>
            </form>
          ) : !h ? (
            <div className="intro">
              <h2>How matching works</h2>
              <ol className="steps">
                <li><b>Add the hackathons.</b> One at a time with <b>+ Add hackathon</b>, or up to 50 at once with <b>Add many from Excel</b>.</li>
                <li><b>Choose where to look.</b> Pick the batches and years whose projects should be considered.</li>
                <li><b>Find matching projects.</b> {me?.ai === false ? "Projects are ranked by shared keywords (an AI key can be added later for smarter matching)." : "Claude reads every stored project title, domain and sector and picks the ones that fit."}</li>
                <li><b>Share the recommendations.</b> Download one Excel file with a consolidated sheet and a separate sheet for each department.</li>
              </ol>
              <button className="btn primary" onClick={startNew}>+ Add hackathon</button>
            </div>
          ) : (
            <>
              <div className="card-head">
                <div>
                  <div className="eyebrow">{h.deadline ? `Deadline ${fmtDate(h.deadline)}` : "Hackathon"}</div>
                  <h2>{h.title}</h2>
                  <div className="muted small">Looking in {h.batches.map(batchLabel).join(", ")} · Year {h.years.join(", ")}</div>
                  {h.link && <a className="small extlink" href={h.link} target="_blank" rel="noopener noreferrer">{h.link}</a>}
                </div>
                <div className="row">
                  <button className="btn sm" onClick={startEdit}>Edit</button>
                  {me?.role === "admin" && (confirmDel
                    ? <><button className="btn danger sm" onClick={remove}>Delete</button><button className="btn sm" onClick={() => setConfirmDel(false)}>Keep</button></>
                    : <button className="btn ghost-danger sm" onClick={() => setConfirmDel(true)}>Delete</button>)}
                </div>
              </div>
              {h.description && <details className="desc"><summary>Hackathon details</summary><div className="desc-body">{h.description}</div></details>}

              <div className="matchbar">
                <button className="btn primary" onClick={runMatch} disabled={busy === "match"}>{busy === "match" ? "Matching projects…" : h.matches ? "Match again" : "Find matching projects"}</button>
                {busy === "match" && <span className="muted small">Reading all stored projects. This can take up to a minute.</span>}
                {matches.length > 0 && busy !== "match" && <a className="btn gold" href={`/api/hackathons/${h.id}/export`}>Download Excel (consolidated + department sheets)</a>}
              </div>
              {msg && <div className={`alert ${msg.kind || ""}`}>{msg.text}</div>}

              {h.matches && (
                <div className="results">
                  <div className="resultbar">
                    <span><b>{matches.length}</b> strong recommendations · {matches.reduce((n, m) => n + (m.members?.length || 0), 0)} students · {depts.length} department{depts.length === 1 ? "" : "s"} · from {h.scanned} projects · {fmtDate(h.matched_at)}{h.matched_with === "keywords" ? " · keyword match" : ""}</span>
                  </div>
                  {h.summary && <p className="muted small">{h.summary}</p>}
                  {h.themes?.length > 0 && <div className="themes">{h.themes.map((t) => <span className="tag" key={t}>{t}</span>)}</div>}
                  {matches.length ? (
                    <div className="scroll-x tablebox">
                      <table className="data">
                        <thead><tr><th>Dept</th><th>Batch · Year</th>{hasTrack && <th>Track</th>}<th>Roll no. · Name</th><th>Project title</th><th>Faculty mentor</th><th>Why it fits</th></tr></thead>
                        <tbody>
                          {(showAll ? matches : matches.slice(0, 10)).map((m, i) => (
                            <tr key={i}>
                              <td className="nowrap"><b>{m.dept}</b>{m.section && ` – ${m.section}`}<div className="muted small">Team #{m.teamNo}</div></td>
                              <td className="nowrap">{batchLabel(m.batch)}<div className="muted small">Year {m.year}</div></td>
                              {hasTrack && <td className="small track">{m.track ? <span className="tag">{m.track}</span> : <span className="muted">–</span>}</td>}
                              <td><div className="members">{(m.members || []).map((x, j) => <div key={j}><span className="mono">{x.roll}</span><span>{x.name}</span></div>)}</div></td>
                              <td className="title-cell">{m.title}</td>
                              <td>{m.mentor}</td>
                              <td className="small reason">{m.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {matches.length > 10 && <div className="pager"><button className="btn sm" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show top 10 only" : `Show all ${matches.length} teams`}</button></div>}
                  {!matches.length && <div className="empty">No project is a strong fit for this hackathon. Try widening the batches or adding more detail to the description.</div>}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
