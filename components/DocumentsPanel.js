"use client";
import { useState } from "react";
import { ALLOWED_EXT } from "@/lib/config";
import { api, fmtDate, fmtSize, FileIcon } from "./shared";

// Stored documents for one place (a Design Thinking batch/year, or a collection), with upload and delete.
// target: { batch, year } or { collectionId }   folder: storage folder name   label: where the files go (for messages)
export default function DocumentsPanel({ me, eyebrow, heading, uploads, max, target, folder, label, onChanged, emptyText }) {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [drag, setDrag] = useState(false);
  const isAdmin = me?.role === "admin";

  async function handleFiles(files) {
    if (busy || !files.length) return;
    const room = max - uploads.length;
    if (files.length > room) { setMsg({ kind: "err", text: `Only ${room} more document${room === 1 ? "" : "s"} can be stored in ${label}. Choose fewer files.` }); return; }
    const bad = files.filter((x) => !ALLOWED_EXT.includes(x.name.split(".").pop().toLowerCase()));
    if (bad.length) { setMsg({ kind: "err", text: `${bad.map((x) => x.name).join(", ")}: use .xlsx, .csv, .pdf, .docx or .pptx.` }); return; }
    setBusy(true);
    let total = 0;
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
          const r = await upload(`${folder}/${safe}`, file, { access: me.blobAccess, handleUploadUrl: "/api/blob", multipart: file.size > 5e6 });
          fileUrl = r.url;
        } else {
          const fd = new FormData(); fd.append("file", file);
          fileUrl = (await api("/api/files/local", { method: "POST", body: fd })).url;
        }
        await api("/api/uploads", { method: "POST", json: { ...target, fileName: file.name, sizeBytes: file.size, contentType: file.type, fileUrl, teams: parsed.teams, warnings: parsed.warnings } });
        total += parsed.teams.length;
      }
      setMsg({ kind: "ok", text: `Saved ${files.length} document${files.length > 1 ? "s" : ""} to ${label}${total ? ` · ${total} project teams read` : ""}.` });
      await onChanged();
    } catch (e) { setMsg({ kind: "err", text: e.message || "The upload failed. Try again." }); }
    finally { setBusy(false); }
  }

  async function del(u) {
    try { await api(`/api/uploads/${u.id}`, { method: "DELETE" }); setConfirmDel(null); setMsg({ kind: "ok", text: `Deleted ${u.file_name}.` }); await onChanged(); }
    catch (e) { setMsg({ kind: "err", text: e.message }); }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>{heading}</h2>
        </div>
        <span className="pill">{uploads.length} of {max} stored</span>
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
        {!uploads.length && <div className="empty">{emptyText || "No documents stored here yet."}</div>}
      </div>
      {isAdmin && uploads.length < max && (
        <label className={`dropzone${drag ? " over" : ""}${busy ? " busy" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles([...e.dataTransfer.files]); }}>
          <input type="file" multiple accept=".xlsx,.csv,.pdf,.docx,.pptx" disabled={busy} onChange={(e) => { handleFiles([...e.target.files]); e.target.value = ""; }} />
          <strong>{busy ? "Uploading…" : "Upload documents"}</strong>
          <span className="muted small">Drop files here or click to choose (up to {max - uploads.length} more). Excel and CSV files are read into the project list by their column headings (Roll No., Name, Project Title, Mentor…). PDF, Word and PowerPoint files are stored as they are.</span>
        </label>
      )}
      {me && !isAdmin && <p className="muted small">Only the portal admin can upload or delete documents.</p>}
      {msg && <div className={`alert ${msg.kind || ""}`}>{msg.text}</div>}
    </section>
  );
}
