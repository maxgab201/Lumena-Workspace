# Estado real y plan — 2026-10-16

Escrito después de la revisión completa de `main` (`995b5ae`): seguridad, backend, UI/UX y accesibilidad.
El `ROADMAP.md` marca 45 de 67 bloques como hechos, pero su última fecha de cierre es el **2026-07-11** y varios
tildes ya no reflejan la realidad (en los dos sentidos). Este documento contrasta cada fase contra lo que se
**verificó** (código, base de datos de producción, navegador real), y dice qué falta y en qué orden.

> `docs/project-status.json` sigue diciendo "Final preview/manual reader review before merging the feature
> branch": está desactualizado. No lo toqué (alimenta los bloques automáticos de los `.md`); la propuesta de
> actualización está en la sección 7.

## 1. Resumen en una mirada

| Área | Estado | Evidencia |
|---|---|---|
| Núcleo de lectura (subir, procesar, visor, anotaciones, búsqueda, páginas lógicas, resaltado IA, chat) | **Sólido** | 0 errores de consola y 0 desborde horizontal en 8 pantallas, escritorio y móvil, en navegador real |
| Calidad automática | **Buena** | lint, tipos, build y tests pasan; CI con 7 checks; `pnpm audit --prod` limpio. Cobertura 32 % de sentencias (piso 19 %) |
| Seguridad | **Mejorada, con deuda** | 1 fuga entre workspaces corregida y desplegada; credenciales públicas neutralizadas; ver sección 3 |
| Accesibilidad | **En marcha** | violaciones críticas 10 → 0; faltan contraste (80 elementos), anidados y traducciones |
| Backend | **Funciona, sin red de seguridad** | sin tareas programadas, cobro del chat "a mano", historial de migraciones desincronizado |
| Producto (herramientas de conocimiento, billing) | **Construido pero no usable** | un usuario gratis ve un error de créditos; **0 pagos** procesados; Stripe sin configurar |
| Usuarios reales | **Pre-lanzamiento** | 8 cuentas en producción, 1 real; 27 documentos |

## 2. Roadmap contra realidad

| Fase | Roadmap | Realidad verificada |
|---|---|---|
| 0 Inspección / validación / bootstrap | 0/3 | Hecho en la práctica (marca vieja) |
| 1 Fundación | 4/4 | OK |
| 2 Autenticación | 5/5 | Email + contraseña OK. **No hay login con Google** (el `HANDOFF.md` dice que sí). Política débil: contraseña mínima 6, sin confirmación de email, protección de contraseñas filtradas apagada |
| 3 Workspaces | 5/5 | OK con un solo dueño. Sin invitaciones, y el rol `viewer` existe pero las políticas RLS de escritura no lo distinguen. Sin tope de workspaces por usuario |
| 4 Documentos | 5/7 | Subida, almacenamiento (privado, 50 MiB, solo PDF forzado por el servidor), visor y virtualización OK. **Búsqueda (4.6) y mapeo de páginas (4.7) están implementados** (figuran pendientes). Falta resaltar el resultado dentro del texto |
| 5 Extracción | 4/4 | OK (texto nativo + OCR en el navegador). Un PDF escaneado **nunca se indexa para búsqueda semántica** después del OCR |
| 6 Gateway de IA | 5/5 | Gateway, proveedores y ruteo OK. Los créditos (6.5) se descuentan con lectura-cálculo-escritura sobre `credit_accounts` y hay un bypass fijo `ALPHA_UNMETERED = true` |
| 7 Resaltado | 4/4 | OK |
| 8 Chat | 3/4 | OK. Las referencias/citas (8.3) están implementadas (figuran pendientes) |
| 9 Billing | 4/4 | **Construido pero nunca ejercido**: 0 pagos, 0 compras, Stripe sin configurar. El contrato de checkout estaba roto (corregido en esta revisión). `stripe-webhook` está desplegado con `verify_jwt: true`, lo que rechazaría las llamadas de Stripe |
| 10 Herramientas de conocimiento | 5/5 | La interfaz existe. La función tenía la fuga entre workspaces (corregida). Los workspaces nuevos tienen **0 créditos** y la función exige 10, así que un usuario gratis solo recibe un error. Usa solo los primeros 8000 caracteres del documento. Las 4 tablas tienen 0 filas: nunca se generó nada |
| 11 Podcasts / Infografías / Presentaciones / Grafo | 1/4 | No empezados, salvo Presentaciones: interfaz lista, tabla inexistente y función apagada por flag |
| 12 Endurecimiento | 0/7 | Seguridad y accesibilidad **empezadas** con esta revisión. Sin caché, SEO, analítica ni monitoreo |
| 13 Lanzamiento | 0/6 | No empezado |

