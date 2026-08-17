import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "../db";
import type { Budget, Category, Transaction } from "../types";
import { DayDetailModal } from "../components/DayDetailModal";
import {
  addMonths,
  formatShortDate,
  getCurrentHouseholdMonthLabel,
  getHouseholdMonth,
  parseDateString,
  toDateString,
} from "../utils/month";
import "./CalendarBudgetDetail.css";

function yen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function getCalendarDates(startDate: string, endDate: string) {
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);

  const leadingBlankCount = (start.getDay() + 6) % 7;
  const cells: Array<string | null> =
    Array(leadingBlankCount).fill(null);

  const cursor = new Date(start);

  while (cursor <= end) {
    cells.push(toDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

type SummaryDetail =
  | "income"
  | "expense"
  | "balance"
  | "budget"
  | null;

export function CalendarPage() {
  const monthRules = useLiveQuery(
    () => db.monthRules.toArray(),
    [],
    [],
  );

  const allCategories = useLiveQuery(
    () => db.categories.toArray(),
    [],
    [],
  );

  const initialLabel = useMemo(
    () => getCurrentHouseholdMonthLabel(monthRules),
    [],
  );

  const [labelYear, setLabelYear] =
    useState(initialLabel.year);

  const [labelMonth, setLabelMonth] =
    useState(initialLabel.month);

  const [
    didSyncInitialMonth,
    setDidSyncInitialMonth,
  ] = useState(false);

  const [selectedDate, setSelectedDate] =
    useState<string | null>(null);

  const [summaryDetail, setSummaryDetail] =
    useState<SummaryDetail>(null);

  useEffect(() => {
    if (
      monthRules.length &&
      !didSyncInitialMonth
    ) {
      const current =
        getCurrentHouseholdMonthLabel(
          monthRules,
        );

      setLabelYear(current.year);
      setLabelMonth(current.month);
      setDidSyncInitialMonth(true);
    }
  }, [monthRules, didSyncInitialMonth]);

  const householdMonth = useMemo(
    () =>
      getHouseholdMonth(
        monthRules,
        labelYear,
        labelMonth,
      ),
    [monthRules, labelYear, labelMonth],
  );

  const transactions = useLiveQuery(
    () =>
      db.transactions
        .where("date")
        .between(
          householdMonth.startDate,
          householdMonth.endDate,
          true,
          true,
        )
        .toArray(),
    [
      householdMonth.startDate,
      householdMonth.endDate,
    ],
    [],
  );

  const budgets = useLiveQuery(
    () => db.budgets.toArray(),
    [],
    [],
  );

  const calendarCells = useMemo(
    () =>
      getCalendarDates(
        householdMonth.startDate,
        householdMonth.endDate,
      ),
    [
      householdMonth.startDate,
      householdMonth.endDate,
    ],
  );

  const transactionsByDate = useMemo(() => {
    const map =
      new Map<string, Transaction[]>();

    for (const transaction of transactions) {
      const current =
        map.get(transaction.date) ?? [];

      current.push(transaction);
      map.set(transaction.date, current);
    }

    return map;
  }, [transactions]);

  const incomeTotal = transactions
    .filter(
      (item) => item.type === "income",
    )
    .reduce(
      (sum, item) => sum + item.amount,
      0,
    );

  const expenseTotal = transactions
    .filter(
      (item) => item.type === "expense",
    )
    .reduce(
      (sum, item) => sum + item.amount,
      0,
    );

  const balance =
    incomeTotal - expenseTotal;

  const monthlyBudget = budgets.find(
    (budget) =>
      budget.scope === "overall" &&
      budget.kind === "monthly" &&
      budget.householdMonthId ===
        householdMonth.id,
  );

  const defaultBudget = budgets.find(
    (budget) =>
      budget.scope === "overall" &&
      budget.kind === "default",
  );

  const activeBudget =
    monthlyBudget?.amount ??
    defaultBudget?.amount;

  const budgetRemaining =
    activeBudget === undefined
      ? undefined
      : activeBudget - expenseTotal;

  function moveMonth(delta: number) {
    const next = addMonths(
      labelYear,
      labelMonth,
      delta,
    );

    setLabelYear(next.year);
    setLabelMonth(next.month);
    setSelectedDate(null);
    setSummaryDetail(null);
  }

  const selectedTransactions =
    selectedDate
      ? transactionsByDate.get(selectedDate) ??
        []
      : [];

  return (
    <section className="page calendar-page">
      <header className="calendar-month-header">
        <button
          className="month-arrow"
          type="button"
          onClick={() => moveMonth(-1)}
        >
          <ChevronLeft size={24} />
        </button>

        <div>
          <h1>
            {householdMonth.labelYear}年
            {householdMonth.labelMonth}月分
          </h1>

          <p>
            {formatShortDate(
              householdMonth.startDate,
            )}
            {" ～ "}
            {formatShortDate(
              householdMonth.endDate,
            )}
          </p>
        </div>

        <button
          className="month-arrow"
          type="button"
          onClick={() => moveMonth(1)}
        >
          <ChevronRight size={24} />
        </button>
      </header>

      <div className="calendar-card">
        <div className="calendar-weekdays">
          {[
            "月",
            "火",
            "水",
            "木",
            "金",
            "土",
            "日",
          ].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarCells.map(
            (date, index) => {
              if (!date) {
                return (
                  <div
                    className="calendar-cell calendar-cell--blank"
                    key={`blank-${index}`}
                  />
                );
              }

              const dateTransactions =
                transactionsByDate.get(date) ??
                [];

              const income =
                dateTransactions
                  .filter(
                    (item) =>
                      item.type === "income",
                  )
                  .reduce(
                    (sum, item) =>
                      sum + item.amount,
                    0,
                  );

              const expense =
                dateTransactions
                  .filter(
                    (item) =>
                      item.type === "expense",
                  )
                  .reduce(
                    (sum, item) =>
                      sum + item.amount,
                    0,
                  );

              const parsedDate =
                parseDateString(date);

              /*
               * ここは以前調整したカレンダー枠線用クラス。
               * 左/右/上/下が空白になる境界を検出し、
               * styles.css 側の疑似要素で線を描画する。
               */
              const cellClassName = [
                "calendar-cell",
                dateTransactions.length
                  ? "calendar-cell--has-data"
                  : "",

                index % 7 === 0 ||
                !calendarCells[index - 1]
                  ? "calendar-cell--left-edge"
                  : "",

                index % 7 === 6 ||
                !calendarCells[index + 1]
                  ? "calendar-cell--right-edge"
                  : "",

                index < 7 ||
                !calendarCells[index - 7]
                  ? "calendar-cell--top-edge"
                  : "",

                index >=
                  calendarCells.length - 7 ||
                !calendarCells[index + 7]
                  ? "calendar-cell--bottom-edge"
                  : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  type="button"
                  className={cellClassName}
                  key={date}
                  onClick={() =>
                    setSelectedDate(date)
                  }
                >
                  <span className="calendar-cell__date">
                    {parsedDate.getDate()}
                  </span>

                  <span className="calendar-cell__amounts">
                    {expense > 0 && (
                      <small className="money money--expense">
                        -
                        {expense.toLocaleString(
                          "ja-JP",
                        )}
                      </small>
                    )}

                    {income > 0 && (
                      <small className="money money--income">
                        +
                        {income.toLocaleString(
                          "ja-JP",
                        )}
                      </small>
                    )}
                  </span>
                </button>
              );
            },
          )}
        </div>
      </div>

      <div className="summary-grid">
        <button
          className="summary-card"
          type="button"
          onClick={() =>
            setSummaryDetail("income")
          }
        >
          <span>収入合計</span>
          <strong className="money money--income">
            {yen(incomeTotal)}
          </strong>
        </button>

        <button
          className="summary-card"
          type="button"
          onClick={() =>
            setSummaryDetail("expense")
          }
        >
          <span>支出合計</span>
          <strong className="money money--expense">
            {yen(expenseTotal)}
          </strong>
        </button>

        <button
          className="summary-card"
          type="button"
          onClick={() =>
            setSummaryDetail("balance")
          }
        >
          <span>収支</span>

          <strong
            className={
              balance < 0
                ? "money money--expense"
                : "money money--income"
            }
          >
            {balance >= 0 ? "+" : "-"}
            {yen(Math.abs(balance))}
          </strong>
        </button>

        <button
          className="summary-card"
          type="button"
          onClick={() =>
            setSummaryDetail("budget")
          }
        >
          <span>予算残額</span>

          <strong
            className={
              budgetRemaining !== undefined &&
              budgetRemaining < 0
                ? "money money--expense"
                : ""
            }
          >
            {budgetRemaining === undefined
              ? "未設定"
              : `${
                  budgetRemaining >= 0
                    ? ""
                    : "-"
                }${yen(
                  Math.abs(
                    budgetRemaining,
                  ),
                )}`}
          </strong>
        </button>
      </div>

      {summaryDetail && (
        <SummaryDetailPanel
          type={summaryDetail}
          categories={allCategories}
          transactions={transactions}
          budgets={budgets}
          householdMonthId={
            householdMonth.id
          }
          incomeTotal={incomeTotal}
          expenseTotal={expenseTotal}
          balance={balance}
          activeBudget={activeBudget}
          budgetRemaining={
            budgetRemaining
          }
          onClose={() =>
            setSummaryDetail(null)
          }
        />
      )}

      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          transactions={
            selectedTransactions
          }
          categories={allCategories}
          onClose={() =>
            setSelectedDate(null)
          }
        />
      )}
    </section>
  );
}

