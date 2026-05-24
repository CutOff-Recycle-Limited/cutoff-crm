import { NextResponse } from "next/server";
import { requireViewer } from "../../../../lib/auth";
import { query } from "../../../../lib/db/client";
import { isSupabaseConfigured } from "../../../../lib/supabase/config";

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

  const allowed = ["channel", "direction", "content", "outcome", "duration"];
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
      `UPDATE interactions
       SET ${sets.join(", ")},
           updated_at = NOW()
       WHERE id = $${values.length + 1}::uuid
       RETURNING *`,
      [...values, id],
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: "Interaction not found." }, { status: 404 });
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
    await query("DELETE FROM interactions WHERE id = $1::uuid", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
