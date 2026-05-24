import { query } from "../db/client";

export async function getSharedViewerForAuthUser(authUser) {
  if (!authUser) return null;

  const authEmail = authUser.email?.toLowerCase();
  let sharedUser = null;

  if (authEmail) {
    const result = await query(
      `SELECT id, name, email, role, avatar_color
       FROM users
       WHERE lower(email) = $1
       LIMIT 1`,
      [authEmail],
    );
    sharedUser = result.rows[0] || null;
  }

  if (!sharedUser) {
    const result = await query(
      `SELECT id, name, email, role, avatar_color
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [authUser.id],
    );
    sharedUser = result.rows[0] || null;
  }

  let platformRole = null;
  if (sharedUser?.id) {
    const result = await query(
      `SELECT role
       FROM user_platform_roles
       WHERE user_id = $1
         AND platform = 'crm'
       LIMIT 1`,
      [sharedUser.id],
    );
    platformRole = result.rows[0] || null;
  }

  const role = platformRole?.role || "staff";

  return {
    id: sharedUser?.id || authUser.id,
    authUserId: authUser.id,
    sharedUserId: sharedUser?.id || null,
    email: sharedUser?.email || authUser.email,
    role,
    fullName: sharedUser?.name || authUser.user_metadata?.full_name || authUser.email || "User",
    avatarColor: sharedUser?.avatar_color || null,
    avatarUrl: null,
  };
}
