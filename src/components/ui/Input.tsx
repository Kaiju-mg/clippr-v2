import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Input({ label, id, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-muted text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className={`border-line bg-background text-foreground rounded border px-3 py-2 ${className}`}
        {...props}
      />
    </div>
  );
}
