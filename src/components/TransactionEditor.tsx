import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { db } from "../db";
import type {
  Category,
  Transaction,
  TransactionType,
} from "../types";
import "./TransactionEditor.css";

function formatAmount(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits
    ? Number(digits).toLocaleString("ja-JP")
    : "";
}

function parseAmount(value: string) {
  const normalized = value.replaceAll(",", "");
  const amount = Number(normalized);

  if (
    !normalized ||
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    return undefined;
  }

  return amount;
}

export function TransactionEditor({
  transaction,
  categories,
  onBack,
  onSaved,
  onDeleted,
}: {
  transaction: Transaction;
  categories: Category[];
  onBack: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [type, setType] =
    useState<TransactionType>(
      transaction.type,
    );

  const [amount, setAmount] = useState(
    transaction.amount.toLocaleString("ja-JP"),
  );

  const [categoryId, setCategoryId] =
    useState(transaction.categoryId);

  const [date, setDate] =
    useState(transaction.date);

  const [memo, setMemo] =
    useState(transaction.memo);

  const [message, setMessage] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const currentCategory = categories.find(
    (category) =>
      category.id === transaction.categoryId,
  );

  const selectableCategories = useMemo(
    () =>
      categories
        .filter(
          (category) =>
            category.type === type &&
            (!category.isArchived ||
              category.id ===
                transaction.categoryId),
        )
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder,
        ),
    [
      categories,
      type,
      transaction.categoryId,
    ],
  );

  useEffect(() => {
    const selected = selectableCategories.some(
      (category) =>
        category.id === categoryId,
    );

    if (!selected) {
      setCategoryId(
        selectableCategories[0]?.id ?? "",
      );
    }
  }, [
    type,
    selectableCategories,
    categoryId,
  ]);

  async function saveTransaction() {
    const parsedAmount =
      parseAmount(amount);

    if (!parsedAmount) {
      setMessage(
        "金額を1円以上で入力してください。",
      );
      return;
    }

    if (!categoryId) {
      setMessage(
        "カテゴリを選択してください。",
      );
      return;
    }

    if (!date) {
      setMessage(
        "日付を選択してください。",
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await db.transactions.update(
        transaction.id,
        {
          type,
          amount: parsedAmount,
          categoryId,
          date,
          memo: memo.trim(),
          updatedAt:
            new Date().toISOString(),
        },
      );

      onSaved();
    } catch (error) {
      console.error(error);
      setMessage(
        "取引の保存に失敗しました。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction() {
    const confirmed = window.confirm(
      "この取引を削除しますか？\n" +
        "削除した取引は元に戻せません。",
    );

    if (!confirmed) {
      return;
    }

    try {
      await db.transactions.delete(
        transaction.id,
      );

      onDeleted();
    } catch (error) {
      console.error(error);
      setMessage(
        "取引の削除に失敗しました。",
      );
    }
  }

  return (
    <div className="transaction-editor-backdrop">
      <section
        className="transaction-editor"
        role="dialog"
        aria-modal="true"
        aria-label="取引編集"
      >
        <header className="transaction-editor-header">
          <button
            type="button"
            className="icon-button"
            onClick={onBack}
            aria-label="戻る"
          >
            <ChevronLeft size={22} />
          </button>

          <h2>取引を編集</h2>

          <button
            type="button"
            className="icon-button"
            onClick={onBack}
            aria-label="閉じる"
          >
            <X size={21} />
          </button>
        </header>

        <div className="transaction-editor-body">
          <div className="segmented-control">
            <button
              type="button"
              className={`segment segment--expense ${
                type === "expense"
                  ? "segment--active"
                  : ""
              }`}
              onClick={() =>
                setType("expense")
              }
            >
              支出
            </button>

            <button
              type="button"
              className={`segment segment--income ${
                type === "income"
                  ? "segment--active"
                  : ""
              }`}
              onClick={() =>
                setType("income")
              }
            >
              収入
            </button>
          </div>

          <div className="transaction-editor-card">
            <label className="field">
              <span className="field__label">
                金額
              </span>

              <div className="amount-field">
                <span>¥</span>

                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      formatAmount(
                        event.target.value,
                      ),
                    )
                  }
                  autoFocus
                />
              </div>
            </label>

            <label className="field">
              <span className="field__label">
                カテゴリ
              </span>

              <select
                value={categoryId}
                onChange={(event) =>
                  setCategoryId(
                    event.target.value,
                  )
                }
              >
                {selectableCategories.map(
                  (category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.icon}{" "}
                      {category.name}
                      {category.isArchived
                        ? "（アーカイブ済み）"
                        : ""}
                    </option>
                  ),
                )}
              </select>

              {currentCategory?.isArchived &&
                currentCategory.type ===
                  type &&
                categoryId ===
                  currentCategory.id && (
                  <small className="transaction-editor-note">
                    この取引では、アーカイブ済みカテゴリをそのまま使用できます。
                  </small>
                )}
            </label>

            <label className="field">
              <span className="field__label">
                日付
              </span>

              <input
                type="date"
                value={date}
                onChange={(event) =>
                  setDate(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="field">
              <span className="field__label">
                メモ
              </span>

              <textarea
                value={memo}
                maxLength={200}
                onChange={(event) =>
                  setMemo(
                    event.target.value,
                  )
                }
                placeholder="メモ（任意）"
                rows={3}
              />

              <small className="transaction-editor-counter">
                {memo.length}/200
              </small>
            </label>
          </div>

          {message && (
            <p className="transaction-editor-error">
              {message}
            </p>
          )}

          <button
            type="button"
            className={`primary-button primary-button--${type} transaction-save-button`}
            onClick={saveTransaction}
            disabled={saving}
          >
            <Save size={18} />
            {saving
              ? "保存中..."
              : "変更を保存"}
          </button>

          <button
            type="button"
            className="transaction-delete-button"
            onClick={deleteTransaction}
          >
            <Trash2 size={18} />
            この取引を削除
          </button>
        </div>
      </section>
    </div>
  );
}
