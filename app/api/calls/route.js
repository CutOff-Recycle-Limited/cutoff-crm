import { NextResponse } from "next/server";
import { analyzeCall } from "../../../lib/call-intelligence";
import { requireSharedViewer, requireViewer } from "../../../lib/auth";
import { createOpsTaskFromCrmInteraction, isOpsTaskConfigError } from "../../../shared/ops-tasks";
import { withTransaction } from "../../../lib/db/client";
import { listInteractions } from "../../../lib/db/crm-data";
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

  try {
    const data = await listInteractions({ viewer: auth.viewer, channel: "call" });
    return NextResponse.json({ data: data.map(mapInteractionToCall) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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
  let task = null;
  let taskWarning = null;
  let interaction;
  let insightPayload;
  let dueDate = null;

  try {
    ({ interaction, insightPayload, dueDate } = await withTransaction(async (client) => {
      let customerId = payload.customer_id;

      if (!customerId && payload.customer_name) {
        const customerResult = await client.query(
          `INSERT INTO customers (name, phone, region, source)
           VALUES ($1,$2,$3,$4)
           RETURNING id`,
          [
            payload.customer_name,
            payload.customer_phone || null,
            payload.customer_region || null,
            payload.customer_source || "manual",
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
         VALUES ($1,$2,'call',$3,$4,$5,$6)
         RETURNING id, customer_id, staff_id, channel, direction, content, outcome, duration, created_at`,
        [
          customerId,
          auth.viewer.id,
          payload.type || "outgoing",
          payload.summary,
          payload.outcome,
          payload.duration ? Number(payload.duration) : null,
        ],
      );
      const createdInteraction = interactionResult.rows[0];

      const analyzedInsight = {
        interaction_id: createdInteraction.id,
        ...analyzeCall(createdInteraction.content),
      };

      await client.query(
        `INSERT INTO ai_insights (
           interaction_id,
           sentiment,
           urgency,
           category,
           suggested_action
         )
         VALUES ($1,$2,$3,$4,$5)`,
        [
          analyzedInsight.interaction_id,
          analyzedInsight.sentiment,
          analyzedInsight.urgency,
          analyzedInsight.category,
          analyzedInsight.suggested_action,
        ],
      );

      let nextDueDate = null;
      if (createdInteraction.outcome === "follow_up") {
        nextDueDate = new Date();
        nextDueDate.setDate(nextDueDate.getDate() + (analyzedInsight.urgency === "high" ? 1 : 2));
      }

      return {
        interaction: createdInteraction,
        insightPayload: analyzedInsight,
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