## 3. Qué falta, en orden

Tamaños: **S** horas, **M** 1-3 días, **L** más de una semana. Responsable: **C** Claude, **D** dueño (hace falta una
decisión o una acción en un panel al que no tengo herramienta), **C+D** ambos.

### Ahora (antes de invitar a nadie)

| # | Qué | Tam. | Quién |
|---|---|---|---|
| A1 | Mergear el PR de esta revisión | S | D |
| A2 | Borrar la función `stream-test` (demo, desplegada a mano, no está en el repo): Panel de Supabase → Edge Functions | S | D |
| A3 | Política de Auth: contraseña mínima 8+, confirmación de email obligatoria, protección de contraseñas filtradas (plan Pro). Hoy cualquiera crea cuentas con cualquier email sin verificarlo | S | D |
| A4 | Confirmar el email de soporte real. La página Legal y Settings muestran `support@lumena.app`; si no controlás ese dominio, los pedidos de privacidad le llegan a un tercero | S | D |
| A5 | Reconciliar el historial de migraciones (sección 4) | M | C+D |
| A6 | Tope de workspaces por usuario y cuota de IA **por usuario** (hoy son 50 pedidos por día **por workspace**: un usuario puede multiplicarla creando workspaces) | S | C |
| A7 | Cambiar la contraseña de la cuenta QA que se usa para las pruebas en producción por una fuerte (hoy es trivial de adivinar) | S | D |

### Después (cerrar el núcleo)

| # | Qué | Tam. | Quién |
|---|---|---|---|
| B1 | Rehacer el cobro de créditos sobre las funciones atómicas que ya existen en la base (`reserve_credits`, `settle_credits`, `release_credits`) y quitar `ALPHA_UNMETERED`. Ninguna función las usa salvo `grant_credits` en el webhook. Es requisito de Billing y de las herramientas de conocimiento | M/L | C |
| B2 | Tareas programadas en el servidor (`pg_cron`, hoy no está instalado): liberar trabajos atascados, vencer reservas y créditos, arreglar documentos sin trabajo (hay uno en `processing` desde el 24/08 y otro en `uploading` desde el 02/09). Requiere habilitar la extensión | M | C+D |
| B3 | Embeddings: decidir proveedor y plan (la cuota gratis es de 100 pedidos por minuto), reindexado automático e indexar los escaneados después del OCR | M | C+D |
| B4 | Traducciones completas: ~305 textos visibles están escritos a mano en 38 archivos, mezclados en inglés y español (la Landing y el Sidebar en inglés, el lector en español). Más un test que impida textos nuevos fuera de `t()` | L | C |
| B5 | Contraste (3 valores de color, sección 6), tarjetas con controles anidados dentro de un `role="button"`, jerarquía de encabezados, nombres únicos de landmarks, etiquetas accesibles que no incluyen el texto visible | M | C+D |
| B6 | Autoalojar los mapas de caracteres y fuentes de pdf.js (hoy desde `unpkg.com`) y los archivos del OCR (worker, núcleo WASM y datos de idioma, hoy desde CDN) y definir una CSP real (hoy solo `frame-ancestors`) | M | C |
| B7 | Realtime: publicar las tablas necesarias (hoy ninguna está en la publicación, nunca llega un evento) o aceptar el refresco al volver a la pestaña | S | D |
| B8 | `stripe-webhook` con `verify_jwt: false` (valida la firma de Stripe por su cuenta) y una prueba de punta a punta en modo test de Stripe | S | C+D |
| B9 | Cobertura: páginas (Settings, Reset, Legal) 0 %, stores ~40 %, repositorios ~37 %. Sumar una prueba E2E contra un backend real en CI | M | C |
| B10 | RLS por rol (`viewer` no debe escribir ni subir archivos) antes de agregar invitaciones | S | C |
| B11 | `generate-knowledge`: usar el documento completo (por fragmentos) en vez de 8000 caracteres, y que cobre con las funciones atómicas | M | C |

