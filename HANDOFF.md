# HANDOFF: Lumena Workspace

Este documento resume el estado actual del proyecto, las decisiones de diseño tomadas y las instrucciones clave para asegurar la continuidad del desarrollo.

## 1. Objetivo del Proyecto
Lumena es un "intelligent knowledge workspace" (SaaS) enfocado en el aprendizaje y análisis de documentos. Permite a los usuarios subir PDFs, visualizarlos, resaltar texto, chatear con el documento mediante IA y generar herramientas de estudio (flashcards, glosarios, mapas mentales, líneas de tiempo y presentaciones) en base al contenido procesado. Está diseñado desde el principio como una aplicación de producción escalable (multiusuario, multi-organización, con suscripciones y facturación real).

## 2. Estado Actual
El proyecto ha avanzado desde un prototipo a una arquitectura SaaS de grado de producción (Finalizamos hasta la **Fase 22**). Lo que ya está implementado y funcionando:
- **Autenticación:** Flujo completo con Google Auth a través de Supabase.
- **Gestión de Workspaces:** Creación y selección de espacios de trabajo.
- **Procesamiento de Documentos:** Subida de PDFs y pipeline de procesamiento (almacenamiento en Supabase Storage y extracción de texto).
- **Visor de Documentos:** Renderizado de PDFs usando `react-pdf`, con soporte para resaltado.
- **Chat AI (`ai-gateway`):** Un Edge Function en Supabase que gestiona el chat con los documentos, aplicando RAG, historial de sesión, streaming, validación de planes (Free vs Pro) y control de cuotas mensuales de créditos.
- **Monetización y Facturación:** Integración con Stripe Checkout (Edge Function `stripe-webhook`), cuentas de créditos (`credit_accounts`) y libro mayor (`credit_ledger`).
- **Herramientas de Conocimiento Generadas por IA:** Generación en el backend (Edge Function `generate-knowledge`) de Flashcards, Glosarios y Mapas Mentales. El frontend cuenta con vistas dedicadas (ej. `FlashcardsView.tsx`, `MindMapView.tsx`) integradas con Zustand.

## 3. Stack Técnico
- **Frontend:** React, TypeScript, Vite, Tailwind CSS (Vanilla CSS predominante, UI minimalista/glassmorphism), Zustand (estado global), Lucide React (iconos).
- **Backend / BaaS:** Supabase (PostgreSQL, Auth, Storage), Edge Functions (Deno).
- **IA:** Modelos Gemini 1.5 Flash y Gemini 1.5 Pro (vía `@google/generative-ai`).
- **Herramientas de Calidad:** `oxlint` para linting, Playwright para testing E2E.
- **Comandos locales:**
  - Instalar dependencias: `npm install`
  - Servidor de desarrollo: `npm run dev`
  - Linting: `npm run lint`
  - Build: `npm run build`

## 4. Estructura de Archivos Principal
- `/src/components/`: Componentes UI. Carpeta `knowledge/` contiene las vistas (Flashcards, Glossary, MindMap, etc.), `chat/` contiene el sidebar interactivo.
- `/src/stores/`: Manejo de estado con Zustand (`chatStore.ts`, `knowledgeStore.ts`, `billingStore.ts`).
- `/src/repositories/`: Capa de acceso a datos que interactúa con Supabase (ej. `knowledge.repository.ts`, `billing.repository.ts`).
- `/src/pages/`: Rutas principales (`Viewer.tsx`, `Dashboard.tsx`, `Billing.tsx`).
- `/src/types/`: Definiciones de interfaces TypeScript (`billing.ts`, `knowledge.ts`).
- `/supabase/migrations/`: Migraciones de la base de datos PostgreSQL.
- `/supabase/functions/`: Supabase Edge Functions (`ai-gateway`, `generate-knowledge`, `stripe-webhook`).

## 5. Decisiones de Diseño y Arquitectura
- **Backend-First Validation:** Nunca se confía en el frontend para los límites de los planes. El `ai-gateway` verifica la suscripción (`plan_code`) y el balance de créditos antes de invocar a Gemini.
- **Capa de Repositorios:** Toda llamada a Supabase desde el frontend pasa por los `repositories`. Los `stores` de Zustand consumen estos repositorios, manteniendo la UI limpia de lógica de red.
- **Desarrollo por Bloques:** El desarrollo está dividido en Fases estrictas. No se avanza a la siguiente sin que el código de la actual compile (`npm run build`), pase linting (`npm run lint`), y sea verificado.
- **Estética "Premium":** Se evitan los diseños básicos; se implementan componentes con *glassmorphism*, animaciones sutiles e interfaces limpias, priorizando UX moderna.

