"use client";

import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

interface WorkflowStepProps {
  number: number;
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  tip?: string;
}

export function WorkflowStep({
  number,
  title,
  icon: Icon,
  children,
  tip,
}: WorkflowStepProps) {
  return (
    <div className="flex gap-4">
      {/* Number circle + vertical line */}
      <div className="flex flex-col items-center">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold">
          {number}
        </div>
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />}
          <p className="text-sm font-semibold text-gray-900">{title}</p>
        </div>
        <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
        {tip && (
          <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <span className="font-medium">Tip: </span>
            {tip}
          </div>
        )}
      </div>
    </div>
  );
}
