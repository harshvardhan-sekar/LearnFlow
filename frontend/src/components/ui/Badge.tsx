interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "info" | "purple";
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-slate-700 text-slate-300 border-slate-600",
  success: "bg-green-900/40 text-green-300 border-green-700/50",
  warning: "bg-yellow-900/40 text-yellow-300 border-yellow-700/50",
  error: "bg-red-900/40 text-red-300 border-red-700/50",
  info: "bg-blue-900/40 text-blue-300 border-blue-700/50",
  purple: "bg-purple-900/40 text-purple-300 border-purple-700/50",
};

export default function Badge({ label, variant = "default" }: BadgeProps) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${variantClasses[variant]}`}
    >
      {label}
    </span>
  );
}
