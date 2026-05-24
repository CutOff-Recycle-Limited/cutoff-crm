"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthRequired } from "./system-state";
import { CHANNELS, DIRECTIONS, OUTCOMES, CHANNEL_LABELS, OUTCOME_LABELS } from "../lib/ai";

const PRIORITY_COLORS  = { high: "danger", medium: "warn", low: "" };
const SCORE_COLORS     = { hot: "#a6432d", warm: "#9c4d15", cold: "#5d6a60" };
const SCORE_ICONS      = { hot: "🔥", warm: "🟡", cold: "🔵" };

function taskStatusLabel(status) {
  return String(status || "pending").replace(/_/g, " ");
}

function formatTaskDueDate(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return `Due ${date.toLocaleDateString()}`;
}

function isTaskOverdue(task) {
  if (!task.due_date || task.status === "completed") return false;
  return new Date(task.due_date) < new Date();
}

function EditInteractionPanel({ interaction, onClose, onSaved }) {
  const [form, setForm] = useState({
    channel:   interaction.channel   || "call",
    direction: interaction.direction || "outgoing",
    content:   interaction.content   || "",
    outcome:   interaction.outcome   || "",
    duration:  interaction.duration  ?? "",
  });
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/interactions/${interaction.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        ...form,
        duration: form.duration !== "" ? Number(form.duration) : null,
        outcome:  form.outcome  || null,
      }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  async function deleteInteraction() {
    if (!confirm("Delete this interaction? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/interactions/${interaction.id}`, { method: "DELETE" });
    onSaved();
    onClose();
  }

  return (
    <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer">
        <div className="section-head">
          <div>
            <p className="eyebrow">Interaction</p>
            <h2 style={{ margin: "0.2rem 0 0" }}>Edit entry</h2>
          </div>
          <button className="ghost-btn" onClick={onClose} type="button">Close</button>
        </div>

        <form className="form-stack" onSubmit={save}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <label className="field">
              <span>Channel</span>
              <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
                {CHANNELS.map((v) => <option key={v} value={v}>{CHANNEL_LABELS[v]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Direction</span>
              <select value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}>
                {DIRECTIONS.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Summary *</span>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              required
              style={{ minHeight: "140px", resize: "vertical" }}
            />
          </label>

          <label className="field">
            <span>Outcome</span>
            <select value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}>
              <option value="">— None —</option>
              {OUTCOMES.map((v) => <option key={v} value={v}>{OUTCOME_LABELS[v]}</option>)}
            </select>
          </label>

          {form.channel === "call" && (
            <label className="field">
              <span>Duration (minutes)</span>
              <input
                type="number"
                min="0"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                placeholder="e.g. 5"
              />
            </label>
          )}

          <button className="primary-btn" disabled={saving} type="submit">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(24,33,27,0.08)" }}>
          <p className="eyebrow" style={{ color: "#9d3823", marginBottom: "0.5rem" }}>Danger zone</p>
          <button
            className="ghost-btn"
            style={{ color: "#9d3823", borderColor: "rgba(157,56,35,0.25)", width: "100%" }}
            onClick={deleteInteraction}
            disabled={deleting}
            type="button"
          >
            {deleting ? "Deleting…" : "Delete interaction"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function WhatsAppPanel({ customerId, onClose }) {
  const [message, setMessage]   = useState("");
  const [loading, setLoading]   = useState(true);
  const [copied,  setCopied]    = useState(false);

  useEffect(() => {
    fetch("/api/ai/whatsapp-message", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ customer_id: customerId }),
    })
      .then((r) => r.json())
      .then((p) => { setMessage(p.data?.message || "Could not generate message."); setLoading(false); });
  }, [customerId]);

  function copy() {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openWhatsApp() {
    // Opens WhatsApp web with the message pre-filled (requires phone number)
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer">
        <div className="section-head">
          <div>
            <p className="eyebrow">AI Generated</p>
            <h2 style={{ margin: "0.2rem 0 0" }}>WhatsApp message</h2>
          </div>
          <button className="ghost-btn" onClick={onClose} type="button">Close</button>
        </div>

        {loading ? (
          <p className="subtle">Generating message…</p>
        ) : (
          <>
            <textarea
              style={{
                width: "100%",
                minHeight: "220px",
                borderRadius: "0.75rem",
                border: "1px solid rgba(24,33,27,0.14)",
                padding: "0.85rem",
                fontFamily: "inherit",
                fontSize: "0.88rem",
                lineHeight: 1.65,
                resize: "vertical",
                background: "rgba(255,255,255,0.9)",
              }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="subtle" style={{ marginTop: 0 }}>You can edit the message before copying.</p>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <button className="primary-btn" onClick={copy} type="button">
                {copied ? "✓ Copied to clipboard!" : "Copy message"}
              </button>
              <button className="ghost-btn" onClick={openWhatsApp} type="button">
                Open in WhatsApp Web ↗
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function EditCustomerPanel({ customer, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:   customer.name   || "",
    phone:  customer.phone  || "",
    region: customer.region || "",
    type:   customer.type   || "lead",
  });
  const [saving,  setSaving]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/customers/${customer.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(form),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  async function deleteCustomer() {
    if (!confirm(`Delete "${customer.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
    router.push("/customers");
  }

  return (
    <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer">
        <div className="section-head">
          <div>
            <p className="eyebrow">Customer</p>
            <h2 style={{ margin: "0.2rem 0 0" }}>Edit details</h2>
          </div>
          <button className="ghost-btn" onClick={onClose} type="button">Close</button>
        </div>

        <form className="form-stack" onSubmit={save}>
          <label className="field">
            <span>Name *</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              placeholder="Full name"
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+255…"
            />
          </label>
          <label className="field">
            <span>Region</span>
            <input
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              placeholder="e.g. Dar es Salaam"
            />
          </label>
          <label className="field">
            <span>Type</span>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="lead">Lead</option>
              <option value="farmer">Farmer</option>
              <option value="distributor">Distributor</option>
            </select>
          </label>
          <button className="primary-btn" disabled={saving} type="submit">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(24,33,27,0.08)" }}>
          <p className="eyebrow" style={{ color: "#9d3823", marginBottom: "0.5rem" }}>Danger zone</p>
          <button
            className="ghost-btn"
            style={{ color: "#9d3823", borderColor: "rgba(157,56,35,0.25)", width: "100%" }}
            onClick={deleteCustomer}
            disabled={deleting}
            type="button"
          >
            {deleting ? "Deleting…" : "Delete customer"}
          </button>
        </div>
      </aside>
    </div>
  );
}

export function Customer360Page({ customerId }) {
  const [viewer,     setViewer]     = useState(null);
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [showWA,             setShowWA]             = useState(false);
  const [showEdit,           setShowEdit]           = useState(false);
  const [editingInteraction, setEditingInteraction] = useState(null);
  const [nextAction, setNextAction] = useState({ date: "", note: "" });
  const [savingNA,   setSavingNA]   = useState(false);
  const [savedNA,    setSavedNA]    = useState(false);

  async function load() {
    const me = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json());
    setViewer(me.viewer);
    if (!me.configured || !me.viewer) { setLoading(false); return; }

    const res = await fetch(`/api/customers/${customerId}`, { cache: "no-store" });
    if (res.ok) {
      const payload = await res.json();
      setData(payload.data);
      setNextAction({
        date: payload.data.customer.next_action_date
          ? new Date(payload.data.customer.next_action_date).toISOString().slice(0, 16)
          : "",
        note: payload.data.customer.next_action_note || "",
      });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [customerId]);

  async function saveNextAction(e) {
    e.preventDefault();
    setSavingNA(true);
    await fetch(`/api/customers/${customerId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        next_action_date: nextAction.date ? new Date(nextAction.date).toISOString() : null,
        next_action_note: nextAction.note || null,
      }),
    });
    setSavingNA(false);
    setSavedNA(true);
    setTimeout(() => setSavedNA(false), 2000);
    load();
  }

  async function setLeadScore(score) {
    await fetch(`/api/customers/${customerId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ lead_score: score }),
    });
    load();
  }

  if (loading)  return null;
  if (!viewer)  return <AuthRequired />;
  if (!data)    return <p className="subtle">Customer not found.</p>;

  const { customer, interactions, tasks = [] } = data;
  const linkedTasks     = tasks;
  const tasksByInteractionId = linkedTasks.reduce((map, task) => {
    if (!task.interaction_id) return map;
    const existing = map.get(task.interaction_id) || [];
    existing.push(task);
    map.set(task.interaction_id, existing);
    return map;
  }, new Map());
  const lastInteraction = interactions[0];
  const hasHighRisk     = interactions.some((i) => i.ai_insights?.[0]?.urgency === "high")
                       || interactions.some((i) => i.ai_insights?.[0]?.sentiment === "negative");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <Link href="/customers" style={{ color: "#5d6a60", fontSize: "0.84rem" }}>← Customers</Link>
          <h1 style={{ margin: "0.4rem 0 0.35rem" }}>{customer.name}</h1>
          <div className="chip-row">
            <span className={`customer-type ${customer.type}`}>{customer.type}</span>
            {customer.phone  && <span className="subtle">{customer.phone}</span>}
            {customer.region && <span className="subtle">{customer.region}</span>}
            {hasHighRisk && <span className="pill danger">At risk</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="ghost-btn" onClick={() => setShowEdit(true)} type="button">
            Edit details
          </button>
          <button className="ghost-btn" onClick={() => setShowWA(true)} type="button">
            💬 WhatsApp message
          </button>
          <Link href="/interactions/new" className="icon-btn">+ Log interaction</Link>
        </div>
      </div>

      <div className="page-grid">
        {/* Timeline */}
        <section className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">History</p>
              <h2 style={{ margin: "0.2rem 0 0" }}>Interaction timeline</h2>
            </div>
            <span className="subtle" style={{ fontSize: "0.82rem" }}>{interactions.length} total</span>
          </div>

          {interactions.length === 0 ? (
            <p className="subtle">No interactions recorded yet.</p>
          ) : (
            <div className="timeline">
              {interactions.map((item, idx) => {
                const insight = item.ai_insights?.[0];
                const interactionTasks = tasksByInteractionId.get(item.id) || [];
                return (
                  <div key={item.id} className="timeline-item">
                    <div>
                      <div className={`timeline-dot ${insight?.urgency === "high" ? "high" : insight?.sentiment === "negative" ? "negative" : ""}`} />
                      {idx < interactions.length - 1 && <div className="timeline-line" />}
                    </div>
                    <div style={{ paddingBottom: idx < interactions.length - 1 ? "0.5rem" : 0 }}>
                      <div className="chip-row" style={{ marginBottom: "0.35rem" }}>
                        <span className="pill" style={{ fontSize: "0.72rem" }}>{CHANNEL_LABELS[item.channel]}</span>
                        <span className="pill" style={{ fontSize: "0.72rem" }}>{item.direction}</span>
                        {item.outcome && <span className="pill" style={{ fontSize: "0.72rem" }}>{OUTCOME_LABELS[item.outcome]}</span>}
                        {insight?.urgency === "high" && <span className="pill danger" style={{ fontSize: "0.72rem" }}>Urgent</span>}
                        {insight?.sentiment === "negative" && <span className="pill danger" style={{ fontSize: "0.72rem" }}>Negative</span>}
                      </div>
                      <p style={{ margin: 0, lineHeight: 1.55, fontSize: "0.875rem" }}>{item.content}</p>
                      {insight?.suggested_action && (
                        <p style={{ margin: "0.3rem 0 0", color: "#5d6a60", fontSize: "0.78rem" }}>
                          💡 {insight.suggested_action}
                        </p>
                      )}
                      {interactionTasks.length > 0 && (
                        <div style={{ display: "grid", gap: "0.35rem", marginTop: "0.45rem" }}>
                          {interactionTasks.map((task) => (
                            <div key={task.id} className="pill" style={{ display: "inline-flex", justifyContent: "space-between", gap: "0.5rem", width: "fit-content", maxWidth: "100%" }}>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                Ops task: {task.title}
                              </span>
                              <span>{taskStatusLabel(task.status)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.3rem" }}>
                        <p style={{ margin: 0, color: "#5d6a60", fontSize: "0.75rem" }}>
                          {new Date(item.created_at).toLocaleString()}
                          {item.duration ? ` · ${item.duration} min` : ""}
                        </p>
                        <button
                          className="ghost-btn"
                          style={{ padding: "0.2rem 0.6rem", fontSize: "0.72rem" }}
                          onClick={() => setEditingInteraction(item)}
                          type="button"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Side panel */}
        <aside style={{ display: "grid", gap: "1rem", alignContent: "start" }}>
          {/* Lead score */}
          <section className="card">
            <p className="eyebrow" style={{ marginBottom: "0.6rem" }}>Lead score</p>
            <div style={{ display: "grid", grid: "auto / repeat(3, 1fr)", gap: "0.4rem" }}>
              {["hot", "warm", "cold"].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setLeadScore(score)}
                  style={{
                    padding: "0.55rem",
                    borderRadius: "0.6rem",
                    border: `1.5px solid ${customer.lead_score === score ? SCORE_COLORS[score] : "rgba(24,33,27,0.1)"}`,
                    background: customer.lead_score === score ? `${SCORE_COLORS[score]}15` : "white",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: customer.lead_score === score ? 700 : 500,
                    color: customer.lead_score === score ? SCORE_COLORS[score] : "#5d6a60",
                    textAlign: "center",
                  }}
                >
                  {SCORE_ICONS[score]} {score.charAt(0).toUpperCase() + score.slice(1)}
                </button>
              ))}
            </div>
          </section>

          {/* Next action */}
          <section className="card">
            <p className="eyebrow" style={{ marginBottom: "0.6rem" }}>Next action</p>
            <form className="form-stack" onSubmit={saveNextAction}>
              <label className="field">
                <span>Follow-up date</span>
                <input
                  type="datetime-local"
                  value={nextAction.date}
                  onChange={(e) => setNextAction((v) => ({ ...v, date: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Note</span>
                <input
                  value={nextAction.note}
                  onChange={(e) => setNextAction((v) => ({ ...v, note: e.target.value }))}
                  placeholder="What needs to happen?"
                />
              </label>
              <button className="ghost-btn" disabled={savingNA} type="submit" style={{ justifySelf: "start" }}>
                {savedNA ? "✓ Saved" : savingNA ? "Saving…" : "Save"}
              </button>
            </form>
          </section>

          {/* Linked Ops tasks */}
          <section className="card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Tasks</p>
                <h2 style={{ margin: "0.2rem 0 0" }}>Linked Ops tasks</h2>
              </div>
              <span className="pill">{linkedTasks.length}</span>
            </div>
            {linkedTasks.length === 0 ? (
              <p className="subtle">No linked Ops tasks.</p>
            ) : (
              <div className="stack">
                {linkedTasks.map((t) => (
                  <div key={t.id} className={`list-card ${isTaskOverdue(t) ? "danger-border" : ""}`}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "0.84rem" }}>{t.title}</h4>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "#5d6a60" }}>
                        {formatTaskDueDate(t.due_date)}
                        {t.customers?.name ? ` · ${t.customers.name}` : ""}
                      </p>
                    </div>
                    <div className="chip-row" style={{ justifyContent: "flex-end" }}>
                      <span className="pill">{taskStatusLabel(t.status)}</span>
                      <span className={`pill ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick stats */}
          <section className="card">
            <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>Summary</p>
            <div className="stack">
              <div className="info-block">
                <span>Total interactions</span>
                <strong style={{ fontSize: "1.5rem" }}>{interactions.length}</strong>
              </div>
              {lastInteraction && (
                <div className="info-block">
                  <span>Last contact</span>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.84rem" }}>
                    {new Date(lastInteraction.created_at).toLocaleDateString()}
                    {" via "}{CHANNEL_LABELS[lastInteraction.channel]}
                  </p>
                </div>
              )}
              <div className="info-block">
                <span>Customer since</span>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.84rem" }}>
                  {new Date(customer.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {showWA            && <WhatsAppPanel customerId={customerId} onClose={() => setShowWA(false)} />}
      {showEdit          && <EditCustomerPanel customer={customer} onClose={() => setShowEdit(false)} onSaved={load} />}
      {editingInteraction && (
        <EditInteractionPanel
          interaction={editingInteraction}
          onClose={() => setEditingInteraction(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
