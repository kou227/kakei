export type TransactionType = "expense" | "income";

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  date: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  type: TransactionType;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
};

export type Budget = {
  id: string;
  scope: "overall" | "category";
  categoryId?: string;
  amount: number;
  kind: "default" | "monthly";
  householdMonthId?: string;
};

export type MonthRule = {
  id: string;
  startDay: number;
  effectiveFrom: string;
};

export type AppSettings = {
  id: "app";
  theme: "light" | "dark" | "system";
  currency: "JPY";
  defaultInputType: TransactionType;
};