## 6. Estado de Implementación - Análisis AI

### ✅ Implementado y Funcional
- **TaskQueue**: Cola de tareas con dependencias y status tracking
- **AnalysisJobEngine**: Orquestador con topological sort para ejecución paralela
- **AnalysisCache**: Caché para evitar regeneración de análisis
- **AnalysisEvents**: Sistema de eventos para UI en tiempo real
- **PromptBuilder**: Construcción unificada de prompts para chat, highlights, summary, glossary
- **AIAnalysisService**: Operaciones AI centralizadas con AIGateway
- **BoundingBoxCache**: Caché de coordenadas calculadas
- **TextChunker**: División semántica de texto en chunks
- **CitationEngine**: Parseo de citas [Page X] en respuestas AI
- **AutoHighlightOverlay**: Rendering de highlights AI con colores por categoría
- **14 categorías de highlights**: concept, definition, formula, date, fact, etc.

### ⚠️ Implementación Parcial (Placeholder/Stub)
- **RAGSearch**: Usa Supabase `textSearch` como fallback. **NO tiene embeddings vectoriales reales.** Para RAG completo se necesita:
  - Tabla `document_chunks` con columna `embedding VECTOR(1536)`
  - Proveedor de embeddings (OpenAI text-embedding-3-small u otro)
  - Búsqueda por coseno de similitud
- **OCR en Edge Functions**: `process-document` marca documentos para `client-side OCR` porque `pdfjs-dist` requiere canvas (no disponible en Deno). El OCR real se hace en el cliente usando `react-pdf` TextLayer.
- **process-document Edge Function**: Solo descarga el PDF y lo marca para OCR client-side. No extrae texto real.

### ❌ No Implementado
- Embeddings vectoriales
- Búsqueda semántica real (cosine similarity)
- Extracción de texto en Edge Functions (requiere canvas)

## 7. Problemas Conocidos y Pendientes
- **MCP de Supabase**: La herramienta MCP `apply_migration` falla. Se usa el CLI de Supabase para aplicar migraciones.
- **Tablas creadas desde Edge Function**: El `process-document` creaba tablas en caliente (`CREATE TABLE IF NOT EXISTS`). Esto fue eliminado y se usa únicamente la migración oficial `20240725000001_add_analysis_tables.sql`.

## 8. Próximos Pasos (Fase 24)
1. **Embeddings Vectoriales**: Implementar embeddings reales con OpenAI u otro proveedor para RAG completo.
2. **Búsqueda Semántica**: Reemplazar `textSearch` por búsqueda por cosino de similitud con vectores.
3. **OCR Client-Side**: Implementar `ClientOCRRunner` para extraer texto de PDFs escaneados usando Tesseract.
4. **Frontend (Líneas de Tiempo y Presentaciones):** Conectar `TimelineView.tsx` al `knowledgeStore.ts` e implementar `PresentationsView.tsx`.

## 8. Cosas para NO repetir
- **No crear implementaciones Mock:** Lumena ya no es un prototipo. Toda feature debe conectarse al backend y persistir datos reales.
- **No perder el tiempo con `apply_migration` / `execute_sql` del MCP si sigue fallando de la misma forma:** Buscar vías alternativas como invocar RPCs desde el dashboard de Supabase, usar el CLI local si se configura el token, o que el Edge Function cree las tablas en caliente (`CREATE TABLE IF NOT EXISTS`).
- **No realizar "optimización prematura" ni refactorizar sin sentido:** Mantener la simplicidad.

---

### Mensaje para Claude Code
**Hola Claude Code.**
Antes de tocar cualquier línea de código, lee este documento completo para entender el contexto, las reglas arquitectónicas y el punto exacto en el que nos encontramos.
Es sumamente importante que respetes las decisiones de diseño tomadas hasta ahora (como la separación entre repositories/stores y la validación en backend de los límites). Si el MCP de Supabase sigue fallando para aplicar migraciones, utiliza el CLI de Supabase asumiendo que el usuario te proporcionará el token si hace falta, o pídele al usuario que ejecute el SQL de la migración manualmente. Comienza revisando la Fase 23 (línea de tiempo y presentaciones). ¡Éxito!
