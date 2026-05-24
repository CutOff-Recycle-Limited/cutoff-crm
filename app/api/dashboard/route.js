import { NextResponse } from "next/server";
import { requireViewer } from "../../../lib/auth";
import { buildDashboardPayload } from "../../../lib/dashboard-data";
import { isSupabaseConfigured } from "../../../lib/supabase/config";

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const auth = await requireViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  if (auth.viewer.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await buildDashboardPayload();

  return NextResponse.json({ data });
}
