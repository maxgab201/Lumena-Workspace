# Lumena Workspace — Estado del Proyecto

> Última actualización: 2026-07-24

---

## ¿Qué es Lumena Workspace?

Lumena Workspace es una plataforma SaaS para trabajar con documentos y PDFs utilizando inteligencia artificial. Permite a los usuarios subir documentos, extraer texto automáticamente, buscar contenido semánticamente, chatear con IA sobre el contenido del documento, y generar conocimiento estructurado (flashcards, glosarios, mapas mentales).

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite 8 + Tailwind 4 |
| Estado | Zustand |
| Routing | React Router 7 |
| UI Components | Radix UI + Lucide Icons |
| PDF Viewer | pdfjs-dist 5.4 + react-pdf 10 |
| OCR Client-side | tesseract.js 7.0 |
| Testing | Playwright (E2E) + Vitest (unit) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| AI | OpenAI (embeddings), Google Gemini + OpenAI (chat) |
| Billing | Stripe (checkout + webhooks) |
| Hosting | Vercel |

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                     LUMENA WORKSPACE                        │
├─────────────────────────────────────────────────────────────┤
│                      CLIENT (React)                         │
│  Pages: Landing, Auth, Dashboard, Viewer, Billing, Settings │
│  PDF Viewer: Virtualizado, Multi-overlay (OCR/AI)          │
│  Provider Framework: Registry + Router + Fallback           │
├─────────────────────────────────────────────────────────────┤
│                    STATE (Zustand)                          │
│  userStore | workspaceStore | viewerStore | uiStore         │
│  chatStore | highlightStore | knowledgeStore | billingStore │
│  pageRegistryStore                                          │
├─────────────────────────────────────────────────────────────┤
│                  REPOSITORIES (8 repos)                     │
│  auth | workspace | document | highlight | knowledge       │
│  chat | billing | settings | chunk                         │
├─────────────────────────────────────────────────────────────┤
│                    SUPABASE                                 │
│  PostgreSQL (35+ tables) | Auth | Storage | Realtime       │
│  6 Edge Functions (Deno)                                   │
│  RLS policies en todas las tablas                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Estado de Features

### ✅ Completadas

| Feature | Estado | Detalle |
|---------|--------|---------|
| Auth (login/signup/Google) | ✅ | Supabase Auth + RLS |
| Workspaces multi-tenant | ✅ | CRUD + miembros + roles |
| Upload de PDFs | ✅ | Supabase Storage, max 50MB |
| PDF Viewer | ✅ | Virtualizado, zoom, rotación, descarga |
| Highlights manuales | ✅ | Crear, editar, colores, categorías, persistencia |
| OCR server-side (nativo) | ✅ | unpdf extrae texto de PDFs digitales |
| OCR client-side (escaneados) | ✅ | Tesseract.js para PDFs de imagen |
| Chunking | ✅ | TextChunker con 512 tokens/chunk |
| Full-Text Search | ✅ | PostgreSQL tsvector + tsquery |
| Embeddings vectoriales | ✅ | text-embedding-3-small, pgvector, HNSW |
| Hybrid Search | ✅ | FTS + Vector con Reciprocal Rank Fusion |
| Embedding Cache | ✅ | SHA-256 hash compuesto, cross-document |
| Embedding Jobs | ✅ | Event-driven, distributed execution, retry |
| AI Chat | ✅ | Gemini + OpenAI con fallback chain |
| AI Gateway | ✅ | Action Router, auth, billing, rate limiting |
| Knowledge Tools | ✅ | Flashcards, Glossary, Mind Map (AI-generated) |
| Billing / Credits | ✅ | Stripe, credit accounts, ledger, reservations |
| i18n | ✅ | Inglés + Español |
| Command Palette | ✅ | Cmd+K |

### ⚠️ Parcialmente Implementadas

| Feature | Estado | Falta |
|---------|--------|-------|
| Timeline | ⚠️ | DB existe, sin generación AI |
| Presentations | ❌ | No implementado |
| Streaming real en chat | ⚠️ | Simulado con setTimeout |
| E2E tests completos | ⚠️ | Requieren backend real |

### ❌ No Implementadas (Issues abiertos)

| Issue | Descripción | Dependencias |
|-------|------------|-------------|
| #19 | Motor RAG híbrido | #18 ✅ |
| #20 | Knowledge Engine | #18 ✅ |
| #21 | Chat con contexto real | #18 ✅, #19 |

---

## Pipeline de Procesamiento Documental

