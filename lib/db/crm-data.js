import { query } from "./client";

const interactionSelect = `
  SELECT i.id,
         i.customer_id,
         i.staff_id,
         i.channel,
         i.direction,
         i.content,
         i.outcome,
         i.duration,
         i.created_at,
         jsonb_build_object(
           'id', c.id,
           'name', c.name,
           'phone', c.phone,
           'type', c.type
         ) AS customers,
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', ai.id,
               'sentiment', ai.sentiment,
               'urgency', ai.urgency,
               'category', ai.category,
               'intent', ai.intent,
               'suggested_action', ai.suggested_action,
               'created_at', ai.created_at
             )
           ) FILTER (WHERE ai.id IS NOT NULL),
           '[]'::jsonb
         ) AS ai_insights
  FROM interactions i
  JOIN customers c ON c.id = i.customer_id
  LEFT JOIN ai_insights ai ON ai.interaction_id = i.id
`;

export async function listInteractions({ viewer, customerId = null, channel = null, limit = null } = {}) {
  const clauses = [];
  const params = [];

  if (viewer && viewer.role !== "admin") {
    params.push(viewer.id);
    clauses.push(`i.staff_id = $${params.length}::uuid`);
  }

  if (customerId) {
    params.push(customerId);
    clauses.push(`i.customer_id = $${params.length}::uuid`);
  }

  if (channel) {
    params.push(channel);
    clauses.push(`i.channel = $${params.length}`);
  }

  const limitSql = limit ? `LIMIT ${Number(limit)}` : "";
  const result = await query(
    `${interactionSelect}
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     GROUP BY i.id, c.id
     ORDER BY i.created_at DESC
     ${limitSql}`,
    params,
  );

  return result.rows;
}

export async function listCustomers() {
  const result = await query(
    `SELECT id,
            name,
            phone,
            region,
            type,
            source,
            lead_score,
            next_action_date,
            next_action_note,
            created_at,
            updated_at
     FROM customers
     ORDER BY created_at DESC`,
  );

  return result.rows;
}

export async function getCustomer(id) {
  const result = await query(
    `SELECT *
     FROM customers
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] || null;
}
