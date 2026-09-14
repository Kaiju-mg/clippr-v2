import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Input({ label, id, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        className={`rounded border border-line bg-background px-3 py-2 text-foreground ${className}`}
        {...props}
      />
    </div>
  );
}
