interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`inline-flex h-6 w-10 flex-none items-center rounded-full border p-0 transition-colors disabled:opacity-50 ${
        checked ? "border-accent bg-accent" : "border-line bg-surface-2"
      }`}
    >
      <span
        className={`bg-accent-contrast ml-0.5 h-4 w-4 rounded-full shadow-sm transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}
