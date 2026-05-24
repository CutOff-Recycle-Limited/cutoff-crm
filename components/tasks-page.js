"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthRequired, EmptyPanel, SetupBanner } from "./system-state";
import { useRealtimeRefresh } from "./use-realtime-refresh";

function overdue(task) {
  return task.status !== "completed" && new Date(task.due_date).getTime() < Date.now();
}

export function TasksPage() {
  const [meta, setMeta] = useState({ configured: true, viewer: null });
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    const me = await fetch("/api/me", { cache: "no-store" }).then((res) => res.json());
    setMeta(me);
    if (!me.configured || !me.viewer) return;

    const tasksRes = await fetch("/api/tasks", { cache: "no-store" });
    if (!tasksRes.ok) return;
    const payload = await tasksRes.json();
    setTasks(payload.data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh("tasks-list", ["tasks"], load);

  async function markCompleted(id) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    load();
  }

  if (!meta.configured) return <SetupBanner message={meta.message || "Add CRM env vars to load tasks from the database."} />;
  if (!meta.viewer) return <AuthRequired />;
  if (!tasks.length) return <EmptyPanel title="No tasks yet" copy="Tasks will appear here once follow-up interactions are logged." />;

  const filtered = tasks.filter((task) => statusFilter === "all" || task.status === statusFilter);

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Tasks</p>
          <h1>Task management</h1>
          <p className="subtle">Admins see all tasks; staff see only their assigned work.</p>
        </div>
        <select className="compact-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="stack">
        {filtered.map((task) => (
          <div className={`list-card ${overdue(task) ? "danger-border" : ""}`} key={task.id}>
            <div>
              <h3>{task.title}</h3>
              <p className="subtle">
                {task.customers?.name || "Unknown customer"} · Due {new Date(task.due_date).toLocaleString()}
              </p>
            </div>
            <div className="inline-actions">
              {overdue(task) && <span className="pill danger">Overdue</span>}
              <span className="pill">{task.status}</span>
              {task.status !== "completed" && (
                <button className="ghost-btn" onClick={() => markCompleted(task.id)} type="button">
                  Mark completed
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
