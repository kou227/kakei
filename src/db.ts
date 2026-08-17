import Dexie, { type EntityTable } from "dexie";
import type {
  AppSettings,
  Budget,
  Category,
  MonthRule,
  Transaction,
} from "./types";

class KakeiboDatabase extends Dexie {
  transactions!: EntityTable<Transaction, "id">;
  categories!: EntityTable<Category, "id">;
  budgets!: EntityTable<Budget, "id">;
  monthRules!: EntityTable<MonthRule, "id">;
  settings!: EntityTable<AppSettings, "id">;

  constructor() {
    super("kakeiboDB");

    this.version(1).stores({
      transactions: "id, date, type, categoryId, createdAt",
      categories: "id, type, sortOrder, isArchived",
      budgets: "id, scope, categoryId, kind, householdMonthId",
      monthRules: "id, effectiveFrom",
      settings: "id",
    });
  }
}

export const db = new KakeiboDatabase();

const now = new Date().toISOString();

const initialCategories: Category[] = [
  { id: "expense-food", type: "expense", name: "食費", color: "#4CAF50", icon: "🍚", sortOrder: 1, isArchived: false, createdAt: now },
  { id: "expense-eating-out", type: "expense", name: "外食費", color: "#FF9800", icon: "🍴", sortOrder: 2, isArchived: false, createdAt: now },
  { id: "expense-daily", type: "expense", name: "日用品", color: "#607D8B", icon: "🧻", sortOrder: 3, isArchived: false, createdAt: now },
  { id: "expense-clothes", type: "expense", name: "衣服", color: "#9C27B0", icon: "👕", sortOrder: 4, isArchived: false, createdAt: now },
  { id: "expense-gacha", type: "expense", name: "ガチャガチャ", color: "#E91E63", icon: "🎲", sortOrder: 5, isArchived: false, createdAt: now },
  { id: "expense-ufo", type: "expense", name: "UFOキャッチャー", color: "#673AB7", icon: "🕹️", sortOrder: 6, isArchived: false, createdAt: now },
  { id: "expense-other", type: "expense", name: "その他", color: "#795548", icon: "📦", sortOrder: 7, isArchived: false, createdAt: now },
  { id: "income-salary", type: "income", name: "給料", color: "#2196F3", icon: "💼", sortOrder: 1, isArchived: false, createdAt: now },
  { id: "income-support", type: "income", name: "仕送り", color: "#03A9F4", icon: "💴", sortOrder: 2, isArchived: false, createdAt: now },
  { id: "income-other", type: "income", name: "その他", color: "#00BCD4", icon: "✨", sortOrder: 3, isArchived: false, createdAt: now },
];

export async function initializeDatabase() {
  if ((await db.categories.count()) === 0) {
    await db.categories.bulkAdd(initialCategories);
  }

  if (!(await db.settings.get("app"))) {
    await db.settings.add({
      id: "app",
      theme: "system",
      currency: "JPY",
      defaultInputType: "expense",
    });
  }

  if ((await db.monthRules.count()) === 0) {
    await db.monthRules.add({
      id: crypto.randomUUID(),
      startDay: 1,
      effectiveFrom: "1970-01-01",
    });
  }
}
