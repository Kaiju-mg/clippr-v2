/**
 * Tema visual de la app (claro u oscuro).
 *
 * Se guarda en una cookie y no en `localStorage` para que el servidor pueda
 * renderizar el `<html>` con el tema ya puesto: así no hay parpadeo de claro
 * a oscuro en el primer pintado ni desajuste de hidratación. La escribe el
 * cliente (ver `ThemeSwitch`), no un Server Action, para que cambiar de tema
 * funcione con la red caída.
 */
export type Theme = "light" | "dark";

export const THEME_COOKIE = "clippr-theme";

/** Un año: una preferencia visual no debería expirar sola. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Color de la barra del navegador por tema. Tiene que seguir a `--background`
 * de `globals.css` (papel / carbón cálido desde la spec 10); lo verifica
 * `src/app/__tests__/theme-tokens.test.ts`.
 */
export const THEME_BROWSER_COLOR: Record<Theme, string> = {
  light: "#fffdf6",
  dark: "#161412",
};

/**
 * Normaliza lo que venga de la cookie. Cualquier valor que no sea "dark"
 * cae en claro, que es el tema por defecto.
 */
export function parseTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}
