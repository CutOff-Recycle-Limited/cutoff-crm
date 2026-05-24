import { NextResponse } from "next/server";
import { requireViewer } from "../../../../lib/auth";
import { listCrmOpsTasks } from "../../../../shared/ops-tasks";
import { query } from "../../../../lib/db/client";
import { getCustomer, listInteractions } from "../../../../lib/db/crm-data";
import { isSupabaseConfigured } from "../../../../lib/supabase/config";

export async function GET(request, { params }) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const auth = await requireViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const { id }   = params;

  const [customer, interactions] = await Promise.all([
    getCustomer(id),
    listInteractions({ customerId: id }),
  ]);

  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const tasks = await listCrmOpsTasks({
    viewer: auth.viewer,
    customerId: id,
    interactionIds: interactions.map((interaction) => interaction.id),
  });

  return NextResponse.json({
    data: { customer, interactions, tasks },
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
  const { id }   = params;

  // Only allow updating these fields
  const allowed = ["name", "lead_score", "next_action_date", "next_action_note", "type", "phone", "region"];
  const updates = Object.fromEntries(
    Object.entries(payload).filter(([k]) => allowed.includes(k)),
  );

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const columns = Object.keys(updates);
  const values = Object.values(updates);
  const sets = columns.map((column, index) => `${column} = $${index + 1}`);

  try {
    const result = await query(
      `UPDATE customers
       SET ${sets.join(", ")},
           updated_at = NOW()
       WHERE id = $${values.length + 1}::uuid
       RETURNING *`,
      [...values, id],
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const auth = await requireViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const { id }   = params;

  try {
    await query("DELETE FROM customers WHERE id = $1::uuid", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
