"use client";

import { AppBadge } from "./AppBadge";

type BadgeVariant = "public" | "doctor" | "none";

interface PathItem {
  badge?: BadgeVariant;
  label: string;
  title: string;
  steps: string[];
  note?: string;
  accentColor?: string;
}

interface WorkflowPathProps {
  heading: string;
  paths: PathItem[];
}

const accentClasses: Record<string, string> = {
  indigo: "border-indigo-400",
  gray: "border-gray-700",
  emerald: "border-emerald-400",
  amber: "border-amber-400",
};

export function WorkflowPath({ heading, paths }: WorkflowPathProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
        {heading}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {paths.map((path, i) => {
          const accent =
            accentClasses[path.accentColor ?? "gray"] ??
            "border-gray-300";
          return (
            <div
              key={i}
              className={`bg-white rounded-xl border border-gray-200 shadow-sm border-l-4 ${accent} p-4`}
            >
              <div className="flex items-center gap-2 mb-2">
                {path.badge && path.badge !== "none" && (
                  <AppBadge variant={path.badge} />
                )}
                <span className="text-xs text-gray-500 font-medium">
                  {path.label}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-3">
                {path.title}
              </p>
              <ol className="space-y-1.5">
                {path.steps.map((step, j) => (
                  <li key={j} className="flex gap-2 text-sm text-gray-600">
                    <span className="flex-shrink-0 text-gray-400 font-medium">
                      {j + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {path.note && (
                <p className="mt-3 text-xs text-gray-500 italic border-t border-gray-100 pt-2">
                  {path.note}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
