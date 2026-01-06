"use client";

import { Loader2 } from "lucide-react";

export interface StatusOption {
  value: string;
  label: string;
  color: string;
  icon: string;
}

interface InlineStatusSelectProps {
  currentStatus: string;
  statuses: StatusOption[];
  onStatusChange: (newStatus: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export default function InlineStatusSelect({
  currentStatus,
  statuses,
  onStatusChange,
  disabled = false,
  className = "",
}: InlineStatusSelectProps) {
  const currentConfig = statuses.find((s) => s.value === currentStatus) || statuses[0];

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (newStatus !== currentStatus) {
      await onStatusChange(newStatus);
    }
  };

  if (disabled) {
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${currentConfig.color} ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        {currentConfig.icon} {currentConfig.label}
      </span>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={disabled}
        className={`
          appearance-none cursor-pointer
          px-3 py-1 pr-8 text-xs font-semibold rounded-full
          ${currentConfig.color}
          border-0 outline-none
          hover:opacity-80 transition-opacity
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='currentColor' d='M6 8L2 4h8z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.5rem center',
          backgroundSize: '12px',
        }}
      >
        {statuses.map((status) => (
          <option key={status.value} value={status.value}>
            {status.icon} {status.label}
          </option>
        ))}
      </select>
    </div>
  );
}
