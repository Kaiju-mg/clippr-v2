import type { Metadata } from "next";
import Link from "next/link";
import {
  Bullets,
  ContactEmail,
  LegalPage,
  Section,
} from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Eliminar tu cuenta · Clippr",
};

/**
 * Página pública de eliminación de cuenta (2026-10-04). Las tiendas de
 * aplicaciones piden una dirección web, accesible sin iniciar sesión, que
 * explique cómo borrar la cuenta y qué datos se borran o se conservan. El
 * borrado en sí está en `/mas/eliminar-cuenta` (`deleteAccountAction`).
 */
export default function EliminarCuentaPublicaPage() {
  return (
    <LegalPage title="Eliminar tu cuenta de Clippr">
      <Section title="Desde la app">
        <p>
          Iniciá sesión y andá a <strong>Más → Eliminar mi cuenta</strong>. Para
          confirmar te vamos a pedir que escribas una palabra (el nombre de tu
          barbería, si sos el dueño). La eliminación es inmediata y no se puede
          deshacer.
        </p>
        <p>
          <Link href="/login" className="underline">
            Iniciar sesión
          </Link>
        </p>
      </Section>

      <Section title="Qué se borra">
        <p>
          <strong>Si sos el dueño</strong>, se borra la barbería entera:
        </p>
        <Bullets>
          <li>Tu cuenta y las de todos tus barberos (email y contraseña).</li>
          <li>Turnos, cajas, cobros, ventas, servicios y productos.</li>
          <li>El nombre y el teléfono de la barbería.</li>
        </Bullets>
        <p>
          <strong>Si sos barbero</strong>, se borran tu email y tu contraseña, y
          tu nombre se reemplaza por “Barbero eliminado”.
        </p>
      </Section>

      <Section title="Qué se conserva">
        <p>
          Cuando un barbero elimina su cuenta, los cortes y cobros que hizo
          quedan en la caja de la barbería, sin su nombre ni su email: son
          registros del negocio y el dueño los necesita para sus cuentas. Si el
          dueño elimina su cuenta, esos registros también se borran.
        </p>
        <p>
          Los registros técnicos del servidor (dirección IP, navegador, hora) se
          borran solos a los pocos días.
        </p>
      </Section>

      <Section title="Si no podés entrar a la app">
        <p>
          Escribinos a <ContactEmail /> desde el email con el que te
          registraste, indicando el nombre de tu barbería, y la eliminamos por
          vos.
        </p>
      </Section>
    </LegalPage>
  );
}
