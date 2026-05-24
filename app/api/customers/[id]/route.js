import { NextResponse } from "next/server";
import { requireViewer } from "../../../../lib/auth";
import { listCrmOpsTasks } from "../../../../shared/ops-tasks";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { isSupabaseConfigured } from "../../../../lib/supabase/config";

export async function GET(request, { params }) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const auth = await requireViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const supabase = createSupabaseServerClient();
  const { id }   = params;

  const [{ data: customer }, { data: interactions }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase
      .from("interactions")
      .select(`
        id, channel, direction, content, outcome, duration, created_at, staff_id,
        ai_insights ( sentiment, urgency, category, intent, suggested_action )
      `)
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const tasks = await listCrmOpsTasks(supabase, {
    viewer: auth.viewer,
    customerId: id,
    interactionIds: (interactions || []).map((interaction) => interaction.id),
  });

  return NextResponse.json({
    data: { customer, interactions: interactions || [], tasks },
  });
}

export async function PATCH(request, { params }) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const auth = await requireViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const payload  = await request.json();
  const supabase = createSupabaseServerClient();
  const { id }   = params;

  // Only allow updating these fields
  const allowed = ["name", "lead_score", "next_action_date", "next_action_note", "type", "phone", "region"];
  const updates = Object.fromEntries(
    Object.entries(payload).filter(([k]) => allowed.includes(k)),
  );

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(request, { params }) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const auth = await requireViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const supabase = createSupabaseServerClient();
  const { id }   = params;

  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
