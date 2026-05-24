import { cache } from "react";
import { getSharedViewerForAuthUser } from "./auth/shared-user";
import { createSupabaseServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";

async function getViewerImpl() {
  if (!isSupabaseConfigured) return null;

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return getSharedViewerForAuthUser(user);
}

/** Dedupes within a single server request (layout + RSC + parallel calls). */
export const getViewer = cache(getViewerImpl);

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) {
    return { error: { status: 401, message: "Not authenticated" } };
  }
  return { viewer };
}

export async function requireSharedViewer() {
  const auth = await requireViewer();
  if (auth.error) return auth;

  if (!auth.viewer.sharedUserId) {
    return {
      error: {
        status: 403,
        message: "Authenticated account is not linked to a shared users record.",
      },
    };
  }

  return auth;
}
