"use client";

type BadgeVariant = "public" | "doctor";

interface AppBadgeProps {
  variant: BadgeVariant;
}

const config: Record<BadgeVariant, { label: string; className: string }> = {
  public: {
    label: "App Pública",
    className: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  doctor: {
    label: "App Doctor",
    className: "bg-gray-900 text-white border-gray-900",
  },
};

export function AppBadge({ variant }: AppBadgeProps) {
  const { label, className } = config[variant];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}
    >
      {label}
    </span>
  );
}
