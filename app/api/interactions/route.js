import { NextResponse } from "next/server";
import { analyzeInteraction, computeLeadScore } from "../../../lib/ai";
import { requireSharedViewer } from "../../../lib/auth";
import { createOpsTaskFromCrmInteraction, isOpsTaskConfigError } from "../../../shared/ops-tasks";
import { withTransaction } from "../../../lib/db/client";
import { listInteractions } from "../../../lib/db/crm-data";
import { isSupabaseConfigured } from "../../../lib/supabase/config";

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const auth = await requireSharedViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const data = await listInteractions({ viewer: auth.viewer });
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
  let task = null;
  let taskWarning = null;
  let interaction;
  let insight;
  let dueDate = null;

  try {
    ({ interaction, insight, dueDate } = await withTransaction(async (client) => {
      let customerId = payload.customer_id;

      if (!customerId && payload.customer_name) {
        const customerResult = await client.query(
          `INSERT INTO customers (name, phone, type, source)
           VALUES ($1,$2,$3,'manual')
           RETURNING id`,
          [
            payload.customer_name,
            payload.customer_phone || null,
            payload.customer_type || "lead",
          ],
        );
        customerId = customerResult.rows[0].id;
      }

      if (!customerId) {
        const error = new Error("customer_id or customer_name is required.");
        error.status = 400;
        throw error;
      }

      const interactionResult = await client.query(
        `INSERT INTO interactions (
           customer_id,
           staff_id,
           channel,
           direction,
           content,
           outcome,
           duration
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, customer_id, staff_id, channel, direction, content, outcome, duration, created_at`,
        [
          customerId,
          auth.viewer.id,
          payload.channel || "call",
          payload.direction || "outgoing",
          payload.content,
          payload.outcome || null,
          payload.duration ? Number(payload.duration) : null,
        ],
      );
      const createdInteraction = interactionResult.rows[0];

      const analyzedInsight = analyzeInteraction(createdInteraction.content);
      await client.query(
        `INSERT INTO ai_insights (
           interaction_id,
           sentiment,
           urgency,
           category,
           intent,
           suggested_action
         )
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          createdInteraction.id,
          analyzedInsight.sentiment,
          analyzedInsight.urgency,
          analyzedInsight.category,
          analyzedInsight.intent || null,
          analyzedInsight.suggested_action,
        ],
      );

      const newScore = computeLeadScore(createdInteraction.outcome, analyzedInsight.sentiment);
      await client.query(
        `UPDATE customers
         SET lead_score = $1,
             updated_at = NOW()
         WHERE id = $2::uuid`,
        [newScore, customerId],
      );

      let nextDueDate = null;
      if (createdInteraction.outcome === "follow_up" || analyzedInsight.urgency === "high") {
        nextDueDate = new Date();
        nextDueDate.setDate(nextDueDate.getDate() + (analyzedInsight.urgency === "high" ? 1 : 2));

        await client.query(
          `UPDATE customers
           SET next_action_date = $1,
               next_action_note = $2,
               updated_at = NOW()
           WHERE id = $3::uuid`,
          [nextDueDate.toISOString(), analyzedInsight.suggested_action, customerId],
        );
      }

      return {
        interaction: createdInteraction,
        insight: analyzedInsight,
        dueDate: nextDueDate,
      };
    }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }

  if (dueDate) {
    try {
      task = await createOpsTaskFromCrmInteraction({
        interaction,
        insight,
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

  return NextResponse.json({ data: { interaction, insight, task, taskWarning } }, { status: 201 });
}