### Funciones nuevas (según `project-status.json`)

1. Resaltado del resultado de búsqueda dentro del texto y navegación semántica más rica.
2. Herramientas de conocimiento realmente usables (B1 y B11 primero) y coherentes en la interfaz: el Sidebar las marca "Soon" mientras el visor ya las ofrece.
3. Presentaciones: tabla en la base más activar `VITE_FEATURE_PRESENTATIONS`.
4. Podcasts, Infografías, Grafo de conocimiento (Fase 11).
5. Invitaciones y colaboración (requiere B10).

### Antes del lanzamiento (Fases 12 y 13)

- **Monitoreo de errores y alertas**: hoy no hay nada (ni Sentry ni equivalente en `package.json`); con tráfico real los errores se perderían.
- Copias de seguridad y una restauración probada.
- SEO: `index.html` solo tiene `<title>`; faltan descripción, Open Graph, `robots.txt` y sitemap.
- Analítica y prueba de carga.
- Billing de punta a punta en modo test de Stripe, y recién después pasar a producción.
- Revisión legal (dominio, correo de privacidad, términos) y actualización de la documentación.

## 4. Decisiones que solo puede tomar el dueño

1. **Historial de migraciones.** El historial aplicado en producción y los archivos del repo difieren: 11 migraciones tienen otro número de versión (se renombraron los archivos después de aplicarlas; el contenido coincide, verificado), 8 están aplicadas pero sin registro (sus tablas, funciones y columnas existen: verificado) y 4 registros de producción no tienen archivo (`mggx_keys_*`, una prueba creada y borrada el mismo día, y dos pasos intermedios ya consolidados). Un `supabase db push` contra producción intentaría reaplicar todo eso. La reparación es solo de metadatos del historial, pero **modifica el registro de migraciones de producción** y la herramienta de permisos bloqueó que la hiciera yo. Opciones: (a) la hace el dueño con `supabase migration repair`, (b) autorizar explícitamente que la haga yo con una sola transacción que aborta si algo no coincide.
2. Política de Auth (A3) y plan de Supabase (la protección de contraseñas filtradas pide plan Pro).
3. Email de soporte (A4).
4. Embeddings: seguir en el plan gratis de Gemini (100 pedidos por minuto, documentos de más de ~100 fragmentos quedan parcialmente indexados), pasar a un plan pago, o bajar la granularidad.
5. Habilitar `pg_cron` (B2) y publicar tablas en Realtime (B7).
6. Colores de marca (sección 6): oscurecer el azul y el texto secundario cambia el aspecto de toda la aplicación.
7. Cuentas de prueba: 2 están bloqueadas (no borradas); hay otras 5 de prueba en la base de producción (de las cuales ninguna tiene su contraseña en el repo). Decidir si se borran.

## 5. Lo que cambió con esta revisión

