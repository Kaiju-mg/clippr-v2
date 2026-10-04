import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ContactEmail, LegalPage, Section } from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Ayuda · Clippr",
};

function Pregunta({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="border-line group border-b pb-3">
      <summary className="cursor-pointer list-none py-1 font-medium">
        <span className="text-accent-ink mr-1.5 inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        {q}
      </summary>
      <div className="text-muted flex flex-col gap-2 pt-1 pl-4">{children}</div>
    </details>
  );
}

/**
 * Ayuda y soporte (2026-10-04): las preguntas de todos los días, con el
 * nombre que tiene cada botón en la app, y el contacto.
 */
export default function AyudaPage() {
  return (
    <LegalPage title="Ayuda" dated={false}>
      <Section title="La caja">
        <Pregunta q="¿Cómo abro y cierro la caja?">
          <p>
            En <strong>Caja</strong>, escribí cuánta plata hay en el cajón y
            tocá <strong>Abrir caja</strong>. Al terminar el día, tocá{" "}
            <strong>Cerrar caja</strong>: se imprime el ticket con el resumen y,
            si cobraste algo, suma un día a tu racha.
          </p>
        </Pregunta>
        <Pregunta q="¿Cómo cargo un gasto, una propina o una venta?">
          <p>
            En <strong>Caja</strong> están los botones <strong>Ingreso</strong>,{" "}
            <strong>Egreso</strong> y <strong>Vender</strong>. Todo lo que
            cargues aparece en el ticket de movimientos y en el total.
          </p>
        </Pregunta>
      </Section>

      <Section title="Los cortes">
        <Pregunta q="¿Cómo registro un corte?">
          <p>
            En <strong>Inicio</strong>, tocá <strong>Iniciar corte</strong>:
            arranca el temporizador. Al terminar, tocá{" "}
            <strong>Finalizar</strong>, elegí el servicio y{" "}
            <strong>Cobrar</strong>. Para cobrar tenés que tener la caja
            abierta.
          </p>
        </Pregunta>
        <Pregunta q="Arranqué un corte sin querer, ¿cómo lo saco?">
          <p>
            En la tarjeta del temporizador tocá <strong>Descartar</strong> y
            confirmá. No se cobra ni se guarda nada.
          </p>
        </Pregunta>
        <Pregunta q="¿Puedo atender a dos clientes a la vez?">
          <p>
            Sí: podés tener varios temporizadores corriendo. Escribí un nombre
            en “Servicio (opcional)” antes de iniciar para distinguirlos.
          </p>
        </Pregunta>
        <Pregunta q="Se cortó internet, ¿pierdo el corte?">
          <p>
            No. El temporizador sigue andando sin señal y sobrevive aunque
            cierres la app. Lo que no se puede sin señal es cobrar: el botón se
            bloquea y avisa “Sin señal · todavía no se cobró”. Cuando vuelva la
            conexión, cobrás normalmente.
          </p>
        </Pregunta>
      </Section>

      <Section title="La agenda">
        <Pregunta q="¿Cómo agendo un turno?">
          <p>
            En <strong>Agenda</strong>, tocá <strong>Nuevo turno</strong>, elegí
            el servicio y la hora. Los turnos de hoy aparecen también en “Lo que
            viene”, en Inicio, con el botón <strong>Empezar</strong>.
          </p>
        </Pregunta>
      </Section>

      <Section title="Racha, nivel y compartir">
        <Pregunta q="¿Cómo funciona la racha?">
          <p>
            Cada día que cerrás la caja con al menos un cobro suma un día. Si un
            día no trabajás no pasa nada (es el día de gracia), pero si pasan
            dos días sin cerrar caja, la racha vuelve a empezar. Al día 7 el
            poste pasa a oro y al día 30 se enciende.
          </p>
        </Pregunta>
        <Pregunta q="¿Qué es el nivel?">
          <p>
            Depende de cuántos cortes hiciste en los últimos 30 días: Junior,
            Pro, Senior o Élite. Si bajás el ritmo, el nivel baja con vos. Lo
            ves en <strong>Más → Estadísticas</strong>.
          </p>
        </Pregunta>
        <Pregunta q="¿Cómo comparto mi día en el estado de WhatsApp?">
          <p>
            Al cerrar la caja, tocá <strong>Compartir</strong> en el ticket y
            después <strong>Compartir imagen</strong>. Por defecto la imagen no
            muestra montos; si querés, prendé “Mostrar montos”.
          </p>
        </Pregunta>
      </Section>

      <Section title="El equipo y la cuenta">
        <Pregunta q="Soy dueño, ¿cómo agrego a un barbero?">
          <p>
            En <strong>Más → Equipo → Agregar barbero</strong>. La app genera
            una contraseña temporal que se muestra una sola vez: anotala y
            pasásela al barbero.
          </p>
        </Pregunta>
        <Pregunta q="¿Cómo cambio mi contraseña?">
          <p>
            En <strong>Más → Cambiar contraseña</strong>. Te va a pedir la
            actual.
          </p>
        </Pregunta>
        <Pregunta q="¿Cómo elimino mi cuenta?">
          <p>
            En <strong>Más → Eliminar mi cuenta</strong>. Si sos el dueño se
            borra la barbería entera; si sos barbero, tus cortes quedan en la
            caja sin tus datos.
          </p>
        </Pregunta>
      </Section>

      <Section title="Contacto">
        <p>
          ¿Algo no funciona o tenés una pregunta que no está acá? Escribinos a{" "}
          <ContactEmail />.
        </p>
      </Section>
    </LegalPage>
  );
}
