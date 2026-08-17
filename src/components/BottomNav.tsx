import {
  CalendarDays,
  ChartPie,
  PenLine,
  Settings,
  Tags,
} from "lucide-react";

export type MainTab =
  | "input"
  | "calendar"
  | "graph"
  | "category"
  | "settings";

type Props = {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
};

const items = [
  { id: "input" as const, label: "入力", icon: PenLine },
  { id: "calendar" as const, label: "カレンダー", icon: CalendarDays },
  { id: "graph" as const, label: "グラフ", icon: ChartPie },
  { id: "category" as const, label: "カテゴリ", icon: Tags },
  { id: "settings" as const, label: "設定", icon: Settings },
];

export function BottomNav({ activeTab, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="メインメニュー">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`bottom-nav__item ${
            activeTab === id ? "bottom-nav__item--active" : ""
          }`}
          onClick={() => onChange(id)}
        >
          <Icon size={21} strokeWidth={2} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
