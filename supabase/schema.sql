-- CutOff CRM shared Neon/PostgreSQL schema.
-- CRM owns only customers, interactions, and ai_insights.
-- Ops owns users and canonical tasks.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  region TEXT,
  type TEXT NOT NULL DEFAULT 'lead'
    CHECK (type IN ('farmer', 'distributor', 'lead')),
  source TEXT,
  lead_score TEXT NOT NULL DEFAULT 'cold'
    CHECK (lead_score IN ('hot', 'warm', 'cold')),
  next_action_date TIMESTAMPTZ,
  next_action_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.users(id),
  channel TEXT NOT NULL DEFAULT 'call'
    CHECK (channel IN ('call', 'whatsapp', 'sms', 'in_person', 'email')),
  direction TEXT NOT NULL DEFAULT 'outgoing'
    CHECK (direction IN ('incoming', 'outgoing')),
  content TEXT NOT NULL,
  outcome TEXT CHECK (outcome IN ('interested', 'not_interested', 'follow_up', 'closed')),
  duration INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL UNIQUE REFERENCES public.interactions(id) ON DELETE CASCADE,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  category TEXT NOT NULL CHECK (category IN ('sales', 'support', 'logistics', 'partnership')),
  intent TEXT,
  suggested_action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_lead_score
  ON public.customers(lead_score);

CREATE INDEX IF NOT EXISTS idx_customers_next_action
  ON public.customers(next_action_date);

CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON public.customers(phone);

CREATE INDEX IF NOT EXISTS idx_interactions_customer_id
  ON public.interactions(customer_id);

CREATE INDEX IF NOT EXISTS idx_interactions_staff_id
  ON public.interactions(staff_id);

CREATE INDEX IF NOT EXISTS idx_interactions_created_at
  ON public.interactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_insights_urgency
  ON public.ai_insights(urgency);

CREATE INDEX IF NOT EXISTS idx_ai_insights_category
  ON public.ai_insights(category);
