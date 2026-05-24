import { NextResponse } from "next/server";
import { requireViewer } from "../../../lib/auth";
import { query } from "../../../lib/db/client";
import { listCustomers } from "../../../lib/db/crm-data";
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
    const data = await listCustomers();
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const auth = await requireViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const payload = await request.json();

  try {
    const result = await query(
      `INSERT INTO customers (name, phone, region, type, source)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        payload.name,
        payload.phone || null,
        payload.region || null,
        payload.type || "lead",
        payload.source || "manual",
      ],
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
