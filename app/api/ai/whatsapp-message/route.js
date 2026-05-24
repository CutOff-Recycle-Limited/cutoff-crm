import { NextResponse } from "next/server";
import { requireViewer } from "../../../../lib/auth";
import { isSupabaseConfigured } from "../../../../lib/supabase/config";
import { generateWhatsAppMessage } from "../../../../lib/ai";
import { getCustomer, listInteractions } from "../../../../lib/db/crm-data";

export async function POST(request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const auth = await requireViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const { customer_id } = await request.json();
  if (!customer_id) {
    return NextResponse.json({ error: "customer_id is required." }, { status: 400 });
  }

  // Fetch customer + last interaction + its insight
  const [customer, interactions] = await Promise.all([
    getCustomer(customer_id),
    listInteractions({ customerId: customer_id, limit: 1 }),
  ]);

  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const lastInteraction = interactions?.[0] || null;
  const insight         = lastInteraction?.ai_insights?.[0] || null;

  const message = generateWhatsAppMessage({ customer, lastInteraction, insight });

  return NextResponse.json({ data: { message } });
}
