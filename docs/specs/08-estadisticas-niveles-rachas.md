# Spec 08: Estadísticas, Niveles y Rachas (Gamificación)

## 1. Descripción General
Cierre del ciclo de retención y análisis de negocio (Gamificación). Se divide en dos experiencias:
1. **Para el Barbero:** Foco en su rendimiento diario, racha de trabajo y progreso de nivel para mantener la motivación.
2. **Para el Dueño:** Foco en métricas de negocio de toda la barbería (ingresos, cortes, rendimiento del equipo) aislando correctamente los datos.

## 2. Modificaciones en Base de Datos (Migración)
Actualmente, las políticas RLS (Row Level Security) de `cash_sessions`, `appointments` y `transactions` son estrictas: solo el dueño de la fila puede leerlas. Para las estadísticas del negocio, el dueño (`owner`) necesita acceso de lectura a los datos de toda su barbería.

- **Nueva Migración (Schema/RLS):** 
  - Crear una función `SECURITY DEFINER` `public.current_user_role()` que devuelva el rol del usuario autenticado (para evitar recursión RLS al consultar la tabla `users`).
  - Actualizar las policies de `SELECT` de `cash_sessions`, `appointments` y `transactions`. La nueva lógica debe permitir el acceso si: `user_id = current_user_id() OR (barbershop_id = current_barbershop_id() AND public.current_user_role() = 'owner')`.

## 3. Server Actions a Crear / Modificar
Nuevo archivo: `src/actions/stats.actions.ts`.

- **`getBarberStatsAction(dateISO)`**: 
  - Retorna métricas del barbero para el día actual: cantidad de turnos completados, monto recaudado, `streak_count` actual, y `level`.
- **`getOwnerStatsAction(startDateISO, endDateISO)`**: 
  - Retorna métricas de la barbería: ingresos totales, cortes totales, promedio de ingreso diario, y un desglose de rendimiento por barbero (leaderboard).
  - Debe validar internamente que `role === 'owner'` antes de procesar los datos, por seguridad extra sobre RLS.
- **Actualizar `closeCashSessionAction` (en `cash.actions.ts`)**:
  - Al cerrar la caja, calcular si el barbero mantuvo su racha (ej. comparando si tuvo una caja cerrada con transacciones el día anterior). Si sí, `streak_count++`. Si pasó más de 1 día hábil sin caja, `streak_count = 0`.
  - Evaluar si el `streak_count` y/o cantidad de cortes acumulados superan el umbral para subir de nivel (ej. a "Pro") y actualizar `users.level`.

## 4. UI y Componentes (Archivos a tocar)

- **`src/app/(dashboard)/estadisticas/page.tsx`**:
  - Página principal de estadísticas. 
  - Determinar el rol del usuario (`auth.getUser()` + consulta a `users`).
  - Si es Owner: Renderizar `<OwnerDashboard />` (filtros de fecha "Hoy", "Esta Semana", "Este Mes", KPIs principales, tabla de equipo).
  - Si es Barbero: Renderizar `<BarberDashboard />` (KPIs personales, progreso visual hacia el siguiente nivel).
- **`src/app/(dashboard)/inicio/page.tsx`**:
  - Reemplazar el texto estático de las píldoras ("Cortes de hoy y tu racha") integrando `getBarberStatsAction` para mostrar los valores reales de la base de datos para el día en curso.
- **`src/app/(dashboard)/mas/page.tsx`**:
  - Añadir el enlace a "Estadísticas" en la lista de accesos, manteniendo el diseño minimalista de la `BottomNav` sin alterar sus 4 íconos actuales.

## 5. Casos Borde y Consideraciones

1. **Zonas Horarias:** Toda consulta por fecha o rangos de fecha ("hoy", "semana") en los Server Actions debe procesarse utilizando la zona horaria del negocio (`America/Asuncion` en `src/lib/dates.ts`), NUNCA con la fecha UTC del servidor, para no mezclar cortes de madrugada en días equivocados.
2. **Estados Vacíos (Zero-Data):** 
   - Las consultas sin cortes ni cajas en un rango de fechas deben devolver valores `0` manejados de forma segura (prevenir división por cero al calcular promedios). 
   - La UI debe mostrar mensajes como "No hay actividad en este periodo" en lugar de errores o gráficos rotos.
3. **Pérdida de Racha:** La evaluación de racha al cerrar caja debe contemplar fechas reales (`end_time` de la última sesión). Si el barbero cierra la caja a las 2 AM, sigue correspondiendo a la jornada anterior. Se usará la fecha de apertura de caja (`start_time`) para comparar si es un día consecutivo.
4. **Permisos y Privacidad:** Un barbero NO debe poder llamar a `getOwnerStatsAction`. El Server Action debe abortar con un error explícito si `role !== 'owner'`, protegiendo los ingresos de los compañeros.
5. **UI Optimista:** A diferencia de CRUD, los dashboards de estadísticas son de solo lectura. No requieren estado optimista con Zustand ni `useOptimistic`, solo Server Components o llamadas directas.
6. **Gráficos Simples:** Para proteger la velocidad de entrega, evitar dependencias pesadas de gráficos (como Chart.js) en esta iteración. Usar componentes base o barras de progreso estilizadas con Tailwind CSS puro.

---

## 6. Reglas de negocio definidas durante la implementación (2026-09-17)

La spec original dejaba dos cosas sin cerrar. Se consultaron con el usuario
antes de programar y quedaron definidas así (ver `docs/decisiones.md`):

### 6.1 Niveles como "ligas" de 30 días móviles

El nivel **no** es un acumulado histórico irreversible: refleja el
rendimiento de los últimos 30 días, y **puede bajar**. Se evalúa al cerrar
la caja, contando los turnos `completed` del barbero en esa ventana:

| Nivel  | Cortes en los últimos 30 días |
| ------ | ----------------------------- |
| Junior | menos de 40                   |
| Pro    | 40 a 90                       |
| Senior | 91 a 150                      |
| Élite  | más de 150                    |

Los umbrales viven en `src/lib/levels.ts`, no dentro del Server Action, para
poder ajustarlos sin tocar la lógica del cierre de caja y para que la barra
de progreso de la UI muestre la misma escala que se evalúa en el servidor.

### 6.2 Racha con un día de gracia (48 hs)

La app no sabe qué días cierra cada barbería, así que en vez de modelar
"días hábiles" se tolera un hueco de un día. Eso cubre el domingo de una
barbería, el lunes de otra, o el martes que el barbero faltó por un trámite,
sin ninguna configuración por barbería. Al cerrar la caja se compara el día
del negocio (`start_time`, no `end_time`) contra la última **jornada válida**
anterior — una caja cerrada con al menos un ingreso:

| Diferencia con la última jornada | Racha        |
| -------------------------------- | ------------ |
| 0 días (segunda caja del día)     | sin cambio   |
| 1 día (ayer)                      | +1           |
| 2 días (anteayer, día de gracia)  | +1           |
| 3 días o más                      | vuelve a 1   |
| Nunca cerró una caja con ingresos | 1            |

Una caja cerrada sin un solo ingreso no suma ni rompe la racha: no es una
jornada trabajada. La lógica pura vive en `src/lib/streaks.ts`.
