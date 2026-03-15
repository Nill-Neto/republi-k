// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { encodeBase64 } from "https://deno.land/std@0.207.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const escapeCsv = (str: any) => {
  if (str === null || str === undefined) return "";
  const s = String(str);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 365;

const parseIsoDate = (value: unknown, field: string) => {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw new Error(`${field} must be in YYYY-MM-DD format`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} is invalid`);
  }

  return parsed;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[generate-report] Function started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[generate-report] Missing Authorization header");
      return new Response(JSON.stringify({ error: "No auth header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify user identity with service role
    const serviceClient = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) {
      console.error("[generate-report] Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // User-scoped client for RPC calls that use auth.uid()
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for direct data queries
    const supabase = serviceClient;

    const body = await req.json();
    const { group_id, format = 'pdf', start_date, end_date } = body;

    console.log("[generate-report] Request parameters:", { group_id, format, start_date, end_date, user_id: user.id });

    if (!group_id) {
      return new Response(JSON.stringify({ error: "group_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const startDate = parseIsoDate(start_date, "start_date");
    const endDate = parseIsoDate(end_date, "end_date");

    if (startDate > endDate) {
      return new Response(JSON.stringify({ error: "start_date must be before or equal to end_date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rangeMs = endDate.getTime() - startDate.getTime();
    const rangeDays = Math.floor(rangeMs / (1000 * 60 * 60 * 24)) + 1;
    if (rangeDays > MAX_RANGE_DAYS) {
      return new Response(JSON.stringify({ error: `date range cannot exceed ${MAX_RANGE_DAYS} days` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startDateTime = `${start_date}T00:00:00.000Z`;
    const endDateTime = `${end_date}T23:59:59.999Z`;

    console.log("[generate-report] Fetching data for cycle:", { startDateTime, endDateTime, rangeDays });

    const [groupRes, expensesRes, balancesRes, paymentsRes] = await Promise.all([
      supabase.from("groups").select("name").eq("id", group_id).maybeSingle(),
      supabase
        .from("expenses")
        .select("title, amount, category, expense_type, created_at, purchase_date, created_by")
        .eq("group_id", group_id)
        .gte("purchase_date", startDateTime)
        .lte("purchase_date", endDateTime)
        .order("purchase_date"),
      // Use user-scoped client because get_member_balances checks auth.uid()
      userClient.rpc("get_member_balances", { _group_id: group_id }),
      supabase
        .from("payments")
        .select("amount, status, created_at")
        .eq("group_id", group_id)
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime),
    ]);

    if (groupRes.error) console.error("[generate-report] Group fetch error:", groupRes.error);
    if (expensesRes.error) console.error("[generate-report] Expenses fetch error:", expensesRes.error);
    if (balancesRes.error) console.error("[generate-report] Balances RPC error:", balancesRes.error);

    const groupName = groupRes.data?.name ?? "República";
    const expenses = expensesRes.data ?? [];
    const balances = balancesRes.data ?? [];
    const payments = paymentsRes.data ?? [];

    console.log("[generate-report] Data retrieved:", {
      expenses_count: expenses.length,
      balances_count: balances.length,
      payments_count: payments.length,
    });

    // Collect user IDs for names
    const userIds = new Set<string>();
    balances.forEach((b: any) => userIds.add(b.user_id));
    expenses.forEach((e: any) => userIds.add(e.created_by));

    let nameMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", Array.from(userIds));
      (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name; });
    }

    let fileData = "";
    let contentType = "";

    if (format === 'csv') {
      console.log("[generate-report] Generating CSV");
      contentType = "text/csv";
      const header = ["Data", "Título", "Categoria", "Tipo", "Valor", "Criado Por"].join(",");
      const rows = expenses.map((e: any) => {
        const date = new Date(e.purchase_date || e.created_at).toLocaleDateString("pt-BR");
        const name = nameMap[e.created_by] || "Desconhecido";
        return [
          escapeCsv(date),
          escapeCsv(e.title),
          escapeCsv(e.category),
          escapeCsv(e.expense_type),
          e.amount,
          escapeCsv(name),
        ].join(",");
      });

      const csvContent = [header, ...rows].join("\n");
      const encoder = new TextEncoder();
      fileData = encodeBase64(encoder.encode(csvContent));
    } else {
      console.log("[generate-report] Generating PDF");
      contentType = "application/pdf";
      const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
      const totalPayments = payments.filter((p: any) => p.status === "confirmed").reduce((s: number, p: any) => s + Number(p.amount), 0);
      const periodLabel = `${start_date} até ${end_date}`;

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let page = pdfDoc.addPage();
      let { height } = page.getSize();
      let y = height - 50;
      const margin = 50;

      const drawText = (text: string, options: any = {}) => {
        const size = options.size || 10;
        const f = options.font || font;
        if (y < margin + 20) {
          page = pdfDoc.addPage();
          y = height - margin;
        }
        page.drawText(text, { x: margin, y, size, font: f, ...options });
        y -= (size + 5);
      };

      drawText(`RELATORIO MENSAL - ${groupName.toUpperCase()}`, { size: 18, font: fontBold });
      y -= 10;
      drawText(`Periodo: ${periodLabel}`, { size: 12 });
      y -= 20;

      drawText("RESUMO", { size: 14, font: fontBold });
      drawText(`Total de despesas: R$ ${totalExpenses.toFixed(2)}`);
      drawText(`Pagamentos confirmados: R$ ${totalPayments.toFixed(2)}`);
      y -= 20;

      drawText("DESPESAS DO MES", { size: 14, font: fontBold });
      if (expenses.length === 0) {
        drawText("Nenhuma despesa registrada.");
      } else {
        for (const e of expenses) {
          const date = new Date(e.purchase_date || e.created_at).toLocaleDateString("pt-BR");
          const type = e.expense_type === "collective" ? "Coletiva" : "Individual";
          const title = e.title.length > 40 ? e.title.substring(0, 40) + "..." : e.title;
          drawText(`${date} | R$ ${Number(e.amount).toFixed(2)} | ${type} | ${title}`);
        }
      }
      y -= 20;

      drawText("SALDOS", { size: 14, font: fontBold });
      if (balances.length === 0) {
        drawText("Nenhum saldo calculado.");
      } else {
        for (const b of balances) {
          const name = nameMap[b.user_id] || "Desconhecido";
          drawText(`${name}: Saldo R$ ${Number(b.balance).toFixed(2)} (Devido: R$ ${Number(b.total_owed).toFixed(2)})`);
        }
      }

      const pdfBytes = await pdfDoc.save();
      fileData = encodeBase64(pdfBytes);
    }

    console.log("[generate-report] File generated successfully");

    const monthStamp = start_date.slice(0, 7);
    const extension = format === "csv" ? "csv" : "pdf";
    const filename = `relatorio-${monthStamp}.${extension}`;

    return new Response(JSON.stringify({ file: fileData, contentType, filename }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[generate-report] Unexpected error:", err);
    if (err?.message?.includes("start_date") || err?.message?.includes("end_date")) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
