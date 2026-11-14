import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-sky-600 text-white hover:bg-sky-500 disabled:bg-sky-900 disabled:text-sky-300",
  secondary: "bg-zinc-700 text-zinc-100 hover:bg-zinc-600 disabled:text-zinc-500",
  danger: "bg-rose-700 text-white hover:bg-rose-600 disabled:bg-rose-950",
  ghost: "text-zinc-300 hover:bg-zinc-800 disabled:text-zinc-600",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = "secondary", className = "", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={`rounded px-3 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
