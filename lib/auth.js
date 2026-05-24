import { cache } from "react";
import { createSupabaseServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";

async function getViewerImpl() {
  if (!isSupabaseConfigured) return null;

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const authEmail = user.email?.toLowerCase();
  let sharedUser = null;
  let platformRole = null;

  if (authEmail) {
    const { data } = await supabase
      .from("users")
      .select("id, name, email, role, avatar_color")
      .eq("email", authEmail)
      .maybeSingle();
    sharedUser = data || null;
  }

  if (!sharedUser) {
    const { data } = await supabase
      .from("users")
      .select("id, name, email, role, avatar_color")
      .eq("id", user.id)
      .maybeSingle();
    sharedUser = data || null;
  }

  if (sharedUser?.id) {
    const { data } = await supabase
      .from("user_platform_roles")
      .select("role")
      .eq("user_id", sharedUser.id)
      .eq("platform", "crm")
      .maybeSingle();
    platformRole = data || null;
  }

  const role = platformRole?.role
    || user.user_metadata?.role
    || (sharedUser?.role === "admin" ? "admin" : "staff");

  return {
    id: sharedUser?.id || user.id,
    authUserId: user.id,
    sharedUserId: sharedUser?.id || null,
    email: sharedUser?.email || user.email,
    role,
    fullName: sharedUser?.name || user.user_metadata?.full_name || user.email || "User",
    avatarUrl: null,
  };
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
