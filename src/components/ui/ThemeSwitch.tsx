"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/Switch";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, type Theme } from "@/lib/theme";

interface ThemeSwitchProps {
  initialTheme: Theme;
}

/**
 * Interruptor de modo oscuro. El estado real vive en la cookie
 * `clippr-theme`, que el servidor lee en el layout raíz; acá sólo se
 * espeja para que el switch se dibuje en la posición correcta.
 */
export function ThemeSwitch({ initialTheme }: ThemeSwitchProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  function handleToggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);

    // Primero el DOM: el color cambia al instante, sin esperar al servidor.
    document.documentElement.dataset.theme = next;

    // Después la cookie, para que el próximo render del servidor ya llegue
    // con el tema puesto. Se escribe desde el cliente y no con un Server
    // Action a propósito: cambiar de tema tiene que funcionar con la red
    // caída (regla 4 de CLAUDE.md) y no hay nada que revalidar.
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
  }

  return (
    <div className="flex items-center justify-between py-3.5">
      <span className="text-[15px]">Modo oscuro</span>
      <Switch
        checked={theme === "dark"}
        onChange={handleToggle}
        label="Modo oscuro"
      />
    </div>
  );
}
