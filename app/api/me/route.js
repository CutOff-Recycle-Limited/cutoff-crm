import { NextResponse } from "next/server";
import { getViewer } from "../../../lib/auth";
import { isSupabaseConfigured } from "../../../lib/supabase/config";
import { isDatabaseConfigured } from "../../../lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured || !isDatabaseConfigured) {
    const missing = [
      !isDatabaseConfigured ? "DATABASE_URL" : null,
      !isSupabaseConfigured ? "NEXT_PUBLIC_AUTH_SUPABASE_URL" : null,
      !isSupabaseConfigured ? "NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY" : null,
    ].filter(Boolean);

    return NextResponse.json(
      { configured: false, viewer: null, message: `Set ${missing.join(", ")}.` },
      { status: 200 },
    );
  }

  const viewer = await getViewer();
  return NextResponse.json({ configured: true, viewer });
}
