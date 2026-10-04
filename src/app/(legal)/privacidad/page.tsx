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
  title: "Política de Privacidad · Clippr",
};

/**
 * Política de Privacidad (2026-10-04). Describe lo que la app hace de
 * verdad: si cambia qué se guarda o con quién se comparte, hay que
 * actualizar este texto y `LEGAL.version`.
 */
export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de Privacidad">
      <p>
        Clippr es una aplicación para que las barberías lleven sus turnos, su
        caja y el rendimiento de su equipo. Esta política explica qué datos
        guardamos, para qué, con quién los compartimos y cómo podés pedir que
        los corrijamos o los borremos.
      </p>

      <Section title="Quién es el responsable">
        <p>
          El responsable de los datos y prestador del servicio es{" "}
          {LEGAL.responsable}, con domicilio en {LEGAL.pais}. Para cualquier
          consulta sobre tus datos escribí a <ContactEmail />.
        </p>
      </Section>

      <Section title="Qué datos guardamos">
        <p>
          <strong>Del dueño de la barbería:</strong> nombre, email, contraseña
          (la guardamos cifrada; nadie puede leerla), nombre de la barbería y,
          si lo carga, su teléfono para turnos.
        </p>
        <p>
          <strong>De cada barbero:</strong> nombre y email (los carga el dueño
          al darlo de alta), contraseña, nivel, porcentaje de comisión y racha
          de días trabajados.
        </p>
        <p>
          <strong>De la operación de la barbería:</strong> servicios y productos
          con sus precios, turnos agendados y cortes realizados, aperturas y
          cierres de caja, cobros, ventas, ingresos y egresos.
        </p>
        <p>
          <strong>De los clientes de la barbería:</strong> sólo el nombre, y
          sólo si el barbero lo escribe al agendar o cobrar. No pedimos
          teléfono, email ni ningún otro dato de los clientes. La barbería es
          quien decide cargarlos y quien tiene que informarles; para esos datos,
          Clippr sólo los guarda por cuenta de la barbería.
        </p>
        <p>
          <strong>En tu teléfono:</strong> los temporizadores en curso y la
          preferencia de vibración se guardan en el almacenamiento del navegador
          del dispositivo, y no salen de ahí hasta que cobrás.
        </p>
        <p>
          <strong>Registros técnicos:</strong> como cualquier sitio web, el
          servidor registra datos de cada pedido (dirección IP, navegador, hora
          y página) para que el servicio funcione y para detectar errores o
          abusos. Se borran solos a los pocos días.
        </p>
      </Section>

      <Section title="Para qué los usamos">
        <Bullets>
          <li>
            Para prestar el servicio: mostrarte tu agenda, tu caja y tus
            estadísticas.
          </li>
          <li>
            Para la seguridad de las cuentas y para separar los datos de cada
            barbería.
          </li>
          <li>Para responder tus consultas de soporte.</li>
        </Bullets>
        <p>
          No vendemos datos, no mostramos publicidad y no usamos herramientas de
          analítica de terceros.
        </p>
      </Section>

      <Section title="Con quién los compartimos">
        <p>
          Sólo con los proveedores que necesitamos para que Clippr funcione, que
          los tratan por cuenta nuestra:
        </p>
        <Bullets>
          <li>
            <strong>Supabase</strong>: base de datos y cuentas de usuario
            (inicio de sesión).
          </li>
          <li>
            <strong>Cloudflare</strong>: aloja la aplicación y la entrega por
            internet.
          </li>
        </Bullets>
        <p>
          Sus servidores pueden estar fuera de Paraguay, por lo que tus datos
          pueden guardarse en otros países. Dentro de la barbería, el dueño ve
          la actividad de su equipo (cortes, cobros, cajas y los emails de sus
          barberos); un barbero ve lo suyo y no ve los emails de sus compañeros.
        </p>
        <p>
          Si usás “Compartir el día” o “Compartir el mes”, la imagen se arma en
          tu teléfono y la compartís vos, con la aplicación que elijas. Por
          defecto no incluye montos.
        </p>
      </Section>

      <Section title="Cuánto tiempo los guardamos">
        <p>
          Mientras tu cuenta exista. Cuando la eliminás (desde{" "}
          <strong>Más → Eliminar mi cuenta</strong>):
        </p>
        <Bullets>
          <li>
            <strong>Si sos el dueño</strong>, se borra la barbería entera: sus
            turnos, cajas, cobros, servicios, productos y las cuentas de todo el
            equipo.
          </li>
          <li>
            <strong>Si sos barbero</strong>, se borran tu email y tu contraseña
            y tu nombre se reemplaza por “Barbero eliminado”. Los cortes y
            cobros que hiciste quedan en la caja de la barbería, sin tus datos,
            porque son registros de ese negocio.
          </li>
        </Bullets>
        <p>
          Más detalles en{" "}
          <Link href="/eliminar-cuenta" className="underline">
            Eliminar cuenta
          </Link>
          .
        </p>
      </Section>

      <Section title="Tus derechos">
        <p>
          Podés pedir acceso a tus datos, que los corrijamos o actualicemos, o
          que los borremos. Muchos los podés corregir vos mismo desde la app;
          para el resto escribí a <ContactEmail /> y te respondemos lo antes
          posible. Estos derechos se reconocen en la Constitución Nacional
          (hábeas data) y en la legislación paraguaya sobre información de
          carácter privado.
        </p>
      </Section>

      <Section title="Seguridad">
        <p>
          Toda la comunicación viaja cifrada (HTTPS), las contraseñas se guardan
          cifradas y la base de datos separa los datos de cada barbería: nadie
          de otra barbería puede ver los tuyos. Ningún sistema es infalible; si
          detectamos un problema que afecte tus datos, te lo vamos a avisar.
        </p>
      </Section>

      <Section title="Cookies y almacenamiento en el dispositivo">
        <p>Clippr usa sólo lo estrictamente necesario para funcionar:</p>
        <Bullets>
          <li>
            Una cookie de sesión, para que no tengas que iniciar sesión cada
            vez.
          </li>
          <li>
            Una cookie con tu tema elegido (claro u oscuro), para mostrarlo sin
            parpadeos.
          </li>
          <li>
            El almacenamiento del navegador para los temporizadores y la
            preferencia de vibración.
          </li>
        </Bullets>
        <p>
          No usamos cookies de publicidad ni de analítica, por eso no te pedimos
          consentimiento para ellas.
        </p>
      </Section>

      <Section title="Menores de edad">
        <p>
          Clippr es una herramienta de trabajo para barberías y no está dirigida
          a menores de 18 años.
        </p>
      </Section>

      <Section title="Cambios a esta política">
        <p>
          Si cambiamos algo importante te lo vamos a avisar en la app antes de
          que empiece a regir. La fecha de arriba indica la última versión.
        </p>
      </Section>
    </LegalPage>
  );
}
