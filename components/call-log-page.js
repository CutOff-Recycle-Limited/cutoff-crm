"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthRequired, EmptyPanel, SetupBanner } from "./system-state";
import { CALL_OUTCOMES, CALL_PURPOSES, CALL_TYPES } from "../lib/call-intelligence";

export function CallLogPage() {
  const [meta, setMeta] = useState({ configured: true, viewer: null });
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    type: "outgoing",
    purpose: "follow-up",
    summary: "",
    outcome: "follow_up",
    duration: "",
  });

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/me", { cache: "no-store" }).then((res) => res.json());
      setMeta(me);
      if (!me.configured || !me.viewer) return;
      const customerRes = await fetch("/api/customers", { cache: "no-store" });
      if (customerRes.ok) {
        const payload = await customerRes.json();
        setCustomers(payload.data || []);
        if (payload.data?.[0]?.id) {
          setForm((current) => ({ ...current, customer_id: current.customer_id || payload.data[0].id }));
        }
      }
    }
    load();
  }, []);

  const filteredCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return customers;
    return customers.filter((customer) =>
      `${customer.name} ${customer.phone || ""} ${customer.region || ""}`.toLowerCase().includes(normalized),
    );
  }, [customers, query]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setNotice("");
    const res = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await res.json();
    if (!res.ok) {
      setNotice(payload.error || "Failed to save call.");
      setSaving(false);
      return;
    }
    setNotice(form.outcome === "follow_up" ? "Call logged and follow-up task created." : "Call logged successfully.");
    setForm((current) => ({ ...current, summary: "", duration: "" }));
    setSaving(false);
  }

  if (!meta.configured) {
    return <SetupBanner message="Add your Supabase URL and anon key to run the native Next.js app." />;
  }

  if (!meta.viewer) {
    return <AuthRequired />;
  }

  if (!customers.length) {
    return <EmptyPanel title="No customers yet" copy="Create or import customers in Supabase before logging calls." />;
  }

  return (
    <div className="page-grid">
      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Calls</p>
            <h1>Log a call</h1>
            <p className="subtle">Fast, low-friction entry for staff after each interaction.</p>
          </div>
        </div>

        <form className="form-stack" onSubmit={submit}>
          <label className="field">
            <span>Customer search</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer by name or phone" />
          </label>

          <label className="field">
            <span>Customer</span>
            <select value={form.customer_id} onChange={(e) => setForm((current) => ({ ...current, customer_id: e.target.value }))}>
              {filteredCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}{customer.phone ? ` · ${customer.phone}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="grid-two">
            <label className="field">
              <span>Type</span>
              <select value={form.type} onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}>
                {CALL_TYPES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Purpose</span>
              <select value={form.purpose} onChange={(e) => setForm((current) => ({ ...current, purpose: e.target.value }))}>
                {CALL_PURPOSES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Summary</span>
            <textarea value={form.summary} onChange={(e) => setForm((current) => ({ ...current, summary: e.target.value }))} placeholder="Summarize the interaction" />
          </label>

          <div className="grid-two">
            <label className="field">
              <span>Outcome</span>
              <select value={form.outcome} onChange={(e) => setForm((current) => ({ ...current, outcome: e.target.value }))}>
                {CALL_OUTCOMES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Duration (minutes)</span>
              <input type="number" value={form.duration} onChange={(e) => setForm((current) => ({ ...current, duration: e.target.value }))} />
            </label>
          </div>

          <button className="primary-btn" disabled={saving} type="submit">
            {saving ? "Saving..." : "Save call"}
          </button>

          {notice && <p className="subtle">{notice}</p>}
        </form>
      </section>

      <aside className="card side-card">
        <p className="eyebrow">Flow</p>
        <h2>What happens next</h2>
        <ul className="simple-list">
          <li>Call is inserted as an interaction.</li>
          <li>Keyword-based AI insight is written to `ai_insights`.</li>
          <li>Follow-up outcomes auto-create an Ops task when defaults are configured.</li>
        </ul>
      </aside>
    </div>
  );
}
