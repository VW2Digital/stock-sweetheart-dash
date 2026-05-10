// Valida código de redefinição e atualiza senha do usuário.
// Endpoint público — sem JWT.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const email = String(body.email ?? "").toLowerCase().trim();
    const code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const action = String(body.action ?? "verify"); // "verify" ou "reset"
    const newPassword = body.password ? String(body.password) : null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Email inválido", code: "invalid_email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!code || code.length !== 8) {
      return new Response(
        JSON.stringify({ error: "Código inválido", code: "invalid_format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const tokenHash = await sha256Hex(`${email}:${code}`);

    const { data: row, error: selErr } = await adminClient
      .from("password_reset_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("email", email)
      .maybeSingle();

    if (selErr) throw selErr;
    if (!row) {
      return new Response(
        JSON.stringify({ error: "Código inválido. Verifique se digitou corretamente ou solicite um novo código.", code: "invalid_code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (row.used_at) {
      return new Response(
        JSON.stringify({ error: "Este código já foi utilizado. Solicite um novo código para continuar.", code: "used" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ error: "Código expirado. Os códigos têm validade de 10 minutos. Solicite um novo código para continuar.", code: "expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "verify") {
      return new Response(
        JSON.stringify({ ok: true, email: row.email }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // action === "reset"
    if (!newPassword || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula e número." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: updErr } = await adminClient.auth.admin.updateUserById(
      row.user_id,
      { password: newPassword },
    );
    if (updErr) {
      console.error("[verify-password-reset] updateUser error:", updErr);
      return new Response(
        JSON.stringify({ error: updErr.message ?? "Erro ao atualizar senha" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await adminClient
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);

    console.log(`[verify-password-reset] Senha redefinida para ${row.email}`);

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[verify-password-reset] error:", err);
    return new Response(
      JSON.stringify({ error: "Erro ao processar solicitação" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});