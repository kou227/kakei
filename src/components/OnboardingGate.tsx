import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Budget, Category, MonthRule } from "../types";
import { db } from "../db";
import "./OnboardingGate.css";

const STORAGE_KEY = "kakei-onboarding-completed-v1";

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

export function OnboardingGate({
  children,
}: {
  children: ReactNode;
}) {
  const categories = useLiveQuery<Category[]>(
    () =>
      db.categories
        .filter((category) => !category.isArchived)
        .sortBy("sortOrder"),
    [],
  ) ?? [];

  const monthRules = useLiveQuery<MonthRule[]>(
    () => db.monthRules.toArray(),
    [],
  ) ?? [];

  const budgets = useLiveQuery<Budget[]>(
    () => db.budgets.toArray(),
    [],
  ) ?? [];

  const [completed, setCompleted] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "1",
  );

  const initialStartDay = useMemo(() => {
    if (!monthRules.length) return 1;

    const sorted = [...monthRules].sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom),
    );

    return sorted[0]?.startDay ?? 1;
  }, [monthRules]);

  const initialBudget = useMemo(() => {
    const budget = budgets.find(
      (item) =>
        item.scope === "overall" &&
        item.kind === "default",
    );

    return budget?.amount;
  }, [budgets]);

  if (completed) {
    return <>{children}</>;
  }

  return (
    <OnboardingScreen
      categories={categories}
      initialStartDay={initialStartDay}
      initialBudget={initialBudget}
      monthRules={monthRules}
      budgets={budgets}
      onComplete={() => {
        localStorage.setItem(STORAGE_KEY, "1");
        setCompleted(true);
      }}
    />
  );
}

function OnboardingScreen({
  categories,
  initialStartDay,
  initialBudget,
  monthRules,
  budgets,
  onComplete,
}: {
  categories: Category[];
  initialStartDay: number;
  initialBudget?: number;
  monthRules: MonthRule[];
  budgets: Budget[];
  onComplete: () => void;
}) {
  const [startDay, setStartDay] = useState(
    String(initialStartDay),
  );

  const [budgetInput, setBudgetInput] = useState(
    initialBudget !== undefined
      ? initialBudget.toLocaleString("ja-JP")
      : "",
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const expenseCategories = categories.filter(
    (category) => category.type === "expense",
  );

  const incomeCategories = categories.filter(
    (category) => category.type === "income",
  );

  async function completeSetup() {
    const selectedStartDay = Number(startDay);

    if (
      !Number.isInteger(selectedStartDay) ||
      selectedStartDay < 1 ||
      selectedStartDay > 28
    ) {
      setMessage("月の開始日は1〜28日から選択してください。");
      return;
    }

    const budgetAmount = parseAmount(budgetInput);

    setSaving(true);
    setMessage("");

    try {
      /*
       * 初回設定では「次月から」ではなく、
       * アプリ全体の最初の基準ルールを書き換える。
       * これにより開始直後から選択した日で家計簿月を計算する。
       */
      const sortedRules = [...monthRules].sort((a, b) =>
        a.effectiveFrom.localeCompare(b.effectiveFrom),
      );

      const baseRule = sortedRules[0];

      if (baseRule) {
        await db.monthRules.update(baseRule.id, {
          startDay: selectedStartDay,
          effectiveFrom: "1970-01-01",
        });
      } else {
        await db.monthRules.add({
          id: crypto.randomUUID(),
          startDay: selectedStartDay,
          effectiveFrom: "1970-01-01",
        });
      }

      const defaultBudget = budgets.find(
        (item) =>
          item.scope === "overall" &&
          item.kind === "default",
      );

      if (budgetAmount === undefined) {
        if (defaultBudget) {
          await db.budgets.delete(defaultBudget.id);
        }
      } else if (defaultBudget) {
        await db.budgets.update(defaultBudget.id, {
          amount: budgetAmount,
        });
      } else {
        await db.budgets.add({
          id: crypto.randomUUID(),
          scope: "overall",
          amount: budgetAmount,
          kind: "default",
        });
      }

      onComplete();
    } catch (error) {
      console.error(error);
      setMessage("設定の保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="onboarding">
      <section className="onboarding-card">
        <div className="onboarding-heading">
          <div className="onboarding-app-icon">¥</div>

          <div>
            <p className="onboarding-eyebrow">
              はじめの設定
            </p>
            <h1>家計簿を始めましょう</h1>
          </div>
        </div>

        <p className="onboarding-lead">
          最初に家計簿の1か月の区切りと、
          月全体の基本予算を設定します。
          どちらもあとから設定画面で変更できます。
        </p>

        <div className="onboarding-section">
          <div className="onboarding-section-title">
            <span className="onboarding-step">1</span>
            <div>
              <strong>月の開始日</strong>
              <small>
                給料日などに合わせて1〜28日から選べます。
              </small>
            </div>
          </div>

          <label className="onboarding-field">
            <span>毎月</span>
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
                <option key={day} value={day}>
                  {day}日
                </option>
              ))}
            </select>
            <span>から開始</span>
          </label>

          <p className="onboarding-example">
            例：25日開始なら「7/25〜8/24」が
            「7月分」になります。
          </p>
        </div>

        <div className="onboarding-section">
          <div className="onboarding-section-title">
            <span className="onboarding-step">2</span>
            <div>
              <strong>月全体の基本予算</strong>
              <small>
                未定なら空欄のまま始めても大丈夫です。
              </small>
            </div>
          </div>

          <label className="onboarding-budget-field">
            <span>¥</span>
            <input
              inputMode="numeric"
              value={budgetInput}
              onChange={(event) =>
                setBudgetInput(
                  formatAmount(event.target.value),
                )
              }
              placeholder="例：80,000"
            />
          </label>
        </div>

        <div className="onboarding-section">
          <div className="onboarding-section-title">
            <span className="onboarding-step">
              <Check size={15} />
            </span>
            <div>
              <strong>初期カテゴリ</strong>
              <small>
                この内容で始めます。あとから追加・編集できます。
              </small>
            </div>
          </div>

          <div className="onboarding-category-group">
            <span className="onboarding-category-label">
              支出
            </span>

            <div className="onboarding-category-chips">
              {expenseCategories.map((category) => (
                <span
                  className="onboarding-category-chip"
                  key={category.id}
                >
                  <span>{category.icon}</span>
                  {category.name}
                </span>
              ))}
            </div>
          </div>

          <div className="onboarding-category-group">
            <span className="onboarding-category-label">
              収入
            </span>

            <div className="onboarding-category-chips">
              {incomeCategories.map((category) => (
                <span
                  className="onboarding-category-chip"
                  key={category.id}
                >
                  <span>{category.icon}</span>
                  {category.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {message && (
          <p className="onboarding-error">{message}</p>
        )}

        <button
          type="button"
          className="onboarding-start-button"
          onClick={completeSetup}
          disabled={saving}
        >
          {saving ? "保存中..." : "この設定で始める"}
          {!saving && <ChevronRight size={19} />}
        </button>

        <p className="onboarding-footnote">
          既に登録されている取引データがある場合も削除されません。
        </p>
      </section>
    </main>
  );
}
