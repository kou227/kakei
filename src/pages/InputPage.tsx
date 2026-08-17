import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2 } from "lucide-react";
import { db } from "../db";
import type { Category, TransactionType } from "../types";

function todayString() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function InputPage() {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayString());
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState("");

  const categories = useLiveQuery<Category[]>(
    () =>
      db.categories
        .where("type")
        .equals(type)
        .filter((category) => !category.isArchived)
        .sortBy("sortOrder"),
    [type],
  ) ?? [];

  useEffect(() => {
    if (!categories.length) {
      setCategoryId("");
      return;
    }

    if (!categories.some((category) => category.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const numericAmount = useMemo(
    () => Number(amount.replaceAll(",", "")),
    [amount],
  );

  function handleAmountChange(value: string) {
    const digits = value.replace(/\D/g, "");
    setAmount(digits ? Number(digits).toLocaleString("ja-JP") : "");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!numericAmount || numericAmount < 1) {
      setMessage("1円以上の金額を入力してください。");
      return;
    }
    if (!categoryId) {
      setMessage("カテゴリを選択してください。");
      return;
    }
    if (!date) {
      setMessage("日付を選択してください。");
      return;
    }

    const timestamp = new Date().toISOString();

    await db.transactions.add({
      id: crypto.randomUUID(),
      type,
      amount: numericAmount,
      categoryId,
      date,
      memo: memo.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    setAmount("");
    setMemo("");
    setMessage(`${type === "expense" ? "支出" : "収入"}を登録しました。`);
    window.setTimeout(() => setMessage(""), 2200);
  }

  return (
    <section className="page input-page">
      <header className="page-header">
        <h1>入力</h1>
      </header>

      <div className="segmented-control">
        <button
          type="button"
          className={`segment segment--expense ${type === "expense" ? "segment--active" : ""}`}
          onClick={() => setType("expense")}
        >
          支出
        </button>
        <button
          type="button"
          className={`segment segment--income ${type === "income" ? "segment--active" : ""}`}
          onClick={() => setType("income")}
        >
          収入
        </button>
      </div>

      <form className="input-card" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">金額</span>
          <div className="amount-field">
            <span>¥</span>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(event) => handleAmountChange(event.target.value)}
              placeholder="0"
              aria-label="金額"
            />
          </div>
        </label>

        <label className="field">
          <span className="field__label">カテゴリ</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">日付</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

        <label className="field">
          <span className="field__label">
            メモ <small>任意</small>
          </span>
          <input
            type="text"
            maxLength={200}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="スーパー、飲み会など"
          />
        </label>

        <button className={`primary-button primary-button--${type}`} type="submit">
          登録する
        </button>
      </form>

      {message && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}
    </section>
  );
}
