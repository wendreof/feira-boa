import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const avatarBucket = "avatars";

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Authentication required" }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return Response.json({ error: "Account deletion is not configured" }, { status: 500, headers: corsHeaders });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: "Invalid session" }, { status: 401, headers: corsHeaders });
  }

  // Collect the avatar before the account disappears: the profile row is
  // removed by the cascade, so the file path has to be read first.
  const { data: profile } = await adminClient
    .from("profiles")
    .select("avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();
  const avatarPaths = new Set<string>();
  if (profile?.avatar_path) avatarPaths.add(profile.avatar_path);
  const { data: storedFiles } = await adminClient.storage.from(avatarBucket).list(user.id);
  for (const file of storedFiles ?? []) {
    if (file?.name) avatarPaths.add(`${user.id}/${file.name}`);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return Response.json({ error: "Account deletion failed" }, { status: 500, headers: corsHeaders });
  }

  // The account is gone; the avatar files are now orphans, so remove them.
  if (avatarPaths.size > 0) {
    const { error: storageError } = await adminClient.storage.from(avatarBucket).remove([...avatarPaths]);
    if (storageError) {
      console.error("Could not remove the avatar files of the deleted account.", storageError);
    }
  }

  return Response.json({ success: true }, { headers: corsHeaders });
});
