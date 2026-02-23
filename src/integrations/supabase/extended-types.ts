import type { Database } from "./types";

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

type PersonalExpensesTable = {
  Row: {
    id: string;
    user_id: string;
    title: string;
    amount: number;
    payment_method: string;
    purchase_date: string;
    credit_card_id: string | null;
    installments: number;
    created_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    title: string;
    amount: number;
    payment_method: string;
    purchase_date: string;
    credit_card_id?: string | null;
    installments?: number;
    created_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    title?: string;
    amount?: number;
    payment_method?: string;
    purchase_date?: string;
    credit_card_id?: string | null;
    installments?: number;
    created_at?: string;
  };
  Relationships: [];
};

type PersonalExpenseInstallmentsTable = {
  Row: {
    id: string;
    user_id: string;
    personal_expense_id: string;
    installment_number: number;
    amount: number;
    bill_month: number;
    bill_year: number;
    created_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    personal_expense_id: string;
    installment_number: number;
    amount: number;
    bill_month: number;
    bill_year: number;
    created_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    personal_expense_id?: string;
    installment_number?: number;
    amount?: number;
    bill_month?: number;
    bill_year?: number;
    created_at?: string;
  };
  Relationships: [];
};

type PublicSchema = Database["public"];

export type ExtendedDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Tables"> & {
    Tables: PublicSchema["Tables"] & {
      credit_cards: CreditCardTable;
      personal_expenses: PersonalExpensesTable;
      personal_expense_installments: PersonalExpenseInstallmentsTable;
    };
  };
};