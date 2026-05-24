import { NextResponse } from "next/server";
import { requireViewer } from "../../../../lib/auth";
import { listCrmOpsTasks } from "../../../../shared/ops-tasks";
import { isSupabaseConfigured } from "../../../../lib/supabase/config";
import { generateWeeklyReport } from "../../../../lib/ai";
import { query } from "../../../../lib/db/client";

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

  const [
    interactionsResult,
    tasks,
    customersResult,
  ] = await Promise.all([
    query(
      `SELECT i.id,
              i.channel,
              i.outcome,
              i.created_at,
              COALESCE(
                jsonb_agg(
                  jsonb_build_object(
                    'urgency', ai.urgency,
                    'sentiment', ai.sentiment
                  )
                ) FILTER (WHERE ai.id IS NOT NULL),
                '[]'::jsonb
              ) AS ai_insights
       FROM interactions i
       LEFT JOIN ai_insights ai ON ai.interaction_id = i.id
       GROUP BY i.id
       ORDER BY i.created_at DESC`,
    ),
    listCrmOpsTasks(),
    query(
      `SELECT id, name, type, lead_score
       FROM customers`,
    ),
  ]);

  const report = generateWeeklyReport({
    interactions: interactionsResult.rows || [],
    tasks,
    customers:    customersResult.rows    || [],
  });

  return NextResponse.json({ data: { report } });
}
