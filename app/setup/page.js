import Link from "next/link";
import { isSupabaseConfigured } from "../../lib/supabase/config";

export default function SetupPage() {
  return (
    <div className="page-grid">
      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Setup</p>
            <h1>Connect CRM services</h1>
            <p className="subtle">
              This app uses Supabase for auth and Neon/Postgres for CRM application data.
            </p>
          </div>
          <span className={`status-badge ${isSupabaseConfigured ? "ok" : "warn"}`}>
            {isSupabaseConfigured ? "Configured" : "Not configured"}
          </span>
        </div>

        <div className="stack">
          <div className="info-block">
            <span>1. Add environment variables</span>
            <div className="code-list">
              <code>DATABASE_URL</code>
              <code>NEXT_PUBLIC_AUTH_SUPABASE_URL</code>
              <code>NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY</code>
              <code>OPS_DEFAULT_OPERATION_ID</code>
              <code>OPS_DEFAULT_WORKFLOW_ID</code>
              <code>OPS_DEFAULT_STATUS_ID</code>
            </div>
          </div>

          <div className="info-block">
            <span>2. Apply shared database schema</span>
            <p className="subtle">
              Run the shared schema against Neon/Postgres after the Ops schema exists.
            </p>
          </div>

          <div className="info-block">
            <span>3. Map the authenticated user</span>
            <p className="subtle">
              Supabase Auth users must match a shared <code>users</code> row and CRM role.
            </p>
          </div>

          <div className="info-block">
            <span>4. Sign in</span>
            <p className="subtle">
              Once configured, use magic-link auth from the sign-in screen.
            </p>
          </div>
        </div>
      </section>

      <aside className="card side-card">
        <p className="eyebrow">Shortcuts</p>
        <h2>Useful pages</h2>
        <div className="stack">
          <Link className="ghost-btn" href="/sign-in">Open sign in</Link>
          <Link className="ghost-btn" href="/interactions/new">Go to interaction log</Link>
          <Link className="ghost-btn" href="/admin">Open admin</Link>
        </div>
      </aside>
    </div>
  );
}
