import { query } from "./db/client";
import { listCrmOpsTasks } from "../shared/ops-tasks";

/**
 * Shared dashboard aggregation (admin). Used by API routes so we only
 * authenticate and query once per page load.
 */
export async function buildDashboardPayload() {
  const today = new Date().toISOString().slice(0, 10);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    interactionsResult,
    tasks,
    insightsResult,
    customersResult,
  ] = await Promise.all([
    query(
      `SELECT i.id,
              i.staff_id,
              i.content,
              i.outcome,
              i.channel,
              i.created_at,
              jsonb_build_object('name', c.name) AS customers
       FROM interactions i
       JOIN customers c ON c.id = i.customer_id
       ORDER BY i.created_at DESC`,
    ),
    listCrmOpsTasks(),
    query(
      `SELECT id,
              interaction_id,
              sentiment,
              urgency,
              category,
              suggested_action
       FROM ai_insights`,
    ),
    query(
      `SELECT id,
              name,
              phone,
              type,
              lead_score,
              next_action_date,
              next_action_note
       FROM customers`,
    ),
  ]);

  const interactions = interactionsResult.rows;
  const insights = insightsResult.rows;
  const customers = customersResult.rows;

  const interactionsToday = interactions.filter(
    (i) => new Date(i.created_at).toISOString().slice(0, 10) === today,
  ).length;

  const highUrgency = insights.filter((i) => i.urgency === "high").length;
  const openTasks = tasks.filter((t) => t.status !== "completed").length;
  const overdueTasks = tasks.filter(
    (t) => t.status !== "completed" && new Date(t.due_date) < new Date(),
  ).length;

  const byCategory = insights.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {});

  const alerts = insights
    .filter((i) => i.sentiment === "negative" || i.urgency === "high")
    .slice(0, 8);

  const insightMap = Object.fromEntries(insights.map((i) => [i.interaction_id, i]));
  const recentFeed = interactions.slice(0, 12).map((i) => ({
    id: i.id,
    content: i.content,
    staff_id: i.staff_id,
    channel: i.channel,
    outcome: i.outcome,
    created_at: i.created_at,
    customer: i.customers?.name || "Unknown",
    urgency: insightMap[i.id]?.urgency || "low",
    sentiment: insightMap[i.id]?.sentiment || "neutral",
  }));

  const dueToday = customers.filter((c) => {
    if (!c.next_action_date) return false;
    const d = new Date(c.next_action_date);
    return d <= todayEnd;
  });

  const pipeline = {
    hot: customers.filter((c) => c.lead_score === "hot").length,
    warm: customers.filter((c) => c.lead_score === "warm").length,
    cold: customers.filter((c) => c.lead_score === "cold").length,
  };

  return {
    interactionsToday,
    highUrgency,
    openTasks,
    overdueTasks,
    byCategory,
    alerts,
    recentFeed,
    dueToday,
    pipeline,
  };
}
