import { query } from "../lib/db/client";

const CRM_LINKED_ENTITY_TYPES = ["customer", "interaction"];
const CRM_STATUS_TO_OPS_CATEGORY = {
  pending: "todo",
  in_progress: "in_progress",
  completed: "done",
};
const OPS_CATEGORY_TO_CRM_STATUS = {
  todo: "pending",
  in_progress: "in_progress",
  done: "completed",
};
const VALID_PRIORITIES = new Set(["critical", "high", "medium", "low"]);

export class OpsTaskConfigError extends Error {
  constructor(missing) {
    super(`CRM-generated Ops tasks require ${missing.join(", ")}.`);
    this.name = "OpsTaskConfigError";
    this.missing = missing;
  }
}

function getOpsTaskConfig() {
  return {
    operationId: process.env.OPS_DEFAULT_OPERATION_ID || "",
    workflowId: process.env.OPS_DEFAULT_WORKFLOW_ID || "",
    statusId: process.env.OPS_DEFAULT_STATUS_ID || "",
  };
}

function assertOpsTaskConfig() {
  const config = getOpsTaskConfig();
  const missing = [];
  if (!config.operationId) missing.push("OPS_DEFAULT_OPERATION_ID");
  if (!config.workflowId) missing.push("OPS_DEFAULT_WORKFLOW_ID");
  if (!config.statusId) missing.push("OPS_DEFAULT_STATUS_ID");
  if (missing.length) throw new OpsTaskConfigError(missing);
  return config;
}

function normalizeDueDate(value) {
  if (!value) throw new Error("due_date is required.");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("due_date must be a valid date.");
  return date.toISOString().slice(0, 10);
}

function normalizePriority(value) {
  const priority = value || "medium";
  if (!VALID_PRIORITIES.has(priority)) return "medium";
  return priority;
}

function crmStatusForOpsTask(row) {
  return OPS_CATEGORY_TO_CRM_STATUS[row.status_category] || "pending";
}

function mapOpsTaskRow(row, customer = null) {
  const linkedCustomerId = row.linked_entity_type === "customer"
    ? row.linked_entity_id
    : customer?.id || null;
  const linkedInteractionId = row.linked_entity_type === "interaction"
    ? row.linked_entity_id
    : null;

  return {
    id: row.id,
    customer_id: linkedCustomerId,
    interaction_id: linkedInteractionId,
    assigned_to: row.assignee_id,
    title: row.title,
    task: row.title,
    description: row.description,
    due_date: row.due_date,
    status: crmStatusForOpsTask(row),
    priority: row.priority,
    created_at: row.created_at,
    linked_entity_type: row.linked_entity_type,
    linked_entity_id: row.linked_entity_id,
    customers: customer,
  };
}

async function enrichCrmTaskRows(rows) {
  if (!rows.length) return [];

  const customerIds = new Set();
  const interactionIds = new Set();

  rows.forEach((row) => {
    if (row.linked_entity_type === "customer" && row.linked_entity_id) {
      customerIds.add(row.linked_entity_id);
    }
    if (row.linked_entity_type === "interaction" && row.linked_entity_id) {
      interactionIds.add(row.linked_entity_id);
    }
  });

  const customersById = new Map();
  const customersByInteractionId = new Map();

  if (customerIds.size) {
    const result = await query(
      `SELECT id, name, phone
       FROM customers
       WHERE id = ANY($1::uuid[])`,
      [[...customerIds]],
    );
    result.rows.forEach((customer) => customersById.set(customer.id, customer));
  }

  if (interactionIds.size) {
    const result = await query(
      `SELECT i.id AS interaction_id,
              c.id,
              c.name,
              c.phone
       FROM interactions i
       JOIN customers c ON c.id = i.customer_id
       WHERE i.id = ANY($1::uuid[])`,
      [[...interactionIds]],
    );

    result.rows.forEach((row) => {
      const customer = { id: row.id, name: row.name, phone: row.phone };
      customersByInteractionId.set(row.interaction_id, customer);
      customersById.set(customer.id, customer);
    });
  }

  return rows.map((row) => {
    const customer = row.linked_entity_type === "interaction"
      ? customersByInteractionId.get(row.linked_entity_id) || null
      : customersById.get(row.linked_entity_id) || null;
    return mapOpsTaskRow(row, customer);
  });
}

async function getCrmTaskRows(whereSql = "", params = []) {
  const result = await query(
    `SELECT t.id,
            t.operation_id,
            t.workflow_id,
            t.status_id,
            t.title,
            t.description,
            t.priority,
            t.assignee_id,
            t.reporter_id,
            t.created_by_id,
            t.due_date,
            t.linked_entity_type,
            t.linked_entity_id,
            t.created_at,
            s.category AS status_category,
            s.name AS status_name
     FROM tasks t
     LEFT JOIN statuses s ON s.id = t.status_id
     WHERE t.linked_entity_type = ANY($1::varchar[])
       ${whereSql}
     ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`,
    [CRM_LINKED_ENTITY_TYPES, ...params],
  );

  return result.rows;
}

