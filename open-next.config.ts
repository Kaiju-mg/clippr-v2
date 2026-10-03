import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Sin caché incremental (R2): todas las pantallas son dinámicas (leen la
// cookie de sesión), así que no hay páginas ISR que guardar.
export default defineCloudflareConfig({});
