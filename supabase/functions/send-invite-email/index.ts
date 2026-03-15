import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_LOCAL_PUBLIC_URL = "http://localhost:8080";

const resolveAppPublicUrl = () => {
  const configuredUrl = Deno.env.get("APP_PUBLIC_URL")?.trim().replace(/\/$/, "");
  if (configuredUrl) {
    console.info(`[send-invite-email] APP_PUBLIC_URL configured: ${configuredUrl}`);
    return configuredUrl;
  }

  const stage = Deno.env.get("ENVIRONMENT") ?? Deno.env.get("SUPABASE_ENV") ?? "unknown";
  const isLocal = Deno.env.get("SUPABASE_URL")?.includes("127.0.0.1") || stage === "local" || stage === "development";

  if (isLocal) {
    console.warn(
      `[send-invite-email] APP_PUBLIC_URL is not configured for ${stage}. Falling back to ${DEFAULT_LOCAL_PUBLIC_URL}.`
    );
    return DEFAULT_LOCAL_PUBLIC_URL;
  }

  const message =
    `[send-invite-email] APP_PUBLIC_URL is not configured for ${stage}. Configure this variable to ensure invite links use the correct domain.`;
  console.error(message);
  throw new Error(message);
};

const APP_PUBLIC_URL = resolveAppPublicUrl();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, token, groupName, inviterName } = await req.json();

    if (!email || !token) {
      return new Response(JSON.stringify({ error: "Missing email or token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteLink = `${APP_PUBLIC_URL}/invite?token=${token}`;

    const resend = new Resend(resendApiKey);

    const { data, error } = await resend.emails.send({
      from: "Republi-K <onboarding@resend.dev>",
      to: [email],
      subject: `${inviterName || "Alguém"} te convidou para ${groupName || "uma república"} no Republi-K`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 16px 0;">Você foi convidado! 🏠</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${inviterName || "Um morador"} te convidou para participar ${groupName ? `da república <strong>${groupName}</strong>` : "de uma república"} no Republi-K.
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
              O Republi-K ajuda a organizar despesas, pagamentos e a convivência na república. Clique no botão abaixo para aceitar o convite:
            </p>
            <a href="${inviteLink}" style="display: inline-block; background-color: #18181b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Aceitar Convite
            </a>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5; margin: 32px 0 0 0;">
              Se o botão não funcionar, copie e cole este link no navegador:<br>
              <a href="${inviteLink}" style="color: #3b82f6; word-break: break-all;">${inviteLink}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
              Este convite expira em 7 dias. Se você não solicitou este convite, pode ignorar este email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Send invite email error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
