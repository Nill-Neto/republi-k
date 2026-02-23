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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);

    let notificationsCreated = 0;

    // 1. Expenses due tomorrow
    const { data: dueSoon } = await supabase
      .from("expenses")
      .select("id, title, amount, group_id, due_date")
      .eq("due_date", tomorrowStr);

    for (const expense of dueSoon ?? []) {
      // Get unpaid splits for this expense
      const { data: splits } = await supabase
        .from("expense_splits")
        .select("user_id")
        .eq("expense_id", expense.id)
        .eq("status", "pending");

      for (const split of splits ?? []) {
        await supabase.from("notifications").insert({
          user_id: split.user_id,
          group_id: expense.group_id,
          title: "Despesa vence amanhã",
          message: `"${expense.title}" de R$ ${Number(expense.amount).toFixed(2)} vence amanhã.`,
          type: "due_reminder",
          data: { expense_id: expense.id },
        });
        notificationsCreated++;
      }
    }

    // 2. Overdue expenses (past due date, still pending)
    const { data: overdue } = await supabase
      .from("expenses")
      .select("id, title, amount, group_id, due_date")
      .lt("due_date", todayStr)
      .eq("paid_to_provider", false);

    for (const expense of overdue ?? []) {
      const { data: splits } = await supabase
        .from("expense_splits")
        .select("user_id")
        .eq("expense_id", expense.id)
        .eq("status", "pending");

      for (const split of splits ?? []) {
        // Check if we already sent an overdue notification today
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", split.user_id)
          .eq("type", "overdue_reminder")
          .gte("created_at", todayStr)
          .limit(1);

        if (!existing?.length) {
          await supabase.from("notifications").insert({
            user_id: split.user_id,
            group_id: expense.group_id,
            title: "Despesa vencida",
            message: `"${expense.title}" de R$ ${Number(expense.amount).toFixed(2)} está vencida desde ${expense.due_date}.`,
            type: "overdue_reminder",
            data: { expense_id: expense.id },
          });
          notificationsCreated++;
        }
      }
    }

    // 3. Low stock alerts (once per day)
    const { data: lowStock } = await supabase
      .from("inventory_items")
      .select("id, name, quantity, min_quantity, group_id");

    const lowItems = (lowStock ?? []).filter((i: any) => Number(i.quantity) <= Number(i.min_quantity));
    
    // Group low items by group_id
    const byGroup: Record<string, any[]> = {};
    lowItems.forEach((item: any) => {
      if (!byGroup[item.group_id]) byGroup[item.group_id] = [];
      byGroup[item.group_id].push(item);
    });

    for (const [groupId, items] of Object.entries(byGroup)) {
      // Get admin(s) of this group
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("group_id", groupId)
        .eq("role", "admin");

      for (const admin of admins ?? []) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", admin.user_id)
          .eq("type", "low_stock")
          .gte("created_at", todayStr)
          .limit(1);

        if (!existing?.length) {
          const names = items.map((i: any) => i.name).slice(0, 5).join(", ");
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            group_id: groupId,
            title: "Estoque baixo",
            message: `${items.length} ${items.length === 1 ? "item" : "itens"} com estoque baixo: ${names}`,
            type: "low_stock",
            data: { count: items.length },
          });
          notificationsCreated++;
        }
      }
    }

    // 4. Pending payments waiting admin confirmation
    const { data: pendingPayments } = await supabase
      .from("payments")
      .select("id, amount, group_id, paid_by, created_at")
      .eq("status", "pending");

    // Payments pending for more than 24h
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const stalePending = (pendingPayments ?? []).filter((p: any) => p.created_at < oneDayAgo);
    
    const staleByGroup: Record<string, any[]> = {};
    stalePending.forEach((p: any) => {
      if (!staleByGroup[p.group_id]) staleByGroup[p.group_id] = [];
      staleByGroup[p.group_id].push(p);
    });

    for (const [groupId, pmts] of Object.entries(staleByGroup)) {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("group_id", groupId)
        .eq("role", "admin");

      for (const admin of admins ?? []) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", admin.user_id)
          .eq("type", "pending_payments_reminder")
          .gte("created_at", todayStr)
          .limit(1);

        if (!existing?.length) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            group_id: groupId,
            title: "Pagamentos aguardando confirmação",
            message: `${pmts.length} ${pmts.length === 1 ? "pagamento" : "pagamentos"} aguardando sua confirmação há mais de 24h.`,
            type: "pending_payments_reminder",
            data: { count: pmts.length },
          });
          notificationsCreated++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, notifications_created: notificationsCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Check notifications error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
