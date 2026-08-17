import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Pencil,
  X,
} from "lucide-react";
import type {
  Category,
  Transaction,
} from "../types";
import { formatJapaneseDate } from "../utils/month";
import { TransactionEditor } from "./TransactionEditor";

type Props = {
  date: string;
  transactions: Transaction[];
  categories: Category[];
  onClose: () => void;
};

function yen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function DayDetailModal({
  date,
  transactions,
  categories,
  onClose,
}: Props) {
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  const categoryMap = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category.id,
          category,
        ]),
      ),
    [categories],
  );

  const expenses = transactions.filter(
    (item) => item.type === "expense",
  );

  const incomes = transactions.filter(
    (item) => item.type === "income",
  );

  const expenseTotal = expenses.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  const incomeTotal = incomes.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  const renderItems = (items: Transaction[]) => (
    <div className="day-detail-list">
      {items.map((item) => {
        const category = categoryMap.get(
          item.categoryId,
        );

        return (
          <button
            className="day-detail-item transaction-detail-item"
            type="button"
            key={item.id}
            onClick={() =>
              setEditingTransaction(item)
            }
          >
            <span
              className="day-detail-item__dot"
              style={{
                backgroundColor:
                  category?.color ?? "#999",
              }}
            />

            <span className="day-detail-item__body">
              <strong>
                {category?.icon}{" "}
                {category?.name ??
                  "不明なカテゴリ"}
              </strong>

              <small>
                {item.memo || "メモなし"}
              </small>
            </span>

            <span className="transaction-detail-amount">
              <strong
                className={`money money--${item.type}`}
              >
                {item.type === "expense"
                  ? "-"
                  : "+"}
                {yen(item.amount)}
              </strong>

              <Pencil size={14} />
            </span>
          </button>
        );
      })}
    </div>
  );

  if (editingTransaction) {
    return createPortal(
      <TransactionEditor
        transaction={editingTransaction}
        categories={categories}
        onBack={() =>
          setEditingTransaction(null)
        }
        onSaved={() =>
          setEditingTransaction(null)
        }
        onDeleted={() =>
          setEditingTransaction(null)
        }
      />,
      document.body,
    );
  }

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
    >
      <section
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${formatJapaneseDate(
          date,
        )}の明細`}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="bottom-sheet__handle" />

        <header className="bottom-sheet__header">
          <div>
            <h2>
              {formatJapaneseDate(date)}
            </h2>

            <div className="day-detail-totals">
              <span className="money money--income">
                収入 +{yen(incomeTotal)}
              </span>

              <span className="money money--expense">
                支出 -{yen(expenseTotal)}
              </span>
            </div>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X size={21} />
          </button>
        </header>

        <div className="bottom-sheet__content">
          {expenses.length > 0 && (
            <section className="detail-section">
              <h3>支出</h3>
              {renderItems(expenses)}
            </section>
          )}

          {incomes.length > 0 && (
            <section className="detail-section">
              <h3>収入</h3>
              {renderItems(incomes)}
            </section>
          )}

          {transactions.length === 0 && (
            <div className="empty-state">
              この日の明細はありません。
            </div>
          )}

          {transactions.length > 0 && (
            <p className="transaction-detail-help">
              明細をタップすると編集できます。
            </p>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
