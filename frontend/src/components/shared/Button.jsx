export default function Button({
  children,
  onClick,
  disabled = false,
  variant = "primary", // "primary" | "ghost" | "danger"
  className = "",
  type = "button",
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40";

  const variants = {
    primary: "bg-accent text-white hover:opacity-90 active:opacity-80",
    ghost:
      "bg-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5 active:bg-white/10",
    danger:
      "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
