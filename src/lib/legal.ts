/**
 * Datos del responsable que aparecen en la Política de Privacidad, los
 * Términos, la ayuda y la página de eliminar cuenta (2026-10-04). Están
 * todos acá para que cambiarlos sea tocar un solo archivo.
 *
 * `contactEmail`: el email de Clippr todavía no existe. Mientras sea null,
 * las páginas muestran un aviso y **no hay que publicar** (ver
 * `docs/produccion.md`): una política de privacidad sin un contacto real no
 * cumple.
 */
export const LEGAL = {
  /** Responsable de los datos y prestador del servicio: persona física. */
  responsable: "Eduardo Villalba",
  pais: "Paraguay",
  ciudad: null as string | null,
  contactEmail: null as string | null,
  /** Versión de los textos que acepta el dueño al registrarse. */
  version: "2026-10-04",
  /** Para mostrar "Última actualización: …". */
  actualizado: "4 de octubre de 2026",
} as const;

/** Lo que escribe el barbero para confirmar que elimina su cuenta. */
export const BARBER_DELETE_CONFIRMATION = "ELIMINAR";

/**
 * Lo que queda en la fila de un barbero que eliminó su cuenta. Vive acá y no
 * en `account.actions.ts`: un archivo "use server" sólo exporta funciones.
 */
export const NOMBRE_CUENTA_ELIMINADA = "Barbero eliminado";
