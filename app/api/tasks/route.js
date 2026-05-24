import { NextResponse } from "next/server";
import { requireSharedViewer, requireViewer } from "../../../lib/auth";
import { createOpsTaskFromCustomer, isOpsTaskConfigError, listCrmOpsTasks } from "../../../shared/ops-tasks";
import { isSupabaseConfigured } from "../../../lib/supabase/config";

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const auth = await requireViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const data = await listCrmOpsTasks({ viewer: auth.viewer });
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const auth = await requireSharedViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const payload  = await request.json();

  try {
    const data = await createOpsTaskFromCustomer({
      customerId: payload.customer_id,
      interactionId: payload.interaction_id || null,
      assigneeId: payload.assigned_to || auth.viewer.id,
      reporterId: auth.viewer.id,
      title: payload.title,
      description: payload.description || null,
      dueDate: payload.due_date,
      priority: payload.priority || "medium",
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const status = isOpsTaskConfigError(error) ? 500 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
