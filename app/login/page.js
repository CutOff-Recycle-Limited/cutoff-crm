"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { isSupabaseConfigured } from "../../lib/supabase/config";

const ROLES = [
  { value: "staff",       label: "Staff" },
  { value: "sales",       label: "Sales" },
  { value: "agronomist",  label: "Agronomist" },
  { value: "operations",  label: "Operations" },
];

if (!isSupabaseConfigured) {
  // handled below
}

export default function LoginPage() {
  const [mode,     setMode]     = useState("signin"); // "signin" | "register"
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState("staff");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  function switchMode(m) {
    setMode(m);
    setError("");
    setFullName("");
    setEmail("");
    setPassword("");
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-card">
        <p className="eyebrow">Setup required</p>
        <h1 style={{ margin: "0.25rem 0 0.5rem" }}>Supabase not configured</h1>
        <p className="subtle">
          Add <code>NEXT_PUBLIC_AUTH_SUPABASE_URL</code> and <code>NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY</code> to your environment variables.
        </p>
      </div>
    );
  }

  async function signIn(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function register(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      // Sign in immediately after registering
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        setError("Account created. Please sign in.");
        setMode("signin");
        setLoading(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    }
  }

  return (
    <div className="auth-card">
      <p className="eyebrow">CutOff CRM</p>
      <h1 style={{ margin: "0.3rem 0 0.2rem", fontSize: "1.5rem" }}>
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>
      <p className="subtle" style={{ marginBottom: "1.5rem" }}>Customer Command Center</p>

      {/* Mode toggle */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.35rem",
        background: "rgba(24,33,27,0.06)",
        borderRadius: "0.75rem",
        padding: "0.25rem",
        marginBottom: "1.5rem",
      }}>
        {[
          { key: "signin",   label: "Sign in" },
          { key: "register", label: "Create account" },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => switchMode(key)}
            style={{
              padding: "0.55rem",
              borderRadius: "0.55rem",
              border: "none",
              background: mode === key ? "white" : "transparent",
              fontWeight: mode === key ? 700 : 500,
              fontSize: "0.84rem",
              cursor: "pointer",
              color: mode === key ? "#18211b" : "#5d6a60",
              boxShadow: mode === key ? "0 1px 4px rgba(24,33,27,0.1)" : "none",
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "signin" ? (
        <form className="form-stack" onSubmit={signIn}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          {error && <p style={{ margin: 0, color: "#9d3823", fontSize: "0.84rem" }}>{error}</p>}
          <button className="primary-btn" disabled={loading} type="submit">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form className="form-stack" onSubmit={register}>
          <label className="field">
            <span>Full name</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              minLength={6}
              required
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          {error && <p style={{ margin: 0, color: "#9d3823", fontSize: "0.84rem" }}>{error}</p>}
          <button className="primary-btn" disabled={loading} type="submit">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      )}
    </div>
  );
}
