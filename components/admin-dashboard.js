"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthRequired, EmptyPanel, SetupBanner } from "./system-state";
import { useRealtimeRefresh } from "./use-realtime-refresh";

export function AdminDashboardPage() {
  const [meta, setMeta] = useState({ configured: true, viewer: null });
  const [dashboard, setDashboard] = useState(null);

  const load = useCallback(async () => {
    const me = await fetch("/api/me", { cache: "no-store" }).then((res) => res.json());
    setMeta(me);
    if (!me.configured || !me.viewer) return;

    const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
    if (res.status === 403) {
      setDashboard({ forbidden: true });
      return;
    }
    if (!res.ok) return;
    const payload = await res.json();
    setDashboard(payload.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh("admin-dashboard", ["interactions", "tasks"], load);

  if (!meta.configured) return <SetupBanner message={meta.message || "Add CRM env vars to load the admin dashboard."} />;
  if (!meta.viewer) return <AuthRequired />;
  if (dashboard?.forbidden) return <EmptyPanel title="Admin access only" copy="This page is visible only to users whose role is admin." />;
  if (!dashboard) return <div className="card"><p className="subtle">Loading dashboard…</p></div>;

  return (
    <>
      <section className="metric-grid">
        <div className="metric-card"><span>Calls today</span><strong>{dashboard.callsToday}</strong></div>
        <div className="metric-card"><span>High urgency</span><strong>{dashboard.highUrgency}</strong></div>
        <div className="metric-card"><span>Open tasks</span><strong>{dashboard.openTasks}</strong></div>
        <div className="metric-card"><span>Overdue tasks</span><strong>{dashboard.overdueTasks}</strong></div>
      </section>

      <div className="page-grid">
        <section className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Admin</p>
              <h1>Calls by category</h1>
              <p className="subtle">Real-time summary from AI insights.</p>
            </div>
          </div>
          <div className="stack">
            {Object.entries(dashboard.callsByCategory || {}).map(([key, value]) => (
              <div className="list-card" key={key}>
                <h3>{key}</h3>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Alerts</p>
              <h2>Negative sentiment & high urgency</h2>
            </div>
          </div>
          <div className="stack">
            {(dashboard.alerts || []).map((alert, index) => (
              <div className="list-card danger-border" key={`${alert.interaction_id || alert.id}-${index}`}>
                <div className="chip-row">
                  <span className={`pill ${alert.urgency === "high" ? "danger" : ""}`}>{alert.urgency}</span>
                  <span className={`pill ${alert.sentiment === "negative" ? "danger" : ""}`}>{alert.sentiment}</span>
                </div>
                <p>{alert.suggested_action}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Recent activity</p>
            <h2>Recent calls feed</h2>
          </div>
        </div>
        <div className="timeline">
          {(dashboard.recentCalls || []).map((call) => (
            <div className="timeline-item" key={call.id}>
              <div className="timeline-dot" />
              <div>
                <strong>{call.summary}</strong>
                <p className="subtle">{new Date(call.created_at).toLocaleString()} · {call.staff_id}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
