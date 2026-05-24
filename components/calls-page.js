"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthRequired, EmptyPanel, SetupBanner } from "./system-state";
import { useRealtimeRefresh } from "./use-realtime-refresh";

function CallDrawer({ call, onClose }) {
  if (!call) return null;

  return (
    <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer">
        <div className="section-head">
          <div>
            <p className="eyebrow">Call details</p>
            <h2>{call.customers?.name || "Customer"}</h2>
            <p className="subtle">{call.type} · {call.purpose}</p>
          </div>
          <button className="ghost-btn" onClick={onClose} type="button">Close</button>
        </div>

        <div className="stack">
          <div className="info-block">
            <span>Summary</span>
            <p>{call.summary}</p>
          </div>

          <div className="chip-row">
            <span className={`pill ${call.ai_insights?.[0]?.urgency === "high" ? "danger" : ""}`}>
              Urgency: {call.ai_insights?.[0]?.urgency || "n/a"}
            </span>
            <span className="pill">Sentiment: {call.ai_insights?.[0]?.sentiment || "n/a"}</span>
            <span className="pill">Category: {call.ai_insights?.[0]?.category || "n/a"}</span>
          </div>

          <div className="info-block">
            <span>Suggested action</span>
            <p>{call.ai_insights?.[0]?.suggested_action || "No AI insight yet."}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function CallsPage() {
  const [meta, setMeta] = useState({ configured: true, viewer: null });
  const [calls, setCalls] = useState([]);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    const me = await fetch("/api/me", { cache: "no-store" }).then((res) => res.json());
    setMeta(me);
    if (!me.configured || !me.viewer) return;

    const callsRes = await fetch("/api/calls", { cache: "no-store" });
    if (!callsRes.ok) return;
    const payload = await callsRes.json();
    setCalls(payload.data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh("calls-list", ["interactions"], load);

  if (!meta.configured) return <SetupBanner message={meta.message || "Add CRM env vars to load calls from the database."} />;
  if (!meta.viewer) return <AuthRequired />;
  if (!calls.length) return <EmptyPanel title="No calls logged yet" copy="Start by logging your first call from the interactions page." />;

  return (
    <>
      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Calls</p>
            <h1>Calls list</h1>
            <p className="subtle">Click any row to inspect the AI summary and next action.</p>
          </div>
        </div>

        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Summary</th>
                <th>Outcome</th>
                <th>Date</th>
                <th>Staff</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} onClick={() => setSelected(call)} className={call.ai_insights?.[0]?.urgency === "high" ? "row-alert" : ""}>
                  <td>{call.customers?.name || "Unknown"}</td>
                  <td>{call.summary}</td>
                  <td>{call.outcome}</td>
                  <td>{new Date(call.created_at).toLocaleString()}</td>
                  <td>{call.staff_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <CallDrawer call={selected} onClose={() => setSelected(null)} />
    </>
  );
}
