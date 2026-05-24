import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function isAdmin(token: string): Promise<{ ok: boolean; userId?: string }> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const u = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: claims } = await u.auth.getClaims(token);
  const uid = claims?.claims?.sub;
  if (!uid) return { ok: false };
  const admin = createClient(url, service);
  const { data } = await admin.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
  return { ok: !!data, userId: uid };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const reqUrl = new URL(req.url);
  const action = reqUrl.searchParams.get("action") || "latest";

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  const serviceCall = token && token === service;

  let userId: string | undefined;
  if (!serviceCall) {
    if (!token) return json(401, { error: "Missing Authorization" });
    const auth = await isAdmin(token);
    if (!auth.ok) return json(403, { error: "Admin only" });
    userId = auth.userId;
  }

  const admin = createClient(url, service);

  try {
    if (action === "list") {
      const { data, error } = await admin
        .from("schema_backups")
        .select("id, created_at, source, size_bytes")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return json(200, { items: data ?? [] });
    }

    if (action === "create" || req.method === "POST") {
      const { data, error } = await admin.rpc("create_schema_backup", { _source: "manual" });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return json(200, {
        id: row?.id,
        created_at: row?.created_at,
        source: row?.source,
        size_bytes: row?.size_bytes,
      });
    }

    if (action === "delete") {
      const id = reqUrl.searchParams.get("id");
      if (!id) return json(400, { error: "id required" });
      const { error } = await admin.from("schema_backups").delete().eq("id", id);
      if (error) throw error;
      return json(200, { success: true });
    }

    // action: download (specific id) or latest
    let query = admin.from("schema_backups").select("id, created_at, sql_content");
    const id = reqUrl.searchParams.get("id");
    if (id) {
      query = query.eq("id", id);
    } else {
      query = query.order("created_at", { ascending: false }).limit(1);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    let sql = data?.sql_content as string | undefined;
    let createdAt = data?.created_at as string | undefined;

    if (!sql) {
      // No backup exists yet — generate one on the fly
      const { data: created, error: cErr } = await admin.rpc("create_schema_backup", { _source: "manual" });
      if (cErr) throw cErr;
      const row = Array.isArray(created) ? created[0] : created;
      sql = row?.sql_content;
      createdAt = row?.created_at;
      if (!sql) {
        const { data: again } = await admin.from("schema_backups").select("sql_content, created_at").eq("id", row?.id).maybeSingle();
        sql = again?.sql_content;
        createdAt = again?.created_at;
      }
    }

    const stamp = (createdAt ?? new Date().toISOString()).replace(/[:.]/g, "-");
    return new Response(sql ?? "", {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="schema-${stamp}.sql"`,
      },
    });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
});
