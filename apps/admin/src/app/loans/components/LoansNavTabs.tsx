"use client";

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { id: "simulator", label: "Simulador" },
  { id: "portfolio", label: "Portfolio" },
  { id: "theory", label: "Teoria" },
  { id: "competitors", label: "Competencia" },
];

export default function LoansNavTabs({ activeTab, onTabChange }: Props) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition ${
            activeTab === tab.id
              ? "bg-white text-blue-700 shadow-sm"
              : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
