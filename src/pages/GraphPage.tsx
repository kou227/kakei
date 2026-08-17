import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
} from "lucide-react";
import { db } from "../db";
import type { Category, MonthRule, Transaction, TransactionType } from "../types";
import { TransactionEditor } from "../components/TransactionEditor";
import {
  addMonths,
  formatShortDate,
  getCurrentHouseholdMonthLabel,
  getHouseholdMonth,
  householdMonthId,
  parseDateString,
} from "../utils/month";
import "./GraphPage.css";

function yen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function shortYen(amount: number) {
  const abs = Math.abs(amount);

  if (abs >= 10000) {
    const value = amount / 10000;
    return `${Number.isInteger(value) ? value : value.toFixed(1)}万`;
  }

  return amount.toLocaleString("ja-JP");
}


type TrendRange = "6" | "12" | "all";
type TrendMode = "income-expense" | "balance";

type TrendRow = {
  monthId: string;
  label: string;
  fullLabel: string;
  income: number;
  expense: number;
  balance: number;
};

export function GraphPage() {
  const monthRules = useLiveQuery<MonthRule[]>(
    () => db.monthRules.toArray(),
    [],
  ) ?? [];

  const categories = useLiveQuery<Category[]>(
    () => db.categories.toArray(),
    [],
  ) ?? [];

  const allTransactions = useLiveQuery<Transaction[]>(
    () => db.transactions.toArray(),
    [],
  ) ?? [];

  const currentLabel = useMemo(
    () => getCurrentHouseholdMonthLabel(monthRules),
    [monthRules],
  );

  const [labelYear, setLabelYear] = useState(currentLabel.year);
  const [labelMonth, setLabelMonth] = useState(currentLabel.month);
  const [type, setType] = useState<TransactionType>("expense");
  const [graphTab, setGraphTab] = useState<"pie" | "trend">("pie");
  const [trendRange, setTrendRange] = useState<TrendRange>("6");
  const [trendMode, setTrendMode] =
    useState<TrendMode>("income-expense");
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  const householdMonth = useMemo(
    () => getHouseholdMonth(monthRules, labelYear, labelMonth),
    [monthRules, labelYear, labelMonth],
  );

  const monthTransactions = useMemo(
    () =>
      allTransactions.filter(
        (item) =>
          item.date >= householdMonth.startDate &&
          item.date <= householdMonth.endDate,
      ),
    [
      allTransactions,
      householdMonth.startDate,
      householdMonth.endDate,
    ],
  );

  const chartRows = useMemo(() => {
    const categoryMap = new Map(
      categories.map((category) => [category.id, category]),
    );

    const grouped = new Map<string, number>();

    monthTransactions
      .filter((item) => item.type === type)
      .forEach((item) => {
        grouped.set(
          item.categoryId,
          (grouped.get(item.categoryId) ?? 0) + item.amount,
        );
      });

    const total = Array.from(grouped.values()).reduce(
      (sum, amount) => sum + amount,
      0,
    );

    return Array.from(grouped.entries())
      .map(([categoryId, amount]) => {
        const category = categoryMap.get(categoryId);

        return {
          categoryId,
          name: category?.name ?? "不明なカテゴリ",
          icon: category?.icon ?? "📦",
          color: category?.color ?? "#999999",
          amount,
          percentage:
            total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [categories, monthTransactions, type]);

  const totalAmount = chartRows.reduce(
    (sum, row) => sum + row.amount,
    0,
  );

  const trendData = useMemo(() => {
    const monthMap = new Map<
      string,
      { year: number; month: number; income: number; expense: number }
    >();

    for (const transaction of allTransactions) {
      const date = parseDateString(transaction.date);
      const label = getCurrentHouseholdMonthLabel(monthRules, date);
      const id = householdMonthId(label.year, label.month);

      const current =
        monthMap.get(id) ?? {
          year: label.year,
          month: label.month,
          income: 0,
          expense: 0,
        };

      if (transaction.type === "income") {
        current.income += transaction.amount;
      } else {
        current.expense += transaction.amount;
      }

      monthMap.set(id, current);
    }

    let startLabel: { year: number; month: number };

    if (trendRange === "all" && monthMap.size > 0) {
      const sorted = Array.from(monthMap.values()).sort((a, b) =>
        a.year !== b.year
          ? a.year - b.year
          : a.month - b.month,
      );

      startLabel = {
        year: sorted[0].year,
        month: sorted[0].month,
      };
    } else {
      const count = trendRange === "12" ? 12 : 6;
      startLabel = addMonths(
        currentLabel.year,
        currentLabel.month,
        -(count - 1),
      );
    }

    const rows: TrendRow[] = [];
    let cursor = startLabel;

    while (
      cursor.year < currentLabel.year ||
      (cursor.year === currentLabel.year &&
        cursor.month <= currentLabel.month)
    ) {
      const id = householdMonthId(cursor.year, cursor.month);
      const value = monthMap.get(id);

      rows.push({
        monthId: id,
        label: `${cursor.month}月`,
        fullLabel: `${cursor.year}年${cursor.month}月分`,
        income: value?.income ?? 0,
        expense: value?.expense ?? 0,
        balance: (value?.income ?? 0) - (value?.expense ?? 0),
      });

      cursor = addMonths(cursor.year, cursor.month, 1);
    }

    return rows;
  }, [
    allTransactions,
    monthRules,
    currentLabel.year,
    currentLabel.month,
    trendRange,
  ]);

  function moveMonth(delta: number) {
    const next = addMonths(labelYear, labelMonth, delta);
    setLabelYear(next.year);
    setLabelMonth(next.month);
  }

  return (
    <section className="page graph-page">
      <header className="page-header">
        <h1>グラフ</h1>
      </header>

      <div className="graph-top-tabs">
        <button
          type="button"
          className={
            graphTab === "pie"
              ? "graph-top-tab graph-top-tab--active"
              : "graph-top-tab"
          }
          onClick={() => setGraphTab("pie")}
        >
          円グラフ
        </button>

        <button
          type="button"
          className={
            graphTab === "trend"
              ? "graph-top-tab graph-top-tab--active"
              : "graph-top-tab"
          }
          onClick={() => setGraphTab("trend")}
        >
          月別推移
        </button>
      </div>

      {graphTab === "pie" ? (
        <>
          <div className="calendar-month-header graph-month-header">
            <button
              className="month-arrow"
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="前月"
            >
              <ChevronLeft size={22} />
            </button>

            <div>
              <h1>
                {householdMonth.labelYear}年
                {householdMonth.labelMonth}月分
              </h1>
              <p>
                {formatShortDate(householdMonth.startDate)}
                {" ～ "}
                {formatShortDate(householdMonth.endDate)}
              </p>
            </div>

            <button
              className="month-arrow"
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="次月"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          <div className="segmented-control graph-type-toggle">
            <button
              type="button"
              className={`segment segment--expense ${
                type === "expense" ? "segment--active" : ""
              }`}
              onClick={() => setType("expense")}
            >
              支出
            </button>

            <button
              type="button"
              className={`segment segment--income ${
                type === "income" ? "segment--active" : ""
              }`}
              onClick={() => setType("income")}
            >
              収入
            </button>
          </div>

          <div className="graph-card">
            {chartRows.length === 0 ? (
              <div className="graph-empty">
                <strong>
                  {type === "expense" ? "支出" : "収入"}
                  データがありません
                </strong>
                <span>
                  入力タブから取引を登録すると、ここに内訳が表示されます。
                </span>
              </div>
            ) : (
              <>
                <div className="pie-chart-wrap">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={chartRows}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="52%"
                        outerRadius="82%"
                        paddingAngle={1.5}
                        stroke="none"
                      >
                        {chartRows.map((row) => (
                          <Cell
                            key={row.categoryId}
                            fill={row.color}
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        formatter={(value) =>
                          yen(Number(value))
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="pie-center-label">
                    <span>
                      {type === "expense"
                        ? "支出合計"
                        : "収入合計"}
                    </span>
                    <strong className={`money money--${type}`}>
                      {yen(totalAmount)}
                    </strong>
                  </div>
                </div>

                <div className="graph-category-list">
                  {chartRows.map((row) => (
                    <button
                      key={row.categoryId}
                      type="button"
                      className="graph-category-row"
                      onClick={() =>
                        setSelectedCategoryId(row.categoryId)
                      }
                    >
                      <span
                        className="graph-category-color"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="graph-category-icon">
                        {row.icon}
                      </span>
                      <span className="graph-category-name">
                        {row.name}
                      </span>
                      <span className="graph-category-values">
                        <strong>{yen(row.amount)}</strong>
                        <small>
                          {row.percentage.toFixed(1)}%
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <TrendChart
          data={trendData}
          range={trendRange}
          mode={trendMode}
          onRangeChange={setTrendRange}
          onModeChange={setTrendMode}
        />
      )}

      {selectedCategoryId && (
        <CategoryTransactionDetail
          categoryId={selectedCategoryId}
          categories={categories}
          transactions={monthTransactions}
          onClose={() => setSelectedCategoryId(null)}
          onEdit={(transaction) =>
            setEditingTransaction(transaction)
          }
        />
      )}

      {editingTransaction && (
        <TransactionEditor
          transaction={editingTransaction}
          categories={categories}
          onBack={() => setEditingTransaction(null)}
          onSaved={() => setEditingTransaction(null)}
          onDeleted={() => setEditingTransaction(null)}
        />
      )}
    </section>
  );
}

function CategoryTransactionDetail({
  categoryId,
  categories,
  transactions,
  onClose,
  onEdit,
}: {
  categoryId: string;
  categories: Category[];
  transactions: Transaction[];
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
}) {
  const category = categories.find(
    (item) => item.id === categoryId,
  );

  const rows = transactions
    .filter(
      (transaction) =>
        transaction.categoryId === categoryId,
    )
    .sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return b.createdAt.localeCompare(a.createdAt);
    });

  const total = rows.reduce(
    (sum, transaction) =>
      sum + transaction.amount,
    0,
  );

  return (
    <div
      className="graph-detail-backdrop"
      onMouseDown={onClose}
    >
      <section
        className="graph-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${category?.name ?? "カテゴリ"}の取引`}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="graph-detail-handle" />

        <header className="graph-detail-header">
          <div className="graph-detail-title">
            <span
              className="graph-detail-category-color"
              style={{
                backgroundColor:
                  category?.color ?? "#999999",
              }}
            />

            <span className="graph-detail-category-icon">
              {category?.icon ?? "📦"}
            </span>

            <div>
              <h2>
                {category?.name ?? "不明なカテゴリ"}
              </h2>
              <p>
                合計 {yen(total)} ・ {rows.length}件
              </p>
            </div>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X size={21} />
          </button>
        </header>

        <div className="graph-detail-list">
          {rows.map((transaction) => (
            <button
              type="button"
              className="graph-detail-row"
              key={transaction.id}
              onClick={() =>
                onEdit(transaction)
              }
            >
              <span className="graph-detail-date">
                {transaction.date.replaceAll("-", "/")}
              </span>

              <span className="graph-detail-memo">
                {transaction.memo || "メモなし"}
              </span>

              <span className="graph-detail-value">
                <strong
                  className={`money money--${transaction.type}`}
                >
                  {transaction.type === "expense"
                    ? "-"
                    : "+"}
                  {yen(transaction.amount)}
                </strong>

                <Pencil size={14} />
              </span>
            </button>
          ))}

          {rows.length === 0 && (
            <p className="graph-detail-empty">
              このカテゴリの取引はありません。
            </p>
          )}
        </div>

        {rows.length > 0 && (
          <p className="graph-detail-help">
            取引をタップすると編集・削除できます。
          </p>
        )}
      </section>
    </div>
  );
}

function TrendChart({
  data,
  range,
  mode,
  onRangeChange,
  onModeChange,
}: {
  data: TrendRow[];
  range: TrendRange;
  mode: TrendMode;
  onRangeChange: (value: TrendRange) => void;
  onModeChange: (value: TrendMode) => void;
}) {
  const chartWidth =
    range === "all"
      ? Math.max(680, data.length * 72)
      : undefined;

  const chart = (
    <LineChart
      width={chartWidth}
      height={320}
      data={data}
      margin={{ top: 18, right: 20, bottom: 10, left: 6 }}
    >
      <CartesianGrid
        strokeDasharray="3 3"
        vertical={false}
        opacity={0.35}
      />

      <XAxis
        dataKey="label"
        tick={{ fontSize: 11 }}
        minTickGap={12}
      />

      <YAxis
        tickFormatter={shortYen}
        tick={{ fontSize: 10 }}
        width={48}
      />

      <Tooltip
        labelFormatter={(_, payload) =>
          payload?.[0]?.payload?.fullLabel ?? ""
        }
        formatter={(value, name) => [
          yen(Number(value)),
          name,
        ]}
      />

      {mode === "income-expense" ? (
        <>
          <Legend />
          <Line
            type="linear"
            dataKey="income"
            name="収入"
            stroke="#3277d5"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="linear"
            dataKey="expense"
            name="支出"
            stroke="#d94c4c"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </>
      ) : (
        <>
          <ReferenceLine y={0} stroke="#9aa2af" />
          <Line
            type="linear"
            dataKey="balance"
            name="収支"
            stroke="#6574cd"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </>
      )}
    </LineChart>
  );

  return (
    <div className="trend-section">
      <div className="trend-range-tabs">
        <button
          type="button"
          className={
            range === "6"
              ? "trend-chip trend-chip--active"
              : "trend-chip"
          }
          onClick={() => onRangeChange("6")}
        >
          6か月
        </button>
        <button
          type="button"
          className={
            range === "12"
              ? "trend-chip trend-chip--active"
              : "trend-chip"
          }
          onClick={() => onRangeChange("12")}
        >
          12か月
        </button>
        <button
          type="button"
          className={
            range === "all"
              ? "trend-chip trend-chip--active"
              : "trend-chip"
          }
          onClick={() => onRangeChange("all")}
        >
          全期間
        </button>
      </div>

      <div className="trend-mode-tabs">
        <button
          type="button"
          className={
            mode === "income-expense"
              ? "trend-mode-tab trend-mode-tab--active"
              : "trend-mode-tab"
          }
          onClick={() => onModeChange("income-expense")}
        >
          収入・支出
        </button>
        <button
          type="button"
          className={
            mode === "balance"
              ? "trend-mode-tab trend-mode-tab--active"
              : "trend-mode-tab"
          }
          onClick={() => onModeChange("balance")}
        >
          収支
        </button>
      </div>

      <div className="trend-card">
        {range === "all" ? (
          <div className="trend-scroll">
            {chart}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={data}
              margin={{ top: 18, right: 20, bottom: 10, left: 6 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                opacity={0.35}
              />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                minTickGap={12}
              />

              <YAxis
                tickFormatter={shortYen}
                tick={{ fontSize: 10 }}
                width={48}
              />

              <Tooltip
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullLabel ?? ""
                }
                formatter={(value, name) => [
                  yen(Number(value)),
                  name,
                ]}
              />

              {mode === "income-expense" ? (
                <>
                  <Legend />
                  <Line
                    type="linear"
                    dataKey="income"
                    name="収入"
                    stroke="#3277d5"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="linear"
                    dataKey="expense"
                    name="支出"
                    stroke="#d94c4c"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </>
              ) : (
                <>
                  <ReferenceLine y={0} stroke="#9aa2af" />
                  <Line
                    type="linear"
                    dataKey="balance"
                    name="収支"
                    stroke="#6574cd"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="trend-help">
        月の開始日設定に合わせた家計簿月単位で集計しています。
        全期間は横にスクロールできます。
      </p>
    </div>
  );
}
