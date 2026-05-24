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

function joinedStatus(row) {
  const status = Array.isArray(row.statuses) ? row.statuses[0] : row.statuses;
  return status || {};
}

function crmStatusForOpsTask(row) {
  const category = joinedStatus(row).category;
  return OPS_CATEGORY_TO_CRM_STATUS[category] || "pending";
}

function mapOpsTaskRow(row, customer = null) {
  const linkedCustomerId = row.linked_entity_type === "customer" ? row.linked_entity_id : customer?.id || null;
  const linkedInteractionId = row.linked_entity_type === "interaction" ? row.linked_entity_id : null;

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

async function enrichCrmTaskRows(supabase, rows) {
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
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone")
      .in("id", Array.from(customerIds));
    if (error) throw new Error(error.message);
    (data || []).forEach((customer) => customersById.set(customer.id, customer));
  }

  if (interactionIds.size) {
    const { data, error } = await supabase
      .from("interactions")
      .select("id, customer_id, customers ( id, name, phone )")
      .in("id", Array.from(interactionIds));
    if (error) throw new Error(error.message);

    (data || []).forEach((interaction) => {
      const customer = Array.isArray(interaction.customers)
        ? interaction.customers[0]
        : interaction.customers;
      if (customer) {
        customersByInteractionId.set(interaction.id, customer);
        customersById.set(customer.id, customer);
      }
    });
  }

  return rows.map((row) => {
    const customer = row.linked_entity_type === "interaction"
      ? customersByInteractionId.get(row.linked_entity_id) || null
      : customersById.get(row.linked_entity_id) || null;
    return mapOpsTaskRow(row, customer);
  });
}

export async function listCrmOpsTasks(supabase, options = {}) {
  const { viewer = null, customerId = null, interactionIds = [] } = options;

  let query = supabase
    .from("tasks")
    .select(`
      id, operation_id, workflow_id, status_id, title, description, priority,
      assignee_id, reporter_id, created_by_id, due_date,
      linked_entity_type, linked_entity_id, created_at,
      statuses ( category, name )
    `)
    .in("linked_entity_type", CRM_LINKED_ENTITY_TYPES)
    .order("due_date", { ascending: true });

  if (viewer && viewer.role !== "admin") {
    query = query.eq("assignee_id", viewer.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = data || [];
  if (customerId || interactionIds.length) {
    const interactionIdSet = new Set(interactionIds);
    rows = rows.filter((row) => (
      (customerId && row.linked_entity_type === "customer" && row.linked_entity_id === customerId)
      || (row.linked_entity_type === "interaction" && interactionIdSet.has(row.linked_entity_id))
    ));
  }

  return enrichCrmTaskRows(supabase, rows);
}

async function getStatusIdForCrmStatus(supabase, status) {
  const category = CRM_STATUS_TO_OPS_CATEGORY[status];
  if (!category) throw new Error("Unsupported task status.");

  const config = getOpsTaskConfig();
  if (status === "pending" && config.statusId) return config.statusId;
  if (!config.workflowId) throw new OpsTaskConfigError(["OPS_DEFAULT_WORKFLOW_ID"]);

  const { data, error } = await supabase
    .from("statuses")
    .select("id")
    .eq("workflow_id", config.workflowId)
    .eq("category", category)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error(`No Ops status found for CRM status ${status}.`);
  return data.id;
}

export async function createOpsTask(supabase, input) {
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

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      operation_id: config.operationId,
      workflow_id: config.workflowId,
      status_id: config.statusId,
      title,
      description: input.description || null,
      priority,
      assignee_id: assigneeId || null,
      reporter_id: reporterId,
      created_by_id: reporterId,
      due_date: dueDate,
      linked_entity_type: input.linkedEntityType,
      linked_entity_id: input.linkedEntityId,
      type: "task",
    })
    .select(`
      id, operation_id, workflow_id, status_id, title, description, priority,
      assignee_id, reporter_id, created_by_id, due_date,
      linked_entity_type, linked_entity_id, created_at,
      statuses ( category, name )
    `)
    .single();

  if (error) throw new Error(error.message);
  const [task] = await enrichCrmTaskRows(supabase, [data]);
  return task;
}

export function isOpsTaskConfigError(error) {
  return error instanceof OpsTaskConfigError || error?.name === "OpsTaskConfigError";
}

export async function createOpsTaskFromCrmInteraction(supabase, { interaction, insight, dueDate, viewer }) {
  return createOpsTask(supabase, {
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

export async function createOpsTaskFromCustomer(supabase, input) {
  return createOpsTask(supabase, {
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

export async function updateCrmOpsTask(supabase, id, payload, viewer) {
  const { data: existing, error: existingError } = await supabase
    .from("tasks")
    .select("id, assignee_id, linked_entity_type, linked_entity_id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (!existing || !CRM_LINKED_ENTITY_TYPES.includes(existing.linked_entity_type)) {
    const error = new Error("Task not found.");
    error.status = 404;
    throw error;
  }

  if (viewer.role !== "admin" && existing.assignee_id !== viewer.id) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  const updates = {};
  if (payload.priority !== undefined) updates.priority = normalizePriority(payload.priority);
  if (payload.status !== undefined) {
    updates.status_id = await getStatusIdForCrmStatus(supabase, payload.status);
  }

  if (!Object.keys(updates).length) {
    const error = new Error("No valid fields to update.");
    error.status = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select(`
      id, operation_id, workflow_id, status_id, title, description, priority,
      assignee_id, reporter_id, created_by_id, due_date,
      linked_entity_type, linked_entity_id, created_at,
      statuses ( category, name )
    `)
    .single();

  if (error) throw new Error(error.message);
  const [task] = await enrichCrmTaskRows(supabase, [data]);
  return task;
}