function SummaryDetailPanel({
  type,
  categories,
  transactions,
  budgets,
  householdMonthId,
  incomeTotal,
  expenseTotal,
  balance,
  activeBudget,
  budgetRemaining,
  onClose,
}: {
  type: Exclude<
    SummaryDetail,
    null
  >;
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  householdMonthId: string;
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
  activeBudget?: number;
  budgetRemaining?: number;
  onClose: () => void;
}) {
  const categoryMap = new Map(
    categories.map((category) => [
      category.id,
      category,
    ]),
  );

  const targetType =
    type === "income"
      ? "income"
      : type === "expense"
        ? "expense"
        : null;

  const grouped =
    targetType === null
      ? []
      : Array.from(
          transactions
            .filter(
              (item) =>
                item.type === targetType,
            )
            .reduce(
              (map, item) => {
                map.set(
                  item.categoryId,
                  (map.get(
                    item.categoryId,
                  ) ?? 0) +
                    item.amount,
                );
                return map;
              },
              new Map<
                string,
                number
              >(),
            ),
        ).sort(
          (a, b) => b[1] - a[1],
        );

  return (
    <div className="summary-detail-card">
      <button
        className="summary-detail-card__close"
        type="button"
        onClick={onClose}
      >
        閉じる
      </button>

      {type === "income" && (
        <>
          <h2>
            収入合計 {yen(incomeTotal)}
          </h2>

          <CategorySummary
            grouped={grouped}
            categoryMap={categoryMap}
          />
        </>
      )}

      {type === "expense" && (
        <>
          <h2>
            支出合計 {yen(expenseTotal)}
          </h2>

          <CategorySummary
            grouped={grouped}
            categoryMap={categoryMap}
          />
        </>
      )}

      {type === "balance" && (
        <>
          <h2>
            収支{" "}
            {balance >= 0 ? "+" : "-"}
            {yen(Math.abs(balance))}
          </h2>

          <div className="balance-detail">
            <div>
              <span>収入</span>
              <strong className="money money--income">
                {yen(incomeTotal)}
              </strong>
            </div>

            <div>
              <span>支出</span>
              <strong className="money money--expense">
                {yen(expenseTotal)}
              </strong>
            </div>
          </div>
        </>
      )}

      {type === "budget" && (
        <BudgetDetail
          categories={categories}
          transactions={transactions}
          budgets={budgets}
          householdMonthId={
            householdMonthId
          }
          activeBudget={activeBudget}
          expenseTotal={expenseTotal}
          budgetRemaining={
            budgetRemaining
          }
        />
      )}
    </div>
  );
}

