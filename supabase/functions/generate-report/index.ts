import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    // Create client with user's JWT — uses RLS automatically
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user via built-in JWT validation (verify_jwt = true in config.toml)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { group_id } = await req.json();
    if (!group_id) {
      return new Response(JSON.stringify({ error: "group_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify membership via RLS-protected RPC
    const { data: isMember } = await supabase.rpc("is_member_of_group", { _user_id: user.id, _group_id: group_id });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Not a member" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch data — all queries go through RLS with user's JWT
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const [groupRes, expensesRes, balancesRes, paymentsRes] = await Promise.all([
      supabase.from("groups").select("name").eq("id", group_id).single(),
      supabase.from("expenses").select("title, amount, category, expense_type, created_at").eq("group_id", group_id).gte("created_at", startOfMonth).lte("created_at", endOfMonth).order("created_at"),
      supabase.rpc("get_member_balances", { _group_id: group_id }),
      supabase.from("payments").select("amount, status, created_at").eq("group_id", group_id).gte("created_at", startOfMonth).lte("created_at", endOfMonth),
    ]);

    const groupName = groupRes.data?.name ?? "República";
    const expenses = expensesRes.data ?? [];
    const balances = balancesRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const totalPayments = payments.filter((p: any) => p.status === "confirmed").reduce((s: number, p: any) => s + Number(p.amount), 0);

    // Fetch member names
    const userIds = balances.map((b: any) => b.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    const nameMap: Record<string, string> = {};
    (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name; });

    const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    // Generate PDF manually (minimal PDF)
    const lines: string[] = [];
    lines.push(`RELATÓRIO MENSAL - ${groupName.toUpperCase()}`);
    lines.push(`Período: ${monthName}`);
    lines.push(`Gerado em: ${now.toLocaleDateString("pt-BR")}`);
    lines.push("");
    lines.push("=== RESUMO ===");
    lines.push(`Total de despesas: R$ ${totalExpenses.toFixed(2)}`);
    lines.push(`Pagamentos confirmados: R$ ${totalPayments.toFixed(2)}`);
    lines.push(`Número de despesas: ${expenses.length}`);
    lines.push("");
    lines.push("=== DESPESAS ===");
    expenses.forEach((e: any) => {
      const date = new Date(e.created_at).toLocaleDateString("pt-BR");
      lines.push(`${date} | ${e.title} | R$ ${Number(e.amount).toFixed(2)} | ${e.expense_type === "collective" ? "Coletiva" : "Individual"}`);
    });
    lines.push("");
    lines.push("=== SALDOS POR MORADOR ===");
    balances.forEach((b: any) => {
      const name = nameMap[b.user_id] || "Desconhecido";
      lines.push(`${name}: Deve R$ ${Number(b.total_owed).toFixed(2)} | Pagou R$ ${Number(b.total_paid).toFixed(2)} | Saldo: R$ ${Number(b.balance).toFixed(2)}`);
    });

    // Create a simple PDF
    const content = lines.join("\n");
    const pdfBytes = createSimplePDF(content, groupName, monthName);
    const base64 = btoa(String.fromCharCode(...pdfBytes));

    return new Response(JSON.stringify({ pdf: base64 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Report error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function createSimplePDF(content: string, title: string, subtitle: string): Uint8Array {
  const lines = content.split("\n");
  const pageHeight = 842;
  const pageWidth = 595;
  const margin = 50;
  const lineHeight = 14;
  const maxLinesPerPage = Math.floor((pageHeight - 2 * margin) / lineHeight);

  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    pages.push(lines.slice(i, i + maxLinesPerPage));
  }

  const objects: string[] = [];
  const offsets: number[] = [];
  let currentOffset = 0;

  const addObject = (obj: string) => {
    offsets.push(currentOffset);
    objects.push(obj);
    currentOffset += new TextEncoder().encode(obj).length;
  };

  const header = "%PDF-1.4\n";
  currentOffset = header.length;

  addObject(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  const pageRefs = pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
  addObject(`2 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>\nendobj\n`);

  const fontObjNum = 3 + pages.length * 2;

  pages.forEach((pageLines, pageIdx) => {
    const pageObjNum = 3 + pageIdx * 2;
    const contentObjNum = 4 + pageIdx * 2;

    let stream = "BT\n";
    stream += `/F1 10 Tf\n`;
    stream += `${margin} ${pageHeight - margin} Td\n`;
    pageLines.forEach((line) => {
      const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      stream += `(${escaped}) Tj\n`;
      stream += `0 -${lineHeight} Td\n`;
    });
    stream += "ET\n";

    addObject(`${contentObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);
    addObject(`${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>\nendobj\n`);
  });

  addObject(`${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  let pdf = header;
  objects.forEach((obj) => { pdf += obj; });

  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += `0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off + header.length).padStart(10, "0")} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}
