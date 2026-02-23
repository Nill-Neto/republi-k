import type { Database } from "./types";

type ExpenseInstallmentsTable = {
  Row: {
    id: string;
    user_id: string;
    expense_id: string;
    installment_number: number;
    amount: number;
    bill_month: number;
    bill_year: number;
    created_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    expense_id: string;
    installment_number: number;
    amount: number;
    bill_month: number;
    bill_year: number;
    created_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    expense_id?: string;
    installment_number?: number;
    amount?: number;
    bill_month?: number;
    bill_year?: number;
    created_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "expense_installments_expense_id_fkey";
      columns: ["expense_id"];
      isOneToOne: false;
      referencedRelation: "expenses";
      referencedColumns: ["id"];
    }
  ];
};

type CreditCardTable = {
  Row: {
    id: string;
    user_id: string;
    label: string;
    brand: string;
    limit_amount: number | null;
    closing_day: number;
    due_day: number;
    created_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    label: string;
    brand: string;
    limit_amount?: number | null;
    closing_day: number;
    due_day: number;
    created_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    label?: string;
    brand?: string;
    limit_amount?: number | null;
    closing_day?: number;
    due_day?: number;
    created_at?: string;
  };
  Relationships: [];
};

type UpdatedExpensesTable = Omit<Database["public"]["Tables"]["expenses"], "Row" | "Insert" | "Update"> & {
  Row: Database["public"]["Tables"]["expenses"]["Row"] & {
    payment_method: string;
    credit_card_id: string | null;
    installments: number;
    purchase_date: string;
  };
  Insert: Database["public"]["Tables"]["expenses"]["Insert"] & {
    payment_method?: string;
    credit_card_id?: string | null;
    installments?: number;
    purchase_date?: string;
  };
  Update: Database["public"]["Tables"]["expenses"]["Update"] & {
    payment_method?: string;
    credit_card_id?: string | null;
    installments?: number;
    purchase_date?: string;
  };
};

type PublicSchema = Database["public"];

export type ExtendedDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Tables"> & {
    Tables: Omit<PublicSchema["Tables"], "expenses"> & {
      credit_cards: CreditCardTable;
      expenses: UpdatedExpensesTable;
      expense_installments: ExpenseInstallmentsTable;
    };
  };
};