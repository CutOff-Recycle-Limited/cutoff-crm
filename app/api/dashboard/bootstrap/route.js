import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getViewer } from "../../../../lib/auth";
import { buildDashboardPayload } from "../../../../lib/dashboard-data";
import { isSupabaseConfigured } from "../../../../lib/supabase/config";
import { isDatabaseConfigured } from "../../../../lib/db/client";

/**
 * Single round-trip for the dashboard page: viewer + admin payload.
 * Avoids duplicate getViewer() work from separate /api/me + /api/dashboard calls.
 */
export async function GET() {
  if (!isSupabaseConfigured || !isDatabaseConfigured) {
    const missing = [
      !isDatabaseConfigured ? "DATABASE_URL" : null,
      !isSupabaseConfigured ? "NEXT_PUBLIC_AUTH_SUPABASE_URL" : null,
      !isSupabaseConfigured ? "NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY" : null,
    ].filter(Boolean);

    return NextResponse.json({
      configured: false,
      viewer: null,
      dashboard: null,
      forbidden: false,
      message: `Set ${missing.join(", ")}.`,
    });
  }

  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({
      configured: true,
      viewer: null,
      dashboard: null,
      forbidden: false,
    });
  }

  if (viewer.role !== "admin") {
    return NextResponse.json({
      configured: true,
      viewer,
      dashboard: null,
      forbidden: true,
    });
  }

  const dashboard = await buildDashboardPayload();

  return NextResponse.json({
    configured: true,
    viewer,
    dashboard,
    forbidden: false,
  });
}