```
PDF Upload
    ↓
Edge Function (process-document)
    ├── unpdf: extraer texto nativo (PDFs digitales)
    ├── Si digital → document_pages.raw_text (completo)
    └── Si scanned → ocr_status = 'needs_client_ocr'
    ↓
DocumentProcessingService (client-side)
    ├── ExtractionStage → imagen por página
    ├── TesseractOCRProvider → texto por página
    ├── TextChunker → chunks de ≤512 tokens
    ├── ChunkRepository → document_chunks
    ├── EmbeddingService → embedding_job
    ├── EmbeddingRouter → OpenAI text-embedding-3-small
    └── document_chunks.embedding (VECTOR 1536)
    ↓
Búsqueda Híbrida
    ├── FTS: tsvector + plainto_tsquery
    ├── Vector: cosine similarity con pgvector
    └── Reciprocal Rank Fusion (5 estrategias configurables)
```

---

## Base de Datos (35+ tablas)

### Core
- profiles, workspaces, workspace_members, user_settings

### Documentos
- documents, document_pages, document_chunks, highlights, highlight_categories, highlight_bboxes

### Procesamiento
- processing_jobs, processing_events, processing_logs, processing_tasks

### AI & Chat
- chat_sessions, chat_messages

### Billing
- plans, plan_prices, subscriptions, billing_customers
- credit_accounts, credit_buckets, credit_ledger, credit_reservations
- credit_packages, purchases, transactions

### Providers
- providers, provider_models, provider_pricing

### Seguridad
- rate_limit_counters, security_events

### Embeddings
- embedding_cache (cross-document cache)
- embedding_jobs (distributed execution)

### Knowledge
- flashcards, glossary_terms, mind_map_nodes, timeline_events

---

## Edge Functions (6)

| Function | Propósito |
|----------|-----------|
| ai-gateway | Action Router: chat + embedding (auth, billing, metrics) |
| process-document | OCR server-side con unpdf + billing |
| generate-knowledge | Generación de flashcards/glossary/mindmap |
| create-checkout-session | Stripe checkout |
| stripe-webhook | Manejo de webhooks de Stripe |

---

## Issues y Estado

### Cerrados
- #17: OCR real con extracción de texto ✅
- #18: Embeddings vectoriales y búsqueda semántica ✅ (verificado parcialmente)
- #18.5: Action Router en ai-gateway ✅

### Abiertos
- #19: Motor RAG híbrido (pendiente)
- #20: Knowledge Engine (pendiente)
- #21: Chat con contexto real (pendiente)

### Pipeline de dependencias
```
#17 OCR → #18 Embeddings → #19 RAG → #21 Chat
                         → #20 Knowledge Engine
```

---

## Cambios Recientes (última sesión)

### Issues #17, #18, #18.5 — Implementación por Claude

| Commit | Descripción |
|--------|------------|
| `833782e` | EmbeddingProviderRouter + auth policy reform |
| `6b237e6` | Action Router en ai-gateway |
| `79c9f47` | Fix 8 bugs críticos en embedding pipeline |
| `b351589` | Vector embeddings + hybrid search (pgvector) |
| `c18157b` | Chunking pipeline con全文検索 |
| `6142eb5` | Auth validation en process-document |
| `c3ed554` | 4 fixes críticos (deps, auth, credits, highlights) |
| `c94163d` | OCR real con unpdf + Tesseract |

### Cambios del usuario (2026-07-24)

| Archivo | Cambio |
|---------|--------|
| 6 nuevas migraciones | Stabilization, billing domain, security, RPCs, idempotency |
| billingStore.ts | Refactor completo del sistema de billing |
| knowledgeStore.ts | Mejoras significativas (+297 líneas) |
| stripe-webhook/index.ts | Manejo completo de webhooks (+261 líneas) |
| TextChunker.ts | Mejoras en chunking |
| stores varios | Refactor de uiStore, userStore, workspaceStore |
| migrations existentes | Correcciones de schema |

---

## Cómo Trabajamos

### Flujo de desarrollo
1. **Auditar** el estado actual del código
2. **Analizar** impacto antes de implementar
3. **Planificar** con aprobación del usuario
4. **Implementar** incrementalmente
5. **Verificar** build/lint/tests
6. **Documentar** con informe honesto

### Reglas de calidad
- ✅ Experimental / ⚠️ Inspección / ⏳ Pendiente — nunca mentir
- Benchmarks reproducibles con hardware/versión documentados
- Evidencia visual para cambios de UI
- Documentar limitaciones explícitamente
- Arquitectura compatible con multi-proveedor AI
- Detenerse ante riesgos arquitectónicos

### Próximos pasos
1. **#19 Motor RAG híbrido** — Consume embeddings y búsqueda híbrida
2. **#20 Knowledge Engine** — Extracción de entidades y conceptos
3. **#21 Chat con contexto** — RAG en el chat

---

## Infraestructura

| Servicio | URL | Estado |
|----------|-----|--------|
| Vercel | lumena-workspace.vercel.app | ✅ Deployed |
| Supabase | nsjetmjtwbhellqasggw.supabase.co | ✅ Active |
| GitHub | maxgab201/Lumena-Workspace | ✅ Repository |
| Stripe | (configurado) | ✅ Webhooks activos |

---

*Documento generado automáticamente. Para información actualizada, consultar el repositorio y los issues de GitHub.*
