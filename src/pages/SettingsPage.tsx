import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ThemeSettings } from "./ThemeSettings";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  FileSpreadsheet,
  RotateCcw,
  Upload,
} from "lucide-react";
import { db } from "../db";
import type {
  AppSettings,
  Budget,
  Category,
  MonthRule,
  Transaction,
} from "../types";
import {
  addMonths,
  getCurrentHouseholdMonthLabel,
  getHouseholdMonth,
} from "../utils/month";
import "./SettingsPage.css";

function formatAmount(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("ja-JP") : "";
}

function parseAmount(value: string) {
  const normalized = value.replaceAll(",", "");
  if (!normalized) return undefined;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : undefined;
}

function yen(amount?: number) {
  if (amount === undefined) return "未設定";
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function downloadTextFile(
  filename: string,
  content: string,
  type: string,
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function backupTimestamp() {
  const now = new Date();

  const pad = (value: number) =>
    String(value).padStart(2, "0");

  return (
    `${now.getFullYear()}` +
    `${pad(now.getMonth() + 1)}` +
    `${pad(now.getDate())}_` +
    `${pad(now.getHours())}` +
    `${pad(now.getMinutes())}`
  );
}

function csvEscape(value: string | number) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

type BackupData = {
  format: "kakei-backup";
  version: 1;
  exportedAt: string;
  data: {
    transactions: Transaction[];
    categories: Category[];
    budgets: Budget[];
    monthRules: MonthRule[];
    settings: AppSettings[];
  };
};

function isBackupData(value: unknown): value is BackupData {
  if (
    typeof value !== "object" ||
    value === null ||
    !("format" in value) ||
    !("version" in value) ||
    !("data" in value)
  ) {
    return false;
  }

  const backup = value as Partial<BackupData>;

  if (
    backup.format !== "kakei-backup" ||
    backup.version !== 1 ||
    typeof backup.data !== "object" ||
    backup.data === null
  ) {
    return false;
  }

  const data = backup.data as Partial<BackupData["data"]>;

  return (
    Array.isArray(data.transactions) &&
    Array.isArray(data.categories) &&
    Array.isArray(data.budgets) &&
    Array.isArray(data.monthRules) &&
    Array.isArray(data.settings)
  );
}

export function SettingsPage() {
  const monthRules = useLiveQuery<MonthRule[]>(
    () => db.monthRules.toArray(),
    [],
  ) ?? [];

  const budgets = useLiveQuery<Budget[]>(
    () => db.budgets.toArray(),
    [],
  ) ?? [];

  const transactions = useLiveQuery<Transaction[]>(
    () => db.transactions.toArray(),
    [],
  ) ?? [];

  const categories = useLiveQuery<Category[]>(
    () => db.categories.toArray(),
    [],
  ) ?? [];

  const currentLabel = useMemo(
    () => getCurrentHouseholdMonthLabel(monthRules),
    [monthRules],
  );

  const currentHouseholdMonth = useMemo(
    () =>
      getHouseholdMonth(
        monthRules,
        currentLabel.year,
        currentLabel.month,
      ),
    [monthRules, currentLabel.year, currentLabel.month],
  );

  const nextLabel = useMemo(
    () => addMonths(currentLabel.year, currentLabel.month, 1),
    [currentLabel.year, currentLabel.month],
  );

  const nextHouseholdMonth = useMemo(
    () =>
      getHouseholdMonth(
        monthRules,
        nextLabel.year,
        nextLabel.month,
      ),
    [monthRules, nextLabel.year, nextLabel.month],
  );

  const [startDay, setStartDay] = useState(
    String(nextHouseholdMonth.startDay),
  );

  const [budgetYear, setBudgetYear] = useState(currentLabel.year);
  const [budgetMonth, setBudgetMonth] = useState(currentLabel.month);

  const selectedBudgetMonth = useMemo(
    () =>
      getHouseholdMonth(
        monthRules,
        budgetYear,
        budgetMonth,
      ),
    [monthRules, budgetYear, budgetMonth],
  );

  const defaultOverallBudget = budgets.find(
    (budget) =>
      budget.scope === "overall" &&
      budget.kind === "default",
  );

  const selectedMonthlyBudget = budgets.find(
    (budget) =>
      budget.scope === "overall" &&
      budget.kind === "monthly" &&
      budget.householdMonthId === selectedBudgetMonth.id,
  );

  const [defaultBudgetInput, setDefaultBudgetInput] =
    useState("");

  const [monthlyBudgetInput, setMonthlyBudgetInput] =
    useState("");

  const [message, setMessage] = useState("");

  const restoreInputRef = useRef<HTMLInputElement>(null);

  const archivedExpenseCategories = useMemo(
    () =>
      categories
        .filter(
          (category) =>
            category.type === "expense" &&
            category.isArchived,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const archivedIncomeCategories = useMemo(
    () =>
      categories
        .filter(
          (category) =>
            category.type === "income" &&
            category.isArchived,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  useEffect(() => {
    setStartDay(String(nextHouseholdMonth.startDay));
  }, [nextHouseholdMonth.startDay]);

  useEffect(() => {
    setDefaultBudgetInput(
      defaultOverallBudget
        ? defaultOverallBudget.amount.toLocaleString("ja-JP")
        : "",
    );
  }, [defaultOverallBudget?.amount]);

  useEffect(() => {
    setMonthlyBudgetInput(
      selectedMonthlyBudget
        ? selectedMonthlyBudget.amount.toLocaleString("ja-JP")
        : "",
    );
  }, [
    selectedMonthlyBudget?.amount,
    selectedBudgetMonth.id,
  ]);

  const hasScheduledChange =
    nextHouseholdMonth.startDay !==
    currentHouseholdMonth.startDay;

  function showMessage(text: string) {
    setMessage(text);

    window.setTimeout(() => {
      setMessage("");
    }, 3200);
  }

  async function handleStartDaySubmit(event: FormEvent) {
    event.preventDefault();

    const newStartDay = Number(startDay);

    if (
      !Number.isInteger(newStartDay) ||
      newStartDay < 1 ||
      newStartDay > 28
    ) {
      showMessage(
        "月の開始日は1〜28日から選択してください。",
      );
      return;
    }

    const effectiveFrom =
      `${nextLabel.year}-` +
      `${String(nextLabel.month).padStart(2, "0")}-01`;

    const existingRule = monthRules.find(
      (rule) => rule.effectiveFrom === effectiveFrom,
    );

    if (existingRule) {
      await db.monthRules.update(existingRule.id, {
        startDay: newStartDay,
      });
    } else {
      await db.monthRules.add({
        id: crypto.randomUUID(),
        startDay: newStartDay,
        effectiveFrom,
      });
    }

    showMessage(
      `${nextLabel.year}年${nextLabel.month}月分から` +
        `${newStartDay}日開始に変更します。`,
    );
  }

  async function saveDefaultBudget(event: FormEvent) {
    event.preventDefault();

    const amount = parseAmount(defaultBudgetInput);

    if (amount === undefined) {
      if (defaultOverallBudget) {
        await db.budgets.delete(defaultOverallBudget.id);
      }

      showMessage(
        "月全体の基本予算を未設定にしました。",
      );
      return;
    }

    if (defaultOverallBudget) {
      await db.budgets.update(defaultOverallBudget.id, {
        amount,
      });
    } else {
      await db.budgets.add({
        id: crypto.randomUUID(),
        scope: "overall",
        amount,
        kind: "default",
      });
    }

    showMessage(
      `月全体の基本予算を${yen(amount)}に設定しました。`,
    );
  }

  async function saveMonthlyBudget(event: FormEvent) {
    event.preventDefault();

    const amount = parseAmount(monthlyBudgetInput);

    if (amount === undefined) {
      if (selectedMonthlyBudget) {
        await db.budgets.delete(selectedMonthlyBudget.id);
      }

      showMessage(
        `${selectedBudgetMonth.labelYear}年` +
          `${selectedBudgetMonth.labelMonth}月分の個別予算を解除しました。`,
      );

      return;
    }

    if (selectedMonthlyBudget) {
      await db.budgets.update(selectedMonthlyBudget.id, {
        amount,
      });
    } else {
      await db.budgets.add({
        id: crypto.randomUUID(),
        scope: "overall",
        amount,
        kind: "monthly",
        householdMonthId: selectedBudgetMonth.id,
      });
    }

    showMessage(
      `${selectedBudgetMonth.labelYear}年` +
        `${selectedBudgetMonth.labelMonth}月分の予算を` +
        `${yen(amount)}に設定しました。`,
    );
  }

  function moveBudgetMonth(delta: number) {
    const next = addMonths(
      budgetYear,
      budgetMonth,
      delta,
    );

    setBudgetYear(next.year);
    setBudgetMonth(next.month);
  }

  const effectiveBudget =
    selectedMonthlyBudget?.amount ??
    defaultOverallBudget?.amount;

  async function exportJsonBackup() {
    const backup: BackupData = {
      format: "kakei-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        transactions:
          await db.transactions.toArray(),
        categories:
          await db.categories.toArray(),
        budgets:
          await db.budgets.toArray(),
        monthRules:
          await db.monthRules.toArray(),
        settings:
          await db.settings.toArray(),
      },
    };

    downloadTextFile(
      `kakei_backup_${backupTimestamp()}.json`,
      JSON.stringify(backup, null, 2),
      "application/json;charset=utf-8",
    );

    showMessage(
      "JSONバックアップを保存しました。",
    );
  }

  function exportCsv() {
    const categoryMap = new Map(
      categories.map((category) => [
        category.id,
        category.name,
      ]),
    );

    const rows = [...transactions]
      .sort((a, b) => {
        const dateCompare =
          a.date.localeCompare(b.date);

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return a.createdAt.localeCompare(b.createdAt);
      })
      .map((transaction) => [
        transaction.date,
        transaction.type === "expense"
          ? "支出"
          : "収入",
        transaction.amount,
        categoryMap.get(transaction.categoryId) ??
          "不明なカテゴリ",
        transaction.memo ?? "",
      ]);

    const header = [
      "日付",
      "種別",
      "金額",
      "カテゴリ",
      "メモ",
    ];

    const csv =
      "\uFEFF" +
      [header, ...rows]
        .map((row) =>
          row.map(csvEscape).join(","),
        )
        .join("\r\n");

    downloadTextFile(
      `kakei_transactions_${backupTimestamp()}.csv`,
      csv,
      "text/csv;charset=utf-8",
    );

    showMessage(
      "CSVを保存しました。",
    );
  }

  async function restoreJsonBackup(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);

      if (!isBackupData(parsed)) {
        showMessage(
          "このファイルは家計簿バックアップとして読み込めません。",
        );
        return;
      }

      const confirmed = window.confirm(
        "このバックアップを復元しますか？\n\n" +
          "現在の取引・カテゴリ・予算・月開始日設定は、" +
          "バックアップ内の内容に置き換わります。\n\n" +
          "復元前に現在のJSONバックアップを保存しておくことをおすすめします。",
      );

      if (!confirmed) {
        return;
      }

      await db.transaction(
        "rw",
        [
          db.transactions,
          db.categories,
          db.budgets,
          db.monthRules,
          db.settings,
        ],
        async () => {
          await db.transactions.clear();
          await db.categories.clear();
          await db.budgets.clear();
          await db.monthRules.clear();
          await db.settings.clear();

          if (parsed.data.categories.length) {
            await db.categories.bulkAdd(
              parsed.data.categories,
            );
          }

          if (parsed.data.transactions.length) {
            await db.transactions.bulkAdd(
              parsed.data.transactions,
            );
          }

          if (parsed.data.budgets.length) {
            await db.budgets.bulkAdd(
              parsed.data.budgets,
            );
          }

          if (parsed.data.monthRules.length) {
            await db.monthRules.bulkAdd(
              parsed.data.monthRules,
            );
          }

          if (parsed.data.settings.length) {
            await db.settings.bulkAdd(
              parsed.data.settings,
            );
          }
        },
      );

      showMessage(
        "バックアップを復元しました。",
      );
    } catch (error) {
      console.error(error);

      showMessage(
        "バックアップの復元に失敗しました。",
      );
    } finally {
      event.target.value = "";
    }
  }

  async function restoreArchivedCategory(
    categoryId: string,
    categoryName: string,
  ) {
    const targetCategory = categories.find(
      (category) => category.id === categoryId,
    );

    if (!targetCategory) {
      showMessage("カテゴリが見つかりませんでした。");
      return;
    }

    const sameTypeActiveCategories = categories.filter(
      (category) =>
        !category.isArchived &&
        category.type === targetCategory.type,
    );

    const maxSortOrder = sameTypeActiveCategories.reduce(
      (max, category) =>
        Math.max(max, category.sortOrder),
      0,
    );

    await db.categories.update(categoryId, {
      isArchived: false,
      sortOrder: maxSortOrder + 1,
    });

    showMessage(
      `「${categoryName}」をカテゴリ一覧に戻しました。`,
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>設定</h1>
      </header>

      <h2 className="settings-section-title">
        家計簿設定
      </h2>

      <form
        className="input-card"
        onSubmit={handleStartDaySubmit}
      >
        <div className="field">
          <span className="field__label">
            現在の月の開始日
          </span>

          <strong>
            {currentHouseholdMonth.startDay}日
          </strong>

          <small className="settings-help">
            {currentLabel.year}年
            {currentLabel.month}月分：
            {currentHouseholdMonth.startDate.replaceAll(
              "-",
              "/",
            )}
            {" ～ "}
            {currentHouseholdMonth.endDate.replaceAll(
              "-",
              "/",
            )}
          </small>
        </div>

        <label className="field">
          <span className="field__label">
            次の家計簿月からの開始日
          </span>

          <select
            value={startDay}
            onChange={(event) =>
              setStartDay(event.target.value)
            }
          >
            {Array.from(
              { length: 28 },
              (_, index) => index + 1,
            ).map((day) => (
              <option value={day} key={day}>
                {day}日
              </option>
            ))}
          </select>

          <small className="settings-help">
            {nextLabel.year}年
            {nextLabel.month}月分から適用されます。
          </small>
        </label>

        {hasScheduledChange && (
          <div className="settings-info-box">
            現在、
            {nextLabel.year}年
            {nextLabel.month}月分から
            <strong>
              {" "}
              {nextHouseholdMonth.startDay}日開始
            </strong>
            に変更する設定が保存されています。
          </div>
        )}

        <button
          className="primary-button primary-button--income"
          type="submit"
        >
          開始日を保存
        </button>
      </form>

      <h2 className="settings-section-title">
        月全体の予算
      </h2>

      <form
        className="input-card"
        onSubmit={saveDefaultBudget}
      >
        <div className="field">
          <span className="field__label">
            基本予算
          </span>

          <small className="settings-help">
            個別の月予算を設定していない月に使われます。
          </small>
        </div>

        <label className="field">
          <span className="field__label">
            月全体の基本予算
          </span>

          <div className="amount-field">
            <span>¥</span>
            <input
              inputMode="numeric"
              value={defaultBudgetInput}
              onChange={(event) =>
                setDefaultBudgetInput(
                  formatAmount(
                    event.target.value,
                  ),
                )
              }
              placeholder="未設定"
            />
          </div>
        </label>

        <button
          className="primary-button primary-button--income"
          type="submit"
        >
          基本予算を保存
        </button>
      </form>

      <div className="settings-card-gap" />

      <form
        className="input-card"
        onSubmit={saveMonthlyBudget}
      >
        <div className="calendar-month-header">
          <button
            className="month-arrow"
            type="button"
            onClick={() =>
              moveBudgetMonth(-1)
            }
          >
            <ChevronLeft size={22} />
          </button>

          <div>
            <h1 className="settings-month-title">
              {selectedBudgetMonth.labelYear}年
              {selectedBudgetMonth.labelMonth}月分
            </h1>

            <p>
              {selectedBudgetMonth.startDate.replaceAll(
                "-",
                "/",
              )}
              {" ～ "}
              {selectedBudgetMonth.endDate.replaceAll(
                "-",
                "/",
              )}
            </p>
          </div>

          <button
            className="month-arrow"
            type="button"
            onClick={() =>
              moveBudgetMonth(1)
            }
          >
            <ChevronRight size={22} />
          </button>
        </div>

        <label className="field">
          <span className="field__label">
            {selectedBudgetMonth.labelYear}年
            {selectedBudgetMonth.labelMonth}月分の予算
          </span>

          <div className="amount-field">
            <span>¥</span>
            <input
              inputMode="numeric"
              value={monthlyBudgetInput}
              onChange={(event) =>
                setMonthlyBudgetInput(
                  formatAmount(
                    event.target.value,
                  ),
                )
              }
              placeholder="基本予算を使用"
            />
          </div>

          <small className="settings-help">
            空欄で保存すると、この月だけの設定を解除して
            基本予算 {yen(defaultOverallBudget?.amount)} を使用します。
          </small>
        </label>

        <div className="settings-effective-budget">
          <small>
            この月に適用される予算
          </small>

          <strong>
            {yen(effectiveBudget)}
          </strong>

          {selectedMonthlyBudget && (
            <span>
              この月だけの個別予算を使用中
            </span>
          )}
        </div>

        <button
          className="primary-button primary-button--income"
          type="submit"
        >
          この月の予算を保存
        </button>
      </form>

      <h2 className="settings-section-title">
        表示設定
      </h2>

      <ThemeSettings />

      <h2 className="settings-section-title">
        アーカイブ済みカテゴリ
      </h2>

      <div className="settings-archive-card">
        <p className="settings-archive-description">
          アーカイブしたカテゴリは新しい取引では選べませんが、
          過去の取引データにはそのまま残ります。
          必要になったカテゴリはここから復元できます。
        </p>

        <div className="settings-archive-group">
          <div className="settings-archive-group-title">
            <strong>支出</strong>
            <span>{archivedExpenseCategories.length}件</span>
          </div>

          {archivedExpenseCategories.length === 0 ? (
            <p className="settings-archive-empty">
              アーカイブ済みの支出カテゴリはありません。
            </p>
          ) : (
            <div className="settings-archive-list">
              {archivedExpenseCategories.map((category) => (
                <div
                  className="settings-archive-row"
                  key={category.id}
                >
                  <span
                    className="settings-archive-color"
                    style={{
                      backgroundColor: category.color,
                    }}
                  />

                  <span className="settings-archive-icon">
                    {category.icon}
                  </span>

                  <span className="settings-archive-name">
                    {category.name}
                  </span>

                  <button
                    type="button"
                    className="settings-archive-restore"
                    onClick={() =>
                      restoreArchivedCategory(
                        category.id,
                        category.name,
                      )
                    }
                  >
                    <RotateCcw size={15} />
                    復元
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="settings-archive-group">
          <div className="settings-archive-group-title">
            <strong>収入</strong>
            <span>{archivedIncomeCategories.length}件</span>
          </div>

          {archivedIncomeCategories.length === 0 ? (
            <p className="settings-archive-empty">
              アーカイブ済みの収入カテゴリはありません。
            </p>
          ) : (
            <div className="settings-archive-list">
              {archivedIncomeCategories.map((category) => (
                <div
                  className="settings-archive-row"
                  key={category.id}
                >
                  <span
                    className="settings-archive-color"
                    style={{
                      backgroundColor: category.color,
                    }}
                  />

                  <span className="settings-archive-icon">
                    {category.icon}
                  </span>

                  <span className="settings-archive-name">
                    {category.name}
                  </span>

                  <button
                    type="button"
                    className="settings-archive-restore"
                    onClick={() =>
                      restoreArchivedCategory(
                        category.id,
                        category.name,
                      )
                    }
                  >
                    <RotateCcw size={15} />
                    復元
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <h2 className="settings-section-title">
        データ管理
      </h2>

      <div className="settings-data-card">
        <div className="settings-data-heading">
          <FileJson size={20} />
          <div>
            <strong>JSONバックアップ</strong>
            <small>
              取引・カテゴリ・予算・月開始日などをまとめて保存します。
            </small>
          </div>
        </div>

        <button
          type="button"
          className="settings-data-button"
          onClick={exportJsonBackup}
        >
          <Download size={18} />
          JSONバックアップを保存
        </button>
      </div>

      <div className="settings-data-card">
        <div className="settings-data-heading">
          <FileSpreadsheet size={20} />
          <div>
            <strong>CSV出力</strong>
            <small>
              取引履歴をExcelなどで確認できる形式で保存します。
            </small>
          </div>
        </div>

        <button
          type="button"
          className="settings-data-button"
          onClick={exportCsv}
        >
          <Download size={18} />
          取引履歴をCSVで保存
        </button>
      </div>

      <div className="settings-data-card settings-data-card--restore">
        <div className="settings-data-heading">
          <RotateCcw size={20} />
          <div>
            <strong>バックアップから復元</strong>
            <small>
              JSONバックアップの内容で現在のデータを置き換えます。
            </small>
          </div>
        </div>

        <input
          ref={restoreInputRef}
          className="settings-hidden-input"
          type="file"
          accept=".json,application/json"
          onChange={restoreJsonBackup}
        />

        <button
          type="button"
          className="settings-data-button settings-data-button--restore"
          onClick={() =>
            restoreInputRef.current?.click()
          }
        >
          <Upload size={18} />
          JSONファイルを選んで復元
        </button>

        <p className="settings-warning">
          復元すると現在のデータはバックアップ内の内容に置き換わります。
          復元前に現在のJSONバックアップを保存することをおすすめします。
        </p>
      </div>

      {message && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}
    </section>
  );
}
