// Envia email de redefinição de senha via SMTP (Hostinger),
// gerando código único armazenado em password_reset_tokens.
// Endpoint público — sem JWT.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_TTL_MINUTES = 60;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, redirectBase } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Resposta neutra: nunca revelar se o email existe (anti-enumeração).
    const neutralResponse = new Response(
      JSON.stringify({
        ok: true,
        message:
          "Se este email estiver cadastrado, você receberá um código de redefinição em instantes.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

    // Procura usuário pelo email
    const { data: usersList } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const user = usersList?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (!user) {
      console.log(`[send-password-reset] Email não encontrado: ${email}`);
      return neutralResponse;
    }

    // Gera código + hash vinculado ao email
    const normalizedEmail = email.toLowerCase().trim();
    const code = generateRecoveryCode();
    const tokenHash = await sha256Hex(`${normalizedEmail}:${code}`);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000).toISOString();

    await adminClient
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("email", normalizedEmail)
      .is("used_at", null);

    const { error: insertErr } = await adminClient
      .from("password_reset_tokens")
      .insert({
        email: normalizedEmail,
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        ip_address: req.headers.get("x-forwarded-for") ?? null,
        user_agent: req.headers.get("user-agent") ?? null,
      });
    if (insertErr) {
      console.error("[send-password-reset] insert error:", insertErr);
      throw insertErr;
    }

    // Monta link para o formulário com campo de código
    const base = (redirectBase ?? "").replace(/\/$/, "");
    const link = `${base}/redefinir-senha?email=${encodeURIComponent(normalizedEmail)}`;

    // Conteúdo do email
    const html = `
      <p>Olá,</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
      <p>Copie o código abaixo e cole no formulário de redefinição. Ele é válido por <strong>${TOKEN_TTL_MINUTES} minutos</strong> e só pode ser usado uma vez.</p>
      <p style="text-align:center;margin:28px 0;">
        <span style="display:inline-block;background:#f7f2e7;color:#7a5600;padding:16px 24px;border-radius:8px;font-size:28px;letter-spacing:6px;font-weight:700;font-family:Arial,sans-serif;">${code}</span>
      </p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${link}" style="display:inline-block;background:#b8860b;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Abrir formulário de redefinição</a>
      </p>
      <p style="color:#666;font-size:13px;">Se o botão não abrir, copie e cole este endereço no navegador:<br/>
        <a href="${link}" style="color:#b8860b;word-break:break-all;">${link}</a>
      </p>
      <p style="color:#888;font-size:12px;margin-top:32px;">Se você não solicitou esta redefinição, ignore este email — sua senha permanecerá inalterada.</p>
    `;

    // Despacha via send-email (que usa SMTP Hostinger)
    const sendResp = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        template: "custom",
        to: email,
        subject: "Redefinição de senha",
        html,
      }),
    });

    if (!sendResp.ok) {
      const errText = await sendResp.text();
      console.error("[send-password-reset] send-email failed:", errText);
    } else {
      console.log(`[send-password-reset] Email enviado para ${email}`);
    }

    return neutralResponse;
  } catch (err) {
    console.error("[send-password-reset] error:", err);
    return new Response(
      JSON.stringify({ error: "Erro ao processar solicitação" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});