import { NextResponse } from "next/server";
import { requireSharedViewer } from "../../../../lib/auth";
import { isOpsTaskConfigError, updateCrmOpsTask } from "../../../../shared/ops-tasks";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { isSupabaseConfigured } from "../../../../lib/supabase/config";

export async function PATCH(request, { params }) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const auth = await requireSharedViewer();
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const payload  = await request.json();
  const supabase = createSupabaseServerClient();
  const { id }   = params;

  try {
    const data = await updateCrmOpsTask(supabase, id, payload, auth.viewer);
    return NextResponse.json({ data });
  } catch (error) {
    const status = error.status || (isOpsTaskConfigError(error) ? 500 : 500);
    return NextResponse.json({ error: error.message }, { status });
  }
}
