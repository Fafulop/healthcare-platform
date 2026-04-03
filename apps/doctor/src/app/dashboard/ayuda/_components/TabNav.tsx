"use client";

import { type ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function TabNav({ tabs, activeTab, onChange }: TabNavProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const isDisabled = tab.disabled;

        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onChange(tab.id)}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              isActive
                ? "bg-gray-900 text-white"
                : isDisabled
                ? "bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab.icon && (
              <span className={isActive ? "text-white" : "text-gray-400"}>
                {tab.icon}
              </span>
            )}
            {tab.label}
            {isDisabled && (
              <span className="text-xs text-gray-300 font-normal">pronto</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
