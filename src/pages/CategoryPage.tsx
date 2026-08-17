import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
  Save,
  X,
} from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { db } from "../db";
import type { Budget, Category, MonthRule, TransactionType } from "../types";
import {
  addMonths,
  getCurrentHouseholdMonthLabel,
  getHouseholdMonth,
} from "../utils/month";
import "./CategoryPage.css";

const COLOR_PRESETS = [
  "#4CAF50", "#FF9800", "#607D8B", "#9C27B0",
  "#E91E63", "#673AB7", "#2196F3", "#03A9F4",
  "#00BCD4", "#F44336", "#795548", "#8BC34A",
];

const EMOJI_PRESETS = [
  "🍚", "🍴", "🧻", "👕", "🎲", "🕹️", "💼", "💴",
  "✨", "📦", "🚃", "🏠", "💊", "🎁", "☕", "📱",
];

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

type EditMode = "create" | "edit";

type EditorState = {
  mode: EditMode;
  category?: Category;
};

export function CategoryPage() {
  const [type, setType] = useState<TransactionType>("expense");
  const [editor, setEditor] = useState<EditorState | null>(null);

  const categories =
    (useLiveQuery(
      () =>
        db.categories
          .where("type")
          .equals(type)
          .filter((category) => !category.isArchived)
          .sortBy("sortOrder"),
      [type],
    ) as Category[] | undefined) ?? [];

  const budgets =
    (useLiveQuery(
      () => db.budgets.toArray(),
      [],
    ) as Budget[] | undefined) ?? [];

  const monthRules =
    (useLiveQuery(
      () => db.monthRules.toArray(),
      [],
    ) as MonthRule[] | undefined) ?? [];

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categories, oldIndex, newIndex);

    await db.transaction("rw", db.categories, async () => {
      for (let index = 0; index < reordered.length; index += 1) {
        await db.categories.update(reordered[index].id, {
          sortOrder: index + 1,
        });
      }
    });
  }

  if (editor) {
    return (
      <CategoryEditor
        type={type}
        state={editor}
        budgets={budgets}
        monthRules={monthRules}
        onClose={() => setEditor(null)}
      />
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>カテゴリ</h1>
      </header>

      <div className="segmented-control">
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={categories.map((category) => category.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="sortable-category-list">
            {categories.map((category) => {
              const defaultBudget = budgets.find(
                (budget) =>
                  budget.scope === "category" &&
                  budget.kind === "default" &&
                  budget.categoryId === category.id,
              );

              return (
                <SortableCategoryRow
                  key={category.id}
                  category={category}
                  defaultBudget={defaultBudget?.amount}
                  onOpen={() =>
                    setEditor({ mode: "edit", category })
                  }
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        className="secondary-button category-add-button"
        onClick={() => setEditor({ mode: "create" })}
      >
        <Plus size={18} />
        カテゴリを追加
      </button>

      <p className="category-note">
        右側の三本線を長押しして上下に動かすと並び替えできます。
      </p>
    </section>
  );
}

function SortableCategoryRow({
  category,
  defaultBudget,
  onOpen,
}: {
  category: Category;
  defaultBudget?: number;
  onOpen: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-category-item ${
        isDragging ? "sortable-category-item--dragging" : ""
      }`}
    >
      <button
        type="button"
        className="sortable-category-main"
        onClick={onOpen}
      >
        <span
          className="sortable-category-color"
          style={{ backgroundColor: category.color }}
        />
        <span className="sortable-category-icon">
          {category.icon}
        </span>
        <span className="sortable-category-info">
          <strong>{category.name}</strong>
          <small>基本予算 {yen(defaultBudget)}</small>
        </span>
      </button>

      <button
        ref={setActivatorNodeRef}
        type="button"
        className="sortable-category-handle"
        aria-label={`${category.name}を並び替え`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={24} />
      </button>
    </div>
  );
}

function CategoryEditor({
  type,
  state,
  budgets,
  monthRules,
  onClose,
}: {
  type: TransactionType;
  state: EditorState;
  budgets: Budget[];
  monthRules: MonthRule[];
  onClose: () => void;
}) {
  const category = state.category;

  const currentLabel = useMemo(
    () => getCurrentHouseholdMonthLabel(monthRules),
    [monthRules],
  );

  const [budgetYear, setBudgetYear] = useState(currentLabel.year);
  const [budgetMonth, setBudgetMonth] = useState(currentLabel.month);

  const householdMonth = useMemo(
    () => getHouseholdMonth(monthRules, budgetYear, budgetMonth),
    [monthRules, budgetYear, budgetMonth],
  );

  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "📦");
  const [color, setColor] = useState(category?.color ?? "#607D8B");
  const [defaultBudgetInput, setDefaultBudgetInput] = useState("");
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState("");
  const [message, setMessage] = useState("");

  const defaultBudget = category
    ? budgets.find(
        (budget) =>
          budget.scope === "category" &&
          budget.kind === "default" &&
          budget.categoryId === category.id,
      )
    : undefined;

  const monthlyBudget = category
    ? budgets.find(
        (budget) =>
          budget.scope === "category" &&
          budget.kind === "monthly" &&
          budget.categoryId === category.id &&
          budget.householdMonthId === householdMonth.id,
      )
    : undefined;

  useEffect(() => {
    setDefaultBudgetInput(
      defaultBudget
        ? defaultBudget.amount.toLocaleString("ja-JP")
        : "",
    );
  }, [defaultBudget?.amount, category?.id]);

  useEffect(() => {
    setMonthlyBudgetInput(
      monthlyBudget
        ? monthlyBudget.amount.toLocaleString("ja-JP")
        : "",
    );
  }, [monthlyBudget?.amount, householdMonth.id, category?.id]);

  const effectiveBudget = monthlyBudget?.amount ?? defaultBudget?.amount;

  function moveBudgetMonth(delta: number) {
    const next = addMonths(budgetYear, budgetMonth, delta);
    setBudgetYear(next.year);
    setBudgetMonth(next.month);
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage("カテゴリ名を入力してください。");
      return;
    }

    let categoryId = category?.id;

    if (state.mode === "create") {
      const existing = await db.categories
        .where("type")
        .equals(type)
        .filter((item) => !item.isArchived)
        .toArray();

      const maxOrder = existing.reduce(
        (max, item) => Math.max(max, item.sortOrder),
        0,
      );

      categoryId = crypto.randomUUID();

      await db.categories.add({
        id: categoryId,
        type,
        name: trimmedName,
        color,
        icon: icon.trim() || "📦",
        sortOrder: maxOrder + 1,
        isArchived: false,
        createdAt: new Date().toISOString(),
      });
    } else if (categoryId) {
      await db.categories.update(categoryId, {
        name: trimmedName,
        color,
        icon: icon.trim() || "📦",
      });
    }

    if (!categoryId) return;

    const defaultAmount = parseAmount(defaultBudgetInput);
    const latestDefaultBudget = budgets.find(
      (budget) =>
        budget.scope === "category" &&
        budget.kind === "default" &&
        budget.categoryId === categoryId,
    );

    if (defaultAmount === undefined) {
      if (latestDefaultBudget) {
        await db.budgets.delete(latestDefaultBudget.id);
      }
    } else if (latestDefaultBudget) {
      await db.budgets.update(latestDefaultBudget.id, {
        amount: defaultAmount,
      });
    } else {
      await db.budgets.add({
        id: crypto.randomUUID(),
        scope: "category",
        categoryId,
        amount: defaultAmount,
        kind: "default",
      });
    }

    const monthlyAmount = parseAmount(monthlyBudgetInput);
    const latestMonthlyBudget = budgets.find(
      (budget) =>
        budget.scope === "category" &&
        budget.kind === "monthly" &&
        budget.categoryId === categoryId &&
        budget.householdMonthId === householdMonth.id,
    );

    if (monthlyAmount === undefined) {
      if (latestMonthlyBudget) {
        await db.budgets.delete(latestMonthlyBudget.id);
      }
    } else if (latestMonthlyBudget) {
      await db.budgets.update(latestMonthlyBudget.id, {
        amount: monthlyAmount,
      });
    } else {
      await db.budgets.add({
        id: crypto.randomUUID(),
        scope: "category",
        categoryId,
        amount: monthlyAmount,
        kind: "monthly",
        householdMonthId: householdMonth.id,
      });
    }

    setMessage(
      state.mode === "create"
        ? "カテゴリを追加しました。"
        : "カテゴリを保存しました。",
    );

    window.setTimeout(onClose, 700);
  }

  async function archiveCategory() {
    if (!category) return;

    const ok = window.confirm(
      `「${category.name}」をアーカイブしますか？\n過去の取引データは残ります。`,
    );
    if (!ok) return;

    await db.categories.update(category.id, {
      isArchived: true,
    });
    onClose();
  }

  return (
    <section className="page category-editor-page">
      <header className="category-editor-header">
        <button type="button" className="icon-button" onClick={onClose}>
          <ChevronLeft size={21} />
        </button>

        <h1>
          {state.mode === "create"
            ? `${type === "expense" ? "支出" : "収入"}カテゴリを追加`
            : "カテゴリ編集"}
        </h1>

        <button type="button" className="icon-button" onClick={onClose}>
          <X size={21} />
        </button>
      </header>

      <form className="category-editor-form" onSubmit={saveCategory}>
        <div className="input-card">
          <label className="field">
            <span className="field__label">カテゴリ名</span>
            <input
              type="text"
              maxLength={30}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例：食費"
            />
          </label>

          <div className="field">
            <span className="field__label">アイコン</span>

            <div className="emoji-grid">
              {EMOJI_PRESETS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  className={`emoji-button ${
                    icon === emoji ? "emoji-button--active" : ""
                  }`}
                  onClick={() => setIcon(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <label className="emoji-custom">
              <span>自由入力</span>
              <input
                type="text"
                value={icon}
                maxLength={4}
                onChange={(event) => setIcon(event.target.value)}
              />
            </label>
          </div>

          <div className="field">
            <span className="field__label">テーマカラー</span>

            <div className="color-grid">
              {COLOR_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={`color-button ${
                    color.toLowerCase() === preset.toLowerCase()
                      ? "color-button--active"
                      : ""
                  }`}
                  style={{ backgroundColor: preset }}
                  onClick={() => setColor(preset)}
                />
              ))}
            </div>

            <label className="color-picker-row">
              <span>自由に選ぶ</span>
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
              <code>{color}</code>
            </label>
          </div>
        </div>

        <div className="input-card category-budget-card">
          <h2>基本予算</h2>

          <label className="field">
            <span className="field__label">
              このカテゴリの基本予算
            </span>

            <div className="amount-field">
              <span>¥</span>
              <input
                inputMode="numeric"
                value={defaultBudgetInput}
                onChange={(event) =>
                  setDefaultBudgetInput(formatAmount(event.target.value))
                }
                placeholder="未設定"
              />
            </div>

            <small className="category-help">
              月別予算を設定していない月に使用します。
            </small>
          </label>
        </div>

        <div className="input-card category-budget-card">
          <div className="category-budget-month-header">
            <button
              type="button"
              className="month-arrow"
              onClick={() => moveBudgetMonth(-1)}
            >
              <ChevronLeft size={20} />
            </button>

            <div>
              <h2>
                {householdMonth.labelYear}年
                {householdMonth.labelMonth}月分の予算
              </h2>
              <p>
                {householdMonth.startDate.replaceAll("-", "/")}
                {" ～ "}
                {householdMonth.endDate.replaceAll("-", "/")}
              </p>
            </div>

            <button
              type="button"
              className="month-arrow"
              onClick={() => moveBudgetMonth(1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <label className="field">
            <div className="amount-field">
              <span>¥</span>
              <input
                inputMode="numeric"
                value={monthlyBudgetInput}
                onChange={(event) =>
                  setMonthlyBudgetInput(formatAmount(event.target.value))
                }
                placeholder="基本予算を使用"
              />
            </div>

            <small className="category-help">
              空欄なら基本予算 {yen(defaultBudget?.amount)} を使用します。
            </small>
          </label>

          <div className="category-effective-budget">
            <small>この月に適用される予算</small>
            <strong>{yen(effectiveBudget)}</strong>
            {monthlyBudget && <span>この月だけの予算を使用中</span>}
          </div>
        </div>

        <button
          className={`primary-button primary-button--${type}`}
          type="submit"
        >
          <Save size={18} />
          {state.mode === "create" ? "追加する" : "保存する"}
        </button>

        {state.mode === "edit" && (
          <button
            type="button"
            className="category-archive-button"
            onClick={archiveCategory}
          >
            <Archive size={18} />
            このカテゴリをアーカイブ
          </button>
        )}
      </form>

      {message && <div className="toast">{message}</div>}
    </section>
  );
}
