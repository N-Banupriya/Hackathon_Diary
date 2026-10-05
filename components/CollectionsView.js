"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MAX_FILES_PER_COLLECTION } from "@/lib/config";
import { useMe, api, fmtDate } from "./shared";
import DocumentsPanel from "./DocumentsPanel";
import ProjectsPanel from "./ProjectsPanel";

// Named project lists kept apart from the batch-wise Design Thinking lists: SIH, MSME Idea Hackathon, etc.
export default function CollectionsView() {
  const me = useMe();
  const isAdmin = me?.role === "admin";
  const [list, setList] = useState(null);
  const [selId, setSelId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [teams, setTeams] = useState(null);
  const [form, setForm] = useState(null); // null | {mode:"new"|"edit", name, description}
  const [msg, setMsg] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(async (keep) => {
    try {
      const [c, s] = await Promise.all([api("/api/collections"), api("/api/summary")]);
      setList(c.collections); setSummary(s);
      setSelId((cur) => keep || (c.collections.some((x) => x.id === cur) ? cur : c.collections[0]?.id) || null);
    } catch (e) { setList([]); setMsg({ kind: "err", text: e.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadTeams = useCallback(async (id) => {
    if (!id) { setTeams(null); return; }
    setTeams(null);
    try { setTeams((await api(`/api/teams?collection=${id}`)).teams); } catch (e) { setTeams([]); setMsg({ kind: "err", text: e.message }); }
  }, []);
  useEffect(() => { loadTeams(selId); }, [selId, loadTeams]);

  const c = list?.find((x) => x.id === selId);
  const uploads = useMemo(() => (summary?.uploads || []).filter((u) => u.collection_id === selId), [summary, selId]);

  async function save(e) {
    e.preventDefault(); setMsg(null);
    try {
      if (form.mode === "new") { const d = await api("/api/collections", { method: "POST", json: form }); await load(d.id); }
      else { await api(`/api/collections/${selId}`, { method: "PUT", json: form }); await load(selId); }
      setForm(null);
    } catch (e2) { setMsg({ kind: "err", text: e2.message }); }
  }
  async function remove() {
    try { await api(`/api/collections/${selId}`, { method: "DELETE" }); setConfirmDel(false); setSelId(null); await load(); }
    catch (e) { setMsg({ kind: "err", text: e.message }); }
  }

  return (
    <>
      <section className="hero slim">
        <div className="container hero-in">
          <div className="hero-text">
            <div className="hero-eyebrow">Project collections</div>
            <h1 className="hero-title">SIH, MSME and other project lists</h1>
            <p className="hero-sub">Keep each programme's teams in its own collection. Upload its Excel lists in any layout; the portal reads roll numbers, names, titles and mentors by their column headings. Collections can be searched when matching hackathons.</p>
          </div>
          {isAdmin && <div className="hero-cta"><button className="btn gold" onClick={() => { setForm({ mode: "new", name: "", description: "" }); setMsg(null); }}>+ New collection</button></div>}
        </div>
      </section>

      <div className="container hk">
        <aside className="hk-list">
          <div className="eyebrow">Collections ({list?.length ?? "…"})</div>
          {list?.length === 0 && <div className="empty small">No collections yet.{isAdmin ? " Create one, e.g. SIH 2025." : ""}</div>}
          {list?.map((x) => (
            <button key={x.id} className={`hk-item${x.id === selId && !form ? " on" : ""}`} onClick={() => { setSelId(x.id); setForm(null); setMsg(null); setConfirmDel(false); }}>
              <span className="hk-title">{x.name}</span>
              <span className="muted small">{x.teams} teams · {x.students} students</span>
              <span className="muted small">{x.files} document{x.files === 1 ? "" : "s"} · since {fmtDate(x.created_at)}</span>
            </button>
          ))}
        </aside>

        <div className="stack" style={{ paddingBlock: 0 }}>
          {form ? (
            <form className="card form" onSubmit={save}>
              <h2>{form.mode === "new" ? "New collection" : "Rename collection"}</h2>
              <label className="field"><span>Name</span><input id="cName" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. SIH 2025, MSME Idea Hackathon 5.0" /></label>
              <label className="field"><span>Description (optional)</span><input id="cDesc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Internal hackathon shortlisted teams" /></label>
              {msg && <div className={`alert ${msg.kind || ""}`}>{msg.text}</div>}
              <div className="row"><button className="btn primary">Save</button><button type="button" className="btn" onClick={() => { setForm(null); setMsg(null); }}>Cancel</button></div>
            </form>
          ) : !c ? (
            <div className="card intro">
              <h2>How collections work</h2>
              <ol className="steps">
                <li><b>Create a collection</b> for each programme, e.g. <i>SIH 2025</i> or <i>MSME Idea Hackathon 5.0</i>.</li>
                <li><b>Upload its Excel lists</b> (up to {MAX_FILES_PER_COLLECTION}). One row per student or one row per team with member columns both work.</li>
                <li><b>Use it in matching:</b> when adding a hackathon, tick the collections to search, or choose <i>All project lists</i>.</li>
              </ol>
              {msg && <div className={`alert ${msg.kind || ""}`}>{msg.text}</div>}
            </div>
          ) : (
            <>
              <section className="card">
                <div className="card-head">
                  <div>
                    <div className="eyebrow">Collection</div>
                    <h2>{c.name}</h2>
                    {c.description && <div className="muted small">{c.description}</div>}
                  </div>
                  {isAdmin && (
                    <div className="row">
                      <button className="btn sm" onClick={() => setForm({ mode: "edit", name: c.name, description: c.description || "" })}>Rename</button>
                      {confirmDel
                        ? <><span className="small">Delete {c.name}, its {c.files} documents and {c.teams} teams?</span><button className="btn danger sm" onClick={remove}>Delete</button><button className="btn sm" onClick={() => setConfirmDel(false)}>Keep</button></>
                        : <button className="btn ghost-danger sm" onClick={() => setConfirmDel(true)}>Delete</button>}
                    </div>
                  )}
                </div>
                {msg && <div className={`alert ${msg.kind || ""}`}>{msg.text}</div>}
              </section>
              <DocumentsPanel
                key={c.id}
                me={me}
                heading="Documents"
                uploads={uploads}
                max={MAX_FILES_PER_COLLECTION}
                target={{ collectionId: c.id }}
                folder={`collections/${c.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || c.id}`}
                label={c.name}
                emptyText="No documents in this collection yet."
                onChanged={() => Promise.all([load(c.id), loadTeams(c.id)])}
              />
              <ProjectsPanel
                teams={teams}
                resetKey={c.id}
                showBatch
                context={c.name}
                csvName={`${c.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Collection"}_Projects.csv`}
                emptyText="Upload an Excel list to see its project teams here."
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
