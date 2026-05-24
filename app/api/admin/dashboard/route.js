import { NextResponse } from "next/server";
import { requireViewer } from "../../../../lib/auth";
import { buildDashboardPayload } from "../../../../lib/dashboard-data";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { isSupabaseConfigured } from "../../../../lib/supabase/config";

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase env is not configured." }, { status: 500 });
  }

  const auth = await requireViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  if (auth.viewer.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseServerClient();
  try {
    const payload = await buildDashboardPayload(supabase);
    return NextResponse.json({
      data: {
        callsToday: payload.interactionsToday,
        highUrgency: payload.highUrgency,
        openTasks: payload.openTasks,
        overdueTasks: payload.overdueTasks,
        callsByCategory: payload.byCategory,
        alerts: payload.alerts,
        recentCalls: payload.recentFeed.map((item) => ({
          id: item.id,
          summary: item.content,
          staff_id: item.staff_id,
          created_at: item.created_at,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
