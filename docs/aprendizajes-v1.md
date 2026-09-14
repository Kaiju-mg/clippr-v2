# Post-mortem Clippr v1: Aprendizajes y Análisis

## Qué funcionaba bien

- **Flujo de "Walk-ins" intuitivo:** La experiencia para registrar clientes sin cita previa es rápida y visual, apoyándose en un temporizador de gran tamaño.
- **Persistencia local del estado:** El uso de `zustand` con el middleware `persist` en `timerStore.ts` es una excelente decisión para evitar que un barbero pierda el progreso de su temporizador si recarga accidentalmente la página.
- **Modelo de datos sólido:** Las entidades de base de datos reflejan bien la realidad del negocio, separando correctamente `Barbershop`, `Barber`, `CashSession` y `Appointment`.
- **Gamificación integrada:** El concepto de rachas diarias (`streaks`) y niveles de barberos (Junior, Pro, Senior, Elite) fomenta la retención y el uso diario de la aplicación por parte del personal.

## Decisiones de diseño problemáticas

- **Lógica de "Demo Mode" acoplada:** Existen decenas de condicionales `if (DEMO)` intercalados directamente en la lógica de los componentes de UI y hooks (`useCashSession`, `ClientForm`, `page.tsx`). Esto ensucia la base de código. Para v2, se debería usar inyección de dependencias o un patrón de Repositorio/Servicios que devuelva datos falsos según el entorno.
- **Un único timer global:** El `timerStore` solo soporta un `activeTimer` a la vez. En la vida real, un barbero podría aplicar un tinte (que toma 30 minutos de espera) y, mientras tanto, registrar o atender a otro cliente. La limitación de un solo servicio en curso bloquea estos casos de uso.
- **Lógica de negocio crítica y cálculos en el cliente:** Las actualizaciones de estado sensibles (como marcar un turno como `completed`, calcular el nuevo total de la caja en `useCashSession` y actualizar la racha del barbero en `timer/page.tsx`) se ejecutan directamente en el frontend.
  - Esto es propenso a **condiciones de carrera** (si dos dispositivos del mismo barbero facturan al mismo tiempo, el `balance` se sobrescribirá mal al calcularse en memoria).
  - Presenta un riesgo de seguridad, ya que cualquier usuario puede alterar las peticiones HTTP y manipular la caja o su propia racha. En v2, esto debe manejarse mediante Triggers de base de datos o Server Actions/RPCs.
- **Reglas de negocio y precios en código (Hardcoding):** Los planes (Pro, Equipo) y sus precios (ej. `75_000`, `150_000`) están hardcodeados en `lib/plans.ts`. Cualquier cambio en la estrategia de precios requeriría modificar el código fuente y hacer un redespliegue.

## Requisitos del negocio inferidos del código

- **Modelo Multi-Tenant (B2B2C):** El sistema da soporte a múltiples barberías (`Barbershop`), donde cada una puede tener su propio equipo de barberos.
- **Roles y jerarquías:** Los usuarios pueden ser `owner` (dueño), `barber` (empleado/equipo) o `independent` (alquila silla o trabaja solo).
- **Gestión de caja individual:** A diferencia de una caja centralizada, el sistema abre una "Sesión de Caja" (`CashSession`) diaria **por barbero**. Cada profesional rinde sus propios ingresos, egresos y propinas al final del día.
- **Tipos de atención:** Se atienden tanto turnos agendados previamente (`scheduled`) como clientes espontáneos (`walkin`).
- **Control de stock básico:** Existe necesidad de manejar productos físicos, con alertas de bajo stock (`low_stock_alert`).
- **Sistema de comisiones:** Los barberos tienen asignado un porcentaje de comisión (`commission_pct`), lo que indica que el sistema debe poder generar reportes para el pago de salarios a fin de mes/semana.
- **Monetización vía SaaS:** Clippr se monetiza cobrando suscripciones a las barberías según los features que usan (niveles Trial, Pro, y Equipo).