- Fuga entre workspaces en `generate-knowledge`: corregida y desplegada (v15), con test que cubre las 4 funciones que leen documentos como `service_role`.
- Credenciales de una cuenta de producción en un repo público: cuentas bloqueadas, archivos leen del entorno.
- `react-router` 7.18.4 (auditoría de producción limpia). Imágenes del modelo bloqueadas en el chat. Email de usuarios ya no se envía a un tercero.
- Mensajes de error de las Edge Functions (402, 503, 404...) llegan al usuario; el aviso honesto de "pagos no disponibles" funciona; el checkout manda el contrato correcto.
- Accesibilidad: críticas 10 → 0, moderadas 32 → 10. Recarga automática tras un deploy con chunks viejos.

## 6. Valores de color propuestos (accesibilidad AA, 4,5:1 para texto normal)

| Caso | Hoy | Propuesta | Contraste |
|---|---|---|---|
| Botón azul de marca con texto blanco | `#2773fd` = 4,24 | `#1d6cfd` | 4,55 |
| Botón azul de la Landing | `#3c81fd` = 3,65 | el mismo `#1d6cfd` | 4,55 |
| Azul como texto sobre fondo claro `#e5eeff` | `#2773fd` = 3,63 | `#0256ef` | 5,03 |
| Texto secundario, tema claro, sobre `#e5eeff` | `#71717a` = 4,14 | `#6b6b74` | 4,52 |
| Texto secundario, tema oscuro, sobre negro | `#71717a` = 4,35 | `#8a8a94` | 6,14 |
| Ítems "Soon" del Sidebar, hoy a 50-60 % de opacidad | 1,80 y 2,10 | texto con el secundario del tema oscuro y `aria-disabled` | 6,14 |

## 7. Propuesta para `docs/project-status.json` (sin aplicar)

- `in_progress`: reemplazar por "Hardening posterior a la revisión completa (seguridad, accesibilidad, backend)".
- `next`: sumar "Rehacer el cobro de créditos sobre funciones atómicas", "Tareas programadas en el servidor",
  "Traducciones completas", "Auth: confirmación de email y política de contraseñas".
- `current_checkpoint`: "Post-review hardening".

## 8. Reglas para que no se repita

- **Jamás credenciales en el repo** (es público y el historial las conserva): variables de entorno, `.env.example` documentado.
- **Nunca renombrar una migración después de aplicarla.** Si se aplicó con el MCP (que asigna su propio timestamp), renombrar el archivo al `version` que quedó en el historial, no al revés.
- Toda Edge Function nueva visible al usuario entra en `tests/unit/edge-functions-authz.test.ts` (el test ya falla si olvidás listarla).
- Todo texto nuevo pasa por `t()`; pasar axe antes de cerrar un bloque de interfaz.
- Una función que lee con `service_role` valida **ella** que el recurso pertenece al workspace del que llama: RLS no la protege.

## 9. Cómo se verificó y qué no

Verificado: en esta revisión se leyeron completas `generate-knowledge`, `ai-highlight`, `create-highlights`,
`ai-config`, `create-checkout-session` y `stripe-webhook`; `ai-gateway` y `process-document` se revisaron a fondo en
rondas anteriores y esta vez se leyeron las partes de créditos y de autorización; `rag-retrieve` solo se comprobó por
comportamiento. Comparadas byte a byte contra producción: `process-document`, `ai-gateway` y `generate-knowledge`; las
demás desplegadas no se compararon programáticamente. Además: políticas RLS, buckets, índices, extensiones y asesores
de Supabase; auditoría de dependencias; axe-core 4.14 en navegador real (escritorio y 390 px) sobre 8 pantallas, antes
y después; pruebas funcionales de las correcciones contra producción con una cuenta QA propia.

No verificado: Realtime y WebSockets (el proxy del entorno no los soporta); iOS Safari y pantallas retina; una
reconstrucción de la base desde cero con las migraciones (no hay Docker); el camino negativo de la fuga entre
workspaces **no se ejerció en vivo** a propósito, solo por código y por un test estático; la ruta `presentation`
de `generate-knowledge` no deja rastro, así que no se puede descartar un uso anterior de la fuga; los registros de
funciones cubren solo el último día.
