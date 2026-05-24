-- DEV RESET ONLY.
-- Do not run this against production or the shared Neon database.
-- This file intentionally drops tables for local development reset purposes.

DROP TABLE IF EXISTS public.ai_insights CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.calls CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
