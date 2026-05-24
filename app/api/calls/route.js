import { NextResponse } from "next/server";
import { analyzeCall } from "../../../lib/call-intelligence";
import { requireSharedViewer, requireViewer } from "../../../lib/auth";
import { createOpsTaskFromCrmInteraction, isOpsTaskConfigError } from "../../../shared/ops-tasks";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { isSupabaseConfigured } from "../../../lib/supabase/config";

function mapInteractionToCall(interaction) {
  return {
    id: interaction.id,
    customer_id: interaction.customer_id,
    staff_id: interaction.staff_id,
    type: interaction.direction,
    purpose: interaction.outcome === "follow_up" ? "follow-up" : "inquiry",
    summary: interaction.content,
    outcome: interaction.outcome,
    duration: interaction.duration,
    created_at: interaction.created_at,
    customers: interaction.customers,
    ai_insights: interaction.ai_insights,
  };
}

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase env is not configured." }, { status: 500 });
  }

  const auth = await requireViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("interactions")
    .select(`
      id,
      customer_id,
      staff_id,
      direction,
      content,
      outcome,
      duration,
      created_at,
      customers ( id, name, phone ),
      ai_insights ( sentiment, urgency, category, suggested_action )
    `)
    .eq("channel", "call")
    .order("created_at", { ascending: false });

  if (auth.viewer.role !== "admin") {
    query = query.eq("staff_id", auth.viewer.id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: (data || []).map(mapInteractionToCall) });
}

export async function POST(request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase env is not configured." }, { status: 500 });
  }

  const auth = await requireSharedViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const payload = await request.json();
  const supabase = createSupabaseServerClient();

  let customerId = payload.customer_id;

  if (!customerId && payload.customer_name) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        name: payload.customer_name,
        phone: payload.customer_phone || null,
        region: payload.customer_region || null,
        source: payload.customer_source || "manual",
      })
      .select("id")
      .single();

    if (customerError) {
      return NextResponse.json({ error: customerError.message }, { status: 500 });
    }

    customerId = customer.id;
  }

  if (!customerId) {
    return NextResponse.json({ error: "customer_id or customer_name is required." }, { status: 400 });
  }

  const interactionPayload = {
    customer_id: customerId,
    staff_id: auth.viewer.id,
    channel: "call",
    direction: payload.type || "outgoing",
    content: payload.summary,
    outcome: payload.outcome,
    duration: payload.duration ? Number(payload.duration) : null,
  };

  const { data: interaction, error: interactionError } = await supabase
    .from("interactions")
    .insert(interactionPayload)
    .select("id, customer_id, staff_id, channel, direction, content, outcome, duration, created_at")
    .single();

  if (interactionError) {
    return NextResponse.json({ error: interactionError.message }, { status: 500 });
  }

  const insightPayload = {
    interaction_id: interaction.id,
    ...analyzeCall(interaction.content),
  };

  const { error: insightError } = await supabase.from("ai_insights").insert(insightPayload);
  if (insightError) {
    return NextResponse.json({ error: insightError.message }, { status: 500 });
  }

  let task = null;
  let taskWarning = null;
  if (interaction.outcome === "follow_up") {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (insightPayload.urgency === "high" ? 1 : 2));

    try {
      task = await createOpsTaskFromCrmInteraction(supabase, {
        interaction,
        insight: insightPayload,
        dueDate,
        viewer: auth.viewer,
      });
    } catch (error) {
      if (isOpsTaskConfigError(error)) {
        taskWarning = error.message;
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    data: { call: mapInteractionToCall(interaction), insight: insightPayload, task, taskWarning },
  }, { status: 201 });
}
