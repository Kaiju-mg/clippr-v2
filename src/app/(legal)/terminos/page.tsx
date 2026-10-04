import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import {
  Bullets,
  ContactEmail,
  LegalPage,
  Section,
} from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Términos y Condiciones · Clippr",
};

/**
 * Términos y Condiciones (2026-10-04). Los acepta el dueño al registrar su
 * barbería (casilla en `/registro`, versión en `LEGAL.version`).
 */
export default function TerminosPage() {
  return (
    <LegalPage title="Términos y Condiciones">
      <p>
        Estos términos son las reglas para usar Clippr. Al registrar tu barbería
        los aceptás. Si no estás de acuerdo, no uses el servicio.
      </p>

      <Section title="Qué es Clippr y quién lo presta">
        <p>
          Clippr es una aplicación web para que las barberías registren turnos,
          cortes, ventas y movimientos de caja, y vean estadísticas de su
          equipo. La presta {LEGAL.responsable}, en {LEGAL.pais}. Contacto:{" "}
          <ContactEmail />.
        </p>
      </Section>

      <Section title="Cuentas">
        <Bullets>
          <li>
            El <strong>dueño</strong> registra la barbería y es responsable de
            ella: de los barberos que da de alta, de los datos que se cargan y
            de entregar a cada barbero su contraseña temporal de forma segura.
          </li>
          <li>
            Cada persona usa su propia cuenta y cuida su contraseña. Si creés
            que alguien entró a tu cuenta, cambiala desde{" "}
            <strong>Más → Cambiar contraseña</strong> y avisanos.
          </li>
          <li>Para usar Clippr tenés que ser mayor de 18 años.</li>
        </Bullets>
      </Section>

      <Section title="Uso permitido">
        <p>Te comprometés a no:</p>
        <Bullets>
          <li>Usar Clippr para algo ilegal o para engañar a terceros.</li>
          <li>Intentar ver o modificar datos de otra barbería.</li>
          <li>
            Interferir con el funcionamiento del servicio o probar sus defensas
            sin autorización.
          </li>
          <li>
            Cargar datos de clientes que no te hayan autorizado a guardar.
          </li>
        </Bullets>
      </Section>

      <Section title="Tus datos y los de tu barbería">
        <p>
          Los datos que carga tu barbería son de tu barbería. Los usamos sólo
          para prestarte el servicio, como explica la{" "}
          <Link href="/privacidad" className="underline">
            Política de Privacidad
          </Link>
          . Si cargás nombres de clientes, sos responsable de contar con su
          autorización.
        </p>
      </Section>

      <Section title="Lo que Clippr no es">
        <p>
          Clippr es una herramienta de registro y organización.{" "}
          <strong>No emite facturas ni reemplaza tu contabilidad</strong> ni tus
          obligaciones ante la administración tributaria: los números de la caja
          te ayudan a llevar el día, pero no son un comprobante legal.
        </p>
      </Section>

      <Section title="Planes y pagos">
        <p>
          Hoy Clippr se ofrece en período de prueba, sin costo. Si más adelante
          cobramos por el servicio, te lo vamos a avisar con anticipación y
          vamos a publicar los precios y la política de pagos, cancelaciones y
          reembolsos antes de cualquier cobro. Nada se te va a cobrar sin que lo
          aceptes.
        </p>
      </Section>

      <Section title="Disponibilidad">
        <p>
          Trabajamos para que Clippr funcione siempre, pero se ofrece “tal
          cual”, sin garantía de que nunca tenga cortes ni errores. Necesita
          conexión a internet para cobrar y cerrar la caja: sin señal, los
          temporizadores siguen andando pero el cobro espera a que vuelva la
          conexión. Podemos cambiar, agregar o quitar funciones para mejorar el
          servicio.
        </p>
      </Section>

      <Section title="Responsabilidad">
        <p>
          En la medida que la ley lo permita, no somos responsables por pérdidas
          de ingresos, de datos o de oportunidades de negocio que resulten del
          uso del servicio o de no poder usarlo. Nada de esto limita los
          derechos que te reconoce la ley de defensa del consumidor.
        </p>
      </Section>

      <Section title="Baja y suspensión">
        <p>
          Podés eliminar tu cuenta cuando quieras desde{" "}
          <strong>Más → Eliminar mi cuenta</strong> (ver{" "}
          <Link href="/eliminar-cuenta" className="underline">
            Eliminar cuenta
          </Link>
          ). Podemos suspender una cuenta que incumpla estos términos; salvo
          casos graves o urgentes, te vamos a avisar antes.
        </p>
      </Section>

      <Section title="Cambios a estos términos">
        <p>
          Si los cambiamos de forma importante, te lo vamos a avisar en la app
          antes de que empiecen a regir. Seguir usando Clippr después de esa
          fecha significa que aceptás la versión nueva.
        </p>
      </Section>

      <Section title="Ley aplicable">
        <p>
          Estos términos se rigen por las leyes de la República del Paraguay.
          Cualquier conflicto se resolverá ante los tribunales ordinarios de la
          República del Paraguay.
        </p>
      </Section>
    </LegalPage>
  );
}
