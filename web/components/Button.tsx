import React from "react";

export type ButtonVariant = "primary" | "pause" | "secondary" | "chip";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  active?: boolean;
}

export function Button({
  variant = "secondary",
  active = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const variantClass =
    variant === "primary"
      ? "dp-btn-primary"
      : variant === "pause"
      ? "dp-btn-pause"
      : variant === "chip"
      ? `dp-btn-chip ${active ? "dp-btn-chip-active" : ""}`
      : "dp-btn-secondary";

  return (
    <button
      type="button"
      className={`dp-btn ${variantClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