export async function listCrmOpsTasks(options = {}) {
  const { viewer = null, customerId = null, interactionIds = [] } = options;
  const clauses = [];
  const params = [];

  if (viewer && viewer.role !== "admin") {
    params.push(viewer.id);
    clauses.push(`AND t.assignee_id = $${params.length + 1}::uuid`);
  }

  const rows = await getCrmTaskRows(clauses.join("\n"), params);

  let filteredRows = rows;
  if (customerId || interactionIds.length) {
    const interactionIdSet = new Set(interactionIds);
    filteredRows = rows.filter((row) => (
      (customerId && row.linked_entity_type === "customer" && row.linked_entity_id === customerId)
      || (row.linked_entity_type === "interaction" && interactionIdSet.has(row.linked_entity_id))
    ));
  }

  return enrichCrmTaskRows(filteredRows);
}

async function getStatusIdForCrmStatus(status) {
  const category = CRM_STATUS_TO_OPS_CATEGORY[status];
  if (!category) throw new Error("Unsupported task status.");

  const config = getOpsTaskConfig();
  if (status === "pending" && config.statusId) return config.statusId;
  if (!config.workflowId) throw new OpsTaskConfigError(["OPS_DEFAULT_WORKFLOW_ID"]);

  const result = await query(
    `SELECT id
     FROM statuses
     WHERE workflow_id = $1
       AND category = $2
     ORDER BY position
     LIMIT 1`,
    [config.workflowId, category],
  );

  if (!result.rows[0]?.id) throw new Error(`No Ops status found for CRM status ${status}.`);
  return result.rows[0].id;
}

export async function createOpsTask(input) {
  const config = assertOpsTaskConfig();
  const title = String(input.title || "").trim();
  if (!title) throw new Error("title is required.");

  const dueDate = normalizeDueDate(input.dueDate);
  const priority = normalizePriority(input.priority);
  const assigneeId = input.assigneeId || input.reporterId;
  const reporterId = input.reporterId;
  if (!reporterId) throw new Error("reporter_id is required.");
  if (!input.linkedEntityType || !input.linkedEntityId) {
    throw new Error("linked entity is required.");
  }

  const inserted = await query(
    `INSERT INTO tasks (
       operation_id,
       workflow_id,
       status_id,
       title,
       description,
       priority,
       assignee_id,
       reporter_id,
       created_by_id,
       due_date,
       linked_entity_type,
       linked_entity_id,
       type
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,'task')
     RETURNING id`,
    [
      config.operationId,
      config.workflowId,
      config.statusId,
      title,
      input.description || null,
      priority,
      assigneeId || null,
      reporterId,
      dueDate,
      input.linkedEntityType,
      input.linkedEntityId,
    ],
  );

  const rows = await getCrmTaskRows("AND t.id = $2::uuid", [inserted.rows[0].id]);
  const [task] = await enrichCrmTaskRows(rows);
  return task;
}

export function isOpsTaskConfigError(error) {
  return error instanceof OpsTaskConfigError || error?.name === "OpsTaskConfigError";
}

export async function createOpsTaskFromCrmInteraction({ interaction, insight, dueDate, viewer }) {
  return createOpsTask({
    title: insight.suggested_action,
    description: `Follow-up from ${interaction.channel} interaction.`,
    dueDate,
    priority: insight.urgency,
    assigneeId: viewer.id,
    reporterId: viewer.id,
    linkedEntityType: "interaction",
    linkedEntityId: interaction.id,
  });
}

export async function createOpsTaskFromCustomer(input) {
  return createOpsTask({
    title: input.title,
    description: input.description,
    dueDate: input.dueDate,
    priority: input.priority,
    assigneeId: input.assigneeId,
    reporterId: input.reporterId,
    linkedEntityType: input.interactionId ? "interaction" : "customer",
    linkedEntityId: input.interactionId || input.customerId,
  });
}

export async function updateCrmOpsTask(id, payload, viewer) {
  const existing = await query(
    `SELECT id, assignee_id, linked_entity_type, linked_entity_id
     FROM tasks
     WHERE id = $1`,
    [id],
  );
  const task = existing.rows[0];

  if (!task || !CRM_LINKED_ENTITY_TYPES.includes(task.linked_entity_type)) {
    const error = new Error("Task not found.");
    error.status = 404;
    throw error;
  }

  if (viewer.role !== "admin" && task.assignee_id !== viewer.id) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  const updates = [];
  const params = [];

  if (payload.priority !== undefined) {
    params.push(normalizePriority(payload.priority));
    updates.push(`priority = $${params.length}`);
  }

  if (payload.status !== undefined) {
    params.push(await getStatusIdForCrmStatus(payload.status));
    updates.push(`status_id = $${params.length}::uuid`);
  }

  if (!updates.length) {
    const error = new Error("No valid fields to update.");
    error.status = 400;
    throw error;
  }

  params.push(id);
  await query(
    `UPDATE tasks
     SET ${updates.join(", ")},
         updated_at = NOW()
     WHERE id = $${params.length}::uuid`,
    params,
  );

  const rows = await getCrmTaskRows("AND t.id = $2::uuid", [id]);
  const [updated] = await enrichCrmTaskRows(rows);
  return updated;
}
