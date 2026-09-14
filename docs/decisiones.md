## 2026-09-09 — Turnos como rango, no como slot fijo
Elegido: guardar inicio y fin en el turno.
Descartado: slots de 30 min predefinidos.
Por qué: los cortes de barba varían entre 20 y 60 min y los slots
fijos desperdiciaban agenda.
Costo: las consultas de disponibilidad son más complejas.

## 2026-09-09 — Vitest como runner de tests, no Jest
Elegido: Vitest + Testing Library.
Descartado: Jest con `next/jest`.
Por qué: Vitest es ESM-nativo y arranca sin transpilación aparte, así
que juega bien con Tailwind v4 y la config de Vite sin el setup de Babel
que arrastra Jest. Un solo runner para tests de servidor y de componentes.
Costo: menos ejemplos oficiales de Next con Vitest que con Jest; los
Server Components asíncronos todavía no tienen un patrón de test cómodo
en ninguno de los dos.

## 2026-09-09 — Quedarse en Next.js 15, no saltar a la 16
Elegido: fijar `next@^15` en el scaffolding.
Descartado: arrancar directamente en Next 16 (ya disponible).
Por qué: la 15 está estable y con soporte; la 16 traía breaking changes
que no quería absorber junto con el arranque del proyecto.
Costo: `npm audit` reporta vulnerabilidades (esbuild/vite/postcss, todas
de tooling de dev/build, no de runtime de producción) que sólo se limpian
subiendo a la 16. Revisar la migración cuando haya algo de lógica real.