function BudgetDetail({
  categories,
  transactions,
  budgets,
  householdMonthId,
  activeBudget,
  expenseTotal,
  budgetRemaining,
}: {
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  householdMonthId: string;
  activeBudget?: number;
  expenseTotal: number;
  budgetRemaining?: number;
}) {
  const expenseByCategory =
    transactions
      .filter(
        (item) =>
          item.type === "expense",
      )
      .reduce(
        (map, item) => {
          map.set(
            item.categoryId,
            (map.get(item.categoryId) ??
              0) + item.amount,
          );
          return map;
        },
        new Map<string, number>(),
      );

  const categoryRows = categories
    .filter(
      (category) =>
        category.type === "expense",
    )
    .map((category) => {
      const monthly =
        budgets.find(
          (budget) =>
            budget.scope ===
              "category" &&
            budget.categoryId ===
              category.id &&
            budget.kind ===
              "monthly" &&
            budget.householdMonthId ===
              householdMonthId,
        );

      const defaultCategoryBudget =
        budgets.find(
          (budget) =>
            budget.scope ===
              "category" &&
            budget.categoryId ===
              category.id &&
            budget.kind ===
              "default",
        );

      const budget =
        monthly?.amount ??
        defaultCategoryBudget?.amount;

      const spent =
        expenseByCategory.get(
          category.id,
        ) ?? 0;

      return {
        category,
        budget,
        spent,
        remaining:
          budget === undefined
            ? undefined
            : budget - spent,
        isMonthly:
          monthly !== undefined,
      };
    })
    .filter(
      (row) =>
        row.spent > 0 ||
        row.budget !== undefined,
    )
    .sort((a, b) => {
      if (
        a.category.isArchived !==
        b.category.isArchived
      ) {
        return a.category.isArchived
          ? 1
          : -1;
      }

      return (
        a.category.sortOrder -
        b.category.sortOrder
      );
    });

  return (
    <>
      <h2>予算残額</h2>

      {activeBudget === undefined ? (
        <p className="muted-text">
          月全体の予算はまだ設定されていません。
        </p>
      ) : (
        <div className="balance-detail budget-overall-detail">
          <div>
            <span>月全体予算</span>
            <strong>
              {yen(activeBudget)}
            </strong>
          </div>

          <div>
            <span>使用済み</span>
            <strong className="money money--expense">
              {yen(expenseTotal)}
            </strong>
          </div>

          <div>
            <span>
              {budgetRemaining !==
                undefined &&
              budgetRemaining < 0
                ? "オーバー"
                : "残り"}
            </span>

            <strong
              className={
                budgetRemaining !==
                  undefined &&
                budgetRemaining < 0
                  ? "money money--expense"
                  : ""
              }
            >
              {budgetRemaining ===
              undefined
                ? "未設定"
                : yen(
                    Math.abs(
                      budgetRemaining,
                    ),
                  )}
            </strong>
          </div>
        </div>
      )}

      <div className="category-budget-detail-heading">
        <h3>カテゴリ別</h3>
        <span>
          予算設定済み、または支出のあるカテゴリ
        </span>
      </div>

      {categoryRows.length === 0 ? (
        <p className="muted-text">
          カテゴリ別予算・支出はまだありません。
        </p>
      ) : (
        <div className="category-budget-detail-list">
          {categoryRows.map(
            ({
              category,
              budget,
              spent,
              remaining,
              isMonthly,
            }) => {
              const percentage =
                budget !== undefined &&
                budget > 0
                  ? Math.min(
                      (spent / budget) *
                        100,
                      100,
                    )
                  : spent > 0
                    ? 100
                    : 0;

              const over =
                remaining !==
                  undefined &&
                remaining < 0;

              return (
                <div
                  className="category-budget-detail-row"
                  key={category.id}
                >
                  <div className="category-budget-detail-title">
                    <span
                      className="category-budget-detail-color"
                      style={{
                        backgroundColor:
                          category.color,
                      }}
                    />

                    <span className="category-budget-detail-icon">
                      {category.icon}
                    </span>

                    <div>
                      <strong>
                        {category.name}
                      </strong>

                      <small>
                        {isMonthly
                          ? "この月の個別予算"
                          : budget !==
                              undefined
                            ? "基本予算"
                            : "予算未設定"}
                        {category.isArchived
                          ? "・アーカイブ済み"
                          : ""}
                      </small>
                    </div>
                  </div>

                  <div className="category-budget-detail-values">
                    <span>
                      使用{" "}
                      <strong>
                        {yen(spent)}
                      </strong>
                    </span>

                    <span>
                      予算{" "}
                      <strong>
                        {budget ===
                        undefined
                          ? "未設定"
                          : yen(
                              budget,
                            )}
                      </strong>
                    </span>
                  </div>

                  {budget !== undefined && (
                    <div
                      className="category-budget-progress"
                      aria-label={`${category.name}の予算使用率`}
                    >
                      <span
                        style={{
                          width: `${percentage}%`,
                          backgroundColor:
                            over
                              ? "var(--expense)"
                              : category.color,
                        }}
                      />
                    </div>
                  )}

                  <div
                    className={
                      over
                        ? "category-budget-result category-budget-result--over"
                        : "category-budget-result"
                    }
                  >
                    {remaining ===
                    undefined ? (
                      <span>
                        予算を設定すると残額を確認できます
                      </span>
                    ) : over ? (
                      <>
                        <span>
                          予算を
                        </span>
                        <strong>
                          {yen(
                            Math.abs(
                              remaining,
                            ),
                          )}
                          オーバー
                        </strong>
                      </>
                    ) : (
                      <>
                        <span>
                          あと
                        </span>
                        <strong>
                          {yen(
                            remaining,
                          )}
                        </strong>
                      </>
                    )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}
    </>
  );
}

function CategorySummary({
  grouped,
  categoryMap,
}: {
  grouped: [string, number][];
  categoryMap: Map<
    string,
    Category
  >;
}) {
  if (!grouped.length) {
    return (
      <p className="muted-text">
        データはありません。
      </p>
    );
  }

  return (
    <div className="category-summary-list">
      {grouped.map(
        ([categoryId, amount]) => {
          const category =
            categoryMap.get(categoryId);

          return (
            <div
              className="category-summary-row"
              key={categoryId}
            >
              <span>
                {category?.icon}{" "}
                {category?.name ??
                  "不明なカテゴリ"}
              </span>

              <strong>
                {yen(amount)}
              </strong>
            </div>
          );
        },
      )}
    </div>
  );
}
