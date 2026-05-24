import Link from "next/link";
import { isSupabaseConfigured } from "../../lib/supabase/config";

export default function SetupPage() {
  return (
    <div className="page-grid">
      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Setup</p>
            <h1>Connect Supabase</h1>
            <p className="subtle">
              This app is ready, but it needs Supabase environment variables and schema setup before auth,
              calls, tasks, and admin data can work.
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
              <code>NEXT_PUBLIC_SUPABASE_URL</code>
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            </div>
          </div>

          <div className="info-block">
            <span>2. Apply database schema</span>
            <p className="subtle">
              Run the SQL from <code>supabase/schema.sql</code> in your Supabase project.
            </p>
          </div>

          <div className="info-block">
            <span>3. Create a user in Supabase Auth</span>
            <p className="subtle">
              Add <code>role</code> in user metadata with either <code>admin</code> or <code>staff</code>.
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
