import { NextResponse } from "next/server";
import { requireViewer } from "../../../../lib/auth";
import { listCrmOpsTasks } from "../../../../shared/ops-tasks";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { isSupabaseConfigured } from "../../../../lib/supabase/config";
import { generateWeeklyReport } from "../../../../lib/ai";

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

  const supabase = createSupabaseServerClient();

  const [
    { data: interactions },
    tasks,
    { data: customers },
  ] = await Promise.all([
    supabase
      .from("interactions")
      .select("id, channel, outcome, created_at, ai_insights(urgency, sentiment)")
      .order("created_at", { ascending: false }),
    listCrmOpsTasks(supabase),
    supabase
      .from("customers")
      .select("id, name, type, lead_score"),
  ]);

  const report = generateWeeklyReport({
    interactions: interactions || [],
    tasks,
    customers:    customers    || [],
  });

  return NextResponse.json({ data: { report } });
}
