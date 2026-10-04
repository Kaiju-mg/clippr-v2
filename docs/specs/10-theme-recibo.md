# Spec 10: Tema "Recibo de Barbería"

Rediseño de Clippr v2 con la estética del ticket de papel térmico: la app
entera pasa a tener el mismo material que el recibo del cierre de caja.
Cuida que la app siga andando sin conexión, la retención de los barberos y
el rendimiento en celulares de gama media.

**Referencia visual:** muestrario "Clippr en papel"
(https://claude.ai/artifact/SPcyiLDmMkGgM9fPZ7Bcvz), con el interruptor
Hoy / Propuesta y los dos temas. Lo que diga esta spec manda sobre el
muestrario; donde la spec no diga nada, se copia el muestrario.

## Reglas del sistema (valen para todas las fases)

1. **Un solo mundo: papel, tinta, sello y poste.** Los colores salen del
   poste de barbería: blanco → papel, azul → tinta, rojo → sello. Nada de
   neón, espuma, navaja, damero ni libreta (explorados el 2026-10-03 y
   descartados porque cada uno trae su propio material).
2. **El rojo es sólo tinta de sello** y marca algo que ya pasó: cobrado,
   agotado, la racha, el mejor del mes. Nunca un botón, nunca un error
   (los errores siguen con `--danger`).
3. **Punteado sólo donde hay plata o se cuenta algo:** movimientos de
   `/caja`, filas de `/agenda`, el ranking del dueño, las barras de
   progreso y el ticket. Inputs, navegación y el resto de las listas
   siguen con línea lisa.
4. **El ticket es un objeto, no una superficie:** el papel del recibo y la
   imagen para compartir no cambian con el tema (igual que el poste).
5. **Sin texturas** (ruido, granulado, imágenes de papel): el papel se logra
   con color, punteado y tipografía. Mismo motivo por el que se descartó el
   glassmorphism (costo en gama media).
6. **Todo respeta `prefers-reduced-motion`:** sin movimiento, el ticket
   aparece entero y el sello aparece sin caer.

## Fase 1: Los fundamentos (cambio estético global)

*El lienzo de papel. Bajo riesgo, alto impacto inmediato: casi todo sale de
los tokens, los componentes ya los usan.*

- [x] **Tokens de color en `src/app/globals.css`.** No hay
  `tailwind.config` (Tailwind v4): se cambian los **valores** de los tokens
  que ya existen en `:root` y `[data-theme="dark"]` y se registran los
  nuevos en `@theme inline`. **No se renombran** los existentes
  (`bg-background`, `text-accent-ink`, etc. siguen igual en todo el código).

  | Token | Claro | Oscuro | Nota |
  |---|---|---|---|
  | `--background` | `#fffdf6` | `#161412` | Papel / carbón cálido (antes `#ffffff` / `#0f141b`) |
  | `--surface-2` | `#f4efe4` | `#211e1a` | Cubos |
  | `--line` | `#e4ddcd` | `#35302a` | |
  | `--line-strong` | `#c9c0ac` | `#4b453c` | |
  | `--foreground` | `#26231d` | `#f1ece1` | Tinta negra cálida |
  | `--muted` | `#6f685b` | `#a69e8f` | Verificar AA sobre `--surface-2` |
  | `--accent` | `#1f3a5f` | `#3d6da8` | **Sin cambio**: la tinta de marca |
  | `--accent-strong` | `#16283f` | `#5386bf` | Sin cambio |
  | `--accent-contrast` | `#fffdf6` | `#ffffff` | |
  | `--accent-ink` | `#1f3a5f` | `#9dbbe0` | |
  | `--success` | `#2f6b4f` | `#8fd1a8` | |
  | `--warning` | `#b9651b` | `#f2b06b` | Sin cambio |
  | `--danger` | `#a83b32` | `#f0938a` | Sin cambio: errores |
  | `--stamp` **(nuevo)** | `#b3261e` | `#ef8a7f` | Sólo sellos (regla 2) |
  | `--paper` **(nuevo)** | `#fffdf6` | `#f3eedf` | Papel del ticket: claro también en oscuro |
  | `--paper-ink` **(nuevo)** | `#26231d` | `#26231d` | Texto del ticket |
  | `--paper-rule` **(nuevo)** | `#8c867a` | `#8c867a` | Punteado del ticket |

  Sobre el papel del ticket, el sello usa siempre el rojo claro
  (`#b3261e`), porque el papel es claro en los dos temas.
- [x] **`theme-color` del navegador:** actualizar `THEME_BROWSER_COLOR`
  (lo usa `src/app/layout.tsx`) a `#fffdf6` / `#161412`.
- [x] **Tipografía:**
  - **IBM Plex Mono** (500/600) con `next/font/google` en `layout.tsx`,
    variable `--font-plex-mono`, registrada como `--font-mono` en
    `@theme inline` → clase `font-mono`. Elegida sobre Space Mono /
    JetBrains Mono por lo que se lee con sol.
  - `font-mono tabular-nums` **sólo en montos y horas** (todo lo que pasa
    por `formatGuaranies`, horas de turnos y movimientos, cronómetro).
    Títulos, nombres y fechas en palabras ("Sábado 3 de octubre") siguen en
    Inter.
  - **Courier Prime** sólo dentro de `<TicketReceipt />` (Fase 2), cargada
    con `next/font` en ese componente para no sumarla a todas las pantallas.
- [x] **Separadores punteados** según la regla 3: `border-dashed` en las
  filas de `/agenda` y de los movimientos de `/caja`. Las barras de progreso
  (nivel del barbero, ranking del dueño) pasan a "perforado": segmentos de
  5px con 3px de aire, sin bordes redondeados.
- [x] **"Iniciar corte" relleno** (`bg-accent`): pasa a ser el cubo relleno
  de `/inicio`. Revierte el estilo contorno del 2026-09-15; registrar en
  `docs/decisiones.md`.

## Fase 2: El corazón temático (componentes core)

*Los elementos que le dan la identidad.*

- [x] **`<Stamp />`** (`src/components/ui/Stamp.tsx`): texto en mayúsculas,
  `--stamp`, borde de 1.5–2.5px, rotación de −6° a −9°, tamaños `sm`
  (dentro de una fila) y `md`. Animación de "golpe" (escala 2.6 → 0.92 → 1,
  ~0.5s) **sólo al aparecer**, no en cada render. Textos que usa la app:
  - `COBRADO`: filas completadas de `/agenda` (con la fila atenuada).
  - `AGOTADO`: productos con stock 0 en `/productos` (reemplaza "Sin
    stock").
  - `MEJOR DEL MES` (o de la semana o de hoy, según el rango): primer puesto
    del ranking en `/estadisticas` del dueño, sólo si tiene actividad.
  - La racha: en el cierre (ver abajo) y el número de días de racha en el
    `StreakPanel` de `/estadisticas` del barbero, en color `--stamp`.
  - No hay sello "PAGADO" ni "CERRADO".
  - En `/inicio` no hay sello: "Lo que viene" sólo lista turnos pendientes.
- [x] **`<TicketReceipt />`** (`src/components/ticket/`): sólo de
  presentación. Recibe renglones ya calculados, dibuja el papel (`--paper`,
  `--paper-ink`, Courier Prime 11.5px), separadores `--paper-rule`
  punteados, borde inferior en zigzag (gradientes CSS, sin imágenes) y
  ancho máximo ~250px. Lo reusan el cierre, la imagen para compartir y la
  Fase 4.
- [x] **Movimientos de `/caja` como ticket:** la lista va sobre una tarjeta
  `--surface-2` con borde inferior en zigzag, filas punteadas (hora `font-mono`
  en `--muted`, concepto, monto), y cierra con un renglón **TOTAL** igual al
  saldo actual (mismo `computeBalance` que hoy, sin cálculo nuevo en el
  cliente).
- [x] **Resumen del cierre calculado en el servidor** (regla 1 de
  CLAUDE.md): `closeCashSessionAction` hoy devuelve `{ session, streak }`;
  suma `summary`: saldo inicial, cortes (cantidad y total, `category =
  'service'`), ventas (cantidad y total, `'product'`), ingresos manuales,
  egresos y saldo final. El cliente sólo lo dibuja.
- [x] **Animación de cierre** (reemplaza la hoja que sube desde abajo de
  `StreakCelebration`; el store `streakCelebrationStore` se reusa para
  dispararla):
  1. El fondo se oscurece (`rgba(18,16,13,.76)`, fade de ~0.45s).
  2. En el centro aparece la boca de la impresora y el `<TicketReceipt />`
     baja desde ahí renglón por renglón (`steps(14)`, ~2s): `CLIPPR ·
     CIERRE`, fecha y hora, barbero, saldo inicial, cortes, ventas,
     egresos, **TOTAL**.
  3. Al terminar de imprimir cae el sello de la racha sobre el ticket:
     poste chico de un solo color (rayas en `--stamp`) + "**N** DÍAS DE
     RACHA". Debajo, "Mañana va el N+1." si la racha está viva.
  4. Aparecen "Compartir" (contorno color papel) y "Listo" (relleno papel),
     legibles sobre el fondo oscuro. *(Implementado: "Listo". "Compartir"
     se suma con la pantalla de compartir de la fase 3; ver
     `docs/decisiones.md` 2026-10-03.)*
  - Si la racha no se pudo guardar (falta `SUPABASE_SERVICE_ROLE_KEY`, ver
    spec 09), el ticket sale igual, sin sello.
- [x] **Resto de las pantallas del muestrario:**
  - `/agenda`: "Cancelar" y "Cobrar" en un segundo renglón de la fila;
    cancelados tachados y atenuados.
  - `/estadisticas` barbero: número de racha en `--stamp`, barra de nivel
    perforada.
  - `/estadisticas` dueño: barras del ranking perforadas y sello en el
    primero.
  - `/equipo`: el nivel va en el subtítulo ("Pro · mail"), no en una
    píldora aparte.
  - `/mas`: arriba, la barbería como tarjeta (poste, nombre, "Nombre ·
    Rol", plan) con borde punteado.
  - Login y registro: poste + "Clippr" + "Turnos, caja y racha de tu
    barbería", y el formulario sobre una tarjeta papel con borde en
    zigzag.

## Fase 3: Retención y bucle viral (compartir, offline, háptica)

*Donde la estética pasa a ser funcionalidad de negocio.*

- [ ] **Compartir el día en el estado de WhatsApp:**
  - Pantalla o panel "Compartir el día" (se abre desde "Compartir" del
    cierre) con la **vista previa 9:16** de la imagen y el botón "Compartir
    imagen".
  - La imagen se exporta a **1080×1920**, fondo carbón con las rayas del
    poste muy tenues, y no cambia con el tema (regla 4). Contenido del
    ticket "versión cliente": nombre de la barbería, fecha, barbero,
    **cortes por servicio** (`Corte clásico x5`), total de cortes, sello de
    la racha, "Turnos: {teléfono}" si existe, y "Hecho con Clippr" al pie.
  - **Switch "Mostrar montos", apagado por defecto y sin recordar la
    elección:** cada vez que se comparte, arranca apagado. Encendido agrega
    el renglón TOTAL. Nunca se publica plata por accidente.
  - Los cortes por servicio salen del servidor (en el `summary` del cierre
    o en una acción aparte), no se cuentan en el cliente.
  - **La imagen se genera en el teléfono** (`html-to-image` o `<canvas>`),
    sin servidor, así funciona sin conexión.
  - Compartir con Web Share API nivel 2: si `navigator.canShare({ files })`
    da verdadero, `navigator.share({ files: [png] })` abre el menú del
    celular (WhatsApp → Mi estado). Si no, se descarga el PNG.
- [ ] **Teléfono de la barbería: migración nueva.** `barbershops` no tiene
  teléfono. Agregar `phone text null`, editable por el dueño (desde `/mas`,
  en la tarjeta de la barbería). Si es `null`, el renglón "Turnos" no se
  dibuja.
  - **Cerrar el `update` de `barbershops` en la misma migración.** Hoy
    `barbershops_update_own` deja que **cualquier miembro** (también un
    barbero) actualice la fila, incluido `subscription_plan`, desde la
    consola. Mismo patrón que `users` en la spec 09: policy sólo para
    `current_user_role() = 'owner'` + `grant update (name, phone)` (una
    policy no puede mirar qué columna cambió). Probar que un barbero no
    puede cambiar `phone` ni `subscription_plan`, y que el dueño no puede
    cambiar `subscription_plan`.
- [ ] **Estado sin conexión honesto: paso A (esta spec).**
  - **Hoy no existe cola offline.** `timerStore` persiste los
    temporizadores, pero cobrar y cerrar caja son Server Actions que fallan
    sin red. Prometer "se guarda cuando vuelva" sería mentira.
  - Paso A: un store chico de estado de red (`navigator.onLine` + eventos
    `online`/`offline`). Sin señal, la tarjeta del cobro y el cierre
    muestran en `font-mono` "Sin señal · todavía no se cobró" y el botón
    queda deshabilitado; con señal vuelve a la normalidad. Los
    temporizadores siguen andando (regla 4).
  - **Paso B (spec propia, fuera de esta):** cola de cobros pendientes con
    id generado en el cliente para que el servidor no cobre dos veces;
    recién ahí el texto pasa a "Sin señal · se guarda cuando vuelva" y cae
    el sello al sincronizar.
- [ ] **Háptica:** `navigator.vibrate` con un pulso corto (~30ms) al caer
  el sello de COBRADO y un patrón de "impresora" (`[40,60,40,60,40]`)
  durante la impresión del cierre. Switch "Vibración" en `/mas`, guardado en
  `localStorage` (es por dispositivo) y prendido por defecto. Donde no hay
  soporte (iPhone) no hace nada. **Sin sonidos:** no se acordaron.

## Fase 4: Vistas expandidas (dueño y estadísticas)

*Pantallas nuevas con el sistema ya armado. Ninguna necesita migración:
usan `cash_sessions` y `transactions`, que el dueño ya puede leer desde
`20260917000000_owner_stats_visibility.sql`.*

- [ ] **Pantallas vacías:** `<BlankTicket text="…" />` (un ticket en
  blanco con una línea a máquina) reemplaza los textos sueltos de "Todavía
  no hay…" en `/agenda`, `/productos`, `/servicios`, `/equipo`, movimientos
  de `/caja` y "Lo que viene" de `/inicio`.
- [ ] **Cierres del equipo (dueño):** en `/estadisticas` del dueño, sección
  "Cierres de hoy" con un `<TicketReceipt />` por barbero que cerró, en
  fila con scroll horizontal en el celular. El resumen lo arma el servidor
  con la misma función que el `summary` del cierre. Ojo: estas consultas
  filtran `user_id` a mano (la RLS de esas tablas ya no acota a lo propio
  para el dueño, ver spec 08).
- [ ] **Ticket del mes:** en `/estadisticas` del barbero, durante los
  primeros días del mes, el ticket del mes anterior: cortes, servicio más
  pedido, mejor día y racha más larga (calculada en el servidor desde los
  cierres del mes, con la misma regla del día de gracia de
  `src/lib/streaks.ts`). Se comparte con el mismo flujo de la Fase 3, sin
  montos por defecto.
- [ ] **Tarjeta de sellos de la racha:** grilla del mes en `/estadisticas`
  del barbero, un casillero por día. Cada día con caja cerrada y al menos
  un cobro (mismo criterio que la racha) lleva un `<Stamp />`. Los días 7 y
  30 de la racha marcan el poste de oro y el encendido (niveles que ya
  existen, sin reglas nuevas).

## Fase 5: Pulido final

- [ ] **Ícono de la app y pantalla de arranque:** el poste sobre fondo
  papel. `public/manifest.json` pasa de `#0a0a0a` a `background_color:
  "#fffdf6"` y `theme_color: "#fffdf6"`. Íconos 192/512 + versión
  `maskable` + `apple-touch-icon`.

## Fuera de alcance

- Cola offline de cobros (paso B de la Fase 3): spec propia.
- Sonidos.
- Texturas de papel, y los objetos descartados del muestrario (neón,
  espuma, navaja, damero, libreta).
- `/servicios` no tiene cambios propios: hereda tokens, punteado y
  `<BlankTicket />`.

## Pruebas

- **Vitest:**
  - El `summary` del cierre: totales por categoría y saldo final igual a
    `computeBalance`.
  - Cortes por servicio.
  - La imagen para compartir **no incluye montos** con el switch apagado
    (y sí el TOTAL encendido).
  - El estado de red deshabilita el cobro sin señal.
  - `navigator.vibrate` ausente no rompe nada.
  - `<Stamp />` sólo anima al montar.
- **Migración de `barbershops`:**
  - Un barbero no puede actualizar `phone` ni `subscription_plan`.
  - El dueño sí puede actualizar `name` y `phone`, pero no
    `subscription_plan`.
  - Revocar a `anon` cualquier función nueva (regla del 2026-09-20).
- **Navegador, contra el proyecto real, en los dos temas:**
  - Cierre completo con el ticket y el sello.
  - Compartir en un Android real hasta el estado de WhatsApp.
  - Modo avión durante un cobro.
  - Contraste AA de `--muted` sobre `--surface-2`.
- `npm run lint && npm run typecheck && npm test` y `npm run build` antes de
  cerrar cada fase.

## Documentación al terminar

- `docs/decisiones.md`:
  - La paleta papel/tinta/sello reemplaza el blanco frío y el oscuro azul
    del 2026-09-20.
  - "Iniciar corte" relleno.
  - La regla del rojo.
  - Por qué el "sin señal" no promete guardar.
  - El cierre de `barbershops`.
- `docs/arquitectura.md`: sección "Tema Recibo" (tokens, `Stamp`,
  `TicketReceipt`, `summary` del cierre, compartir).
- `CLAUDE.md`: estado actual de la spec 10.
- `docs/deuda-tecnica.md`: el paso B (cola offline) mientras no exista.
