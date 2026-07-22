# Issue #17: OCR Real — Documento de Verificación

## Estado del Issue

| Aspecto | Estado |
|---------|--------|
| Implementación | ✅ Completada |
| Build TypeScript | ✅ Pasa (`npm run build` sin errores) |
| Validación de extracción de texto | ✅ Validado experimentalmente |
| Validación de persistencia | ⚠️ Validado mediante inspección del código |
| Validación de recuperación | ⚠️ Validado mediante inspección del código |
| Validación E2E completa | ⏳ Pendiente de backend real de Supabase |

---

## Categorías de Validación

Cada verificación está clasificada según el nivel de evidencia:

- **Experimental**: Ejecutado realmente con datos de prueba
- **Prueba funcional**: Verificado con test automatizado
- **Inspección del código**: Deducido leyendo la implementación (no ejecutado)

---

## 1. Extracción de Texto con pdfjs-dist

**Categoría: Experimental** ✅

Se ejecutó `pdfjs-dist/legacy/build/pdf.mjs` directamente con los 4 PDFs de prueba.

### Hardware
- **CPU**: Intel Core Ultra 9 275HX (24 cores)
- **RAM**: 31 GB
- **OS**: Windows 11 (x64)
- **Node.js**: v24.15.0

### Librería
- **pdfjs-dist**: v5.4.296 (la misma que usa unpdf internamente)
- **Build**: `legacy/build/pdf.mjs` (Node.js compatible)

### PDFs de Prueba

| Archivo | Páginas | Tamaño | Origen | Contenido |
|---------|---------|--------|--------|-----------|
| small-native.pdf | 1 | 856 B | Generado con pdf-lib (commit 9415927) | Texto simple "Page 1 of 1" |
| medium-native.pdf | 100 | 23 KB | Generado con pdf-lib (commit 9415927) | Texto "Page N of 100" por página |
| large-native.pdf | 1000 | 228 KB | Generado con pdf-lib (commit 9415927) | Texto "Page N of 1000" por página |
| scanned.pdf | 5 | 1.4 KB | Generado con pdf-lib (commit 9415927) | Páginas sin texto (simula escaneado) |

### Resultados

| PDF | Páginas | Texto Extraído | Tiempo | Chars/Página |
|-----|---------|---------------|--------|-------------|
| small-native.pdf | 1 | 1/1 (100%) | 2ms | 11 |
| medium-native.pdf | 100 | 100/100 (100%) | 58ms | 14 |
| large-native.pdf | 1000 | 1000/1000 (100%) | 980ms | 14 |
| scanned.pdf | 5 | 0/5 (0%) | 2ms | 0 |

### Análisis
- **PDFs nativos**: Texto extraído correctamente de todas las páginas
- **PDF escaneado**: Detectado correctamente como sin texto nativo
- **Rendimiento**: Lineal O(n) — ~1ms por página
- **Límite observado**: 1000 páginas en <1s (dentro del timeout de Edge Functions)

### Notas
- Estos PDFs son generados programáticamente, no contienen fonts reales ni layouts complejos
- Los warnings `standardFontDataUrl` son benignos para extracción de texto
- unpdf usa la misma versión de pdfjs-dist internamente, por lo que los resultados son directamente extrapolables

---

## 2. Detección Digital vs Scanned

**Categoría: Experimental** ✅

Mismo test que el punto 1. La detección se basa en:

```typescript
const hasNativeText = pageTexts.some((t: string) => t.trim().length > 0)
```

| PDF | Resultado Esperado | Resultado Obtenido | Correcto |
|-----|-------------------|-------------------|----------|
| small-native.pdf | Digital | `hasNativeText = true` | ✅ |
| medium-native.pdf | Digital | `hasNativeText = true` | ✅ |
| large-native.pdf | Digital | `hasNativeText = true` | ✅ |
| scanned.pdf | Scanned | `hasNativeText = false` | ✅ |

### Limitaciones conocidas de la detección
- PDFs con texto OCR invisible (capa de texto sobre imagen) se detectarían como "digital"
- PDFs con solo títulos o etiquetas se detectarían como "digital"
- Estos casos son correctos — el texto SÍ existe en el PDF

---

## 3. Persistencia Incremental (upsertPageText)

**Categoría: Inspección del código** ⚠️

Verificado leyendo la implementación:

- `DocumentProcessingService.processPage()` llama `DocumentRepository.upsertPageText()` después de cada página
- `upsertPageText()` usa `supabase.from('document_pages').upsert(page, { onConflict: 'document_id,page_number' })`
- La tabla `document_pages` tiene UNIQUE constraint en `(document_id, page_number)` (migración `20240722000001`)

**Lo que no se verificó**: Que Supabase realmente ejecuta el UPSERT correctamente (requiere backend real)

---

## 4. Recuperación (getCompletedPages)

**Categoría: Inspección del código** ⚠️

Verificado leyendo la implementación:

- `DocumentProcessingService.process()` llama `getCompletedPages()` antes de procesar
- `getCompletedPages()` consulta `document_pages` y retorna Set de page_numbers con texto
- El loop filtra: `pendingPages = allPages - completedPages`

**Lo que no se verificó**: Que la query a `document_pages` retorna los datos correctos (requiere backend real)

---

## 5. Idempotencia (UPSERT)

**Categoría: Inspección del código** ⚠️

Verificado leyendo la implementación:

- `onConflict: 'document_id,page_number'` en `upsertPageText()`
- PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` es atómico
- Ejecutar el mismo OCR dos veces actualiza, no duplica

**Lo que no se verificó**: Que no hay race conditions entre dos instancias del servicio (requiere backend real)

---

## 6. ProviderFallback (no Tesseract directo)

**Categoría: Inspección del código** ✅

Verificado leyendo la implementación:

- `DocumentProcessingService.processPage()` usa `ProviderFallback.executeWithFallback()`
- No hay llamada directa a `TesseractOCRProvider` en el pipeline
- `providerConfig.fallbacks.ocr` define la cadena de proveedores

---

## 7. Independence de React

**Categoría: Inspección del código** ✅

Verificado leyendo la implementación:

- `DocumentProcessingService.ts` no tiene imports de React
- Usa `usePageRegistryStore` vía `.getState()` (función estática, no hook)
- Puede ejecutarse desde cualquier contexto JavaScript

---

## 8. Edge Function (unpdf)

**Categoría: Inspección del código** ⚠️

Verificado leyendo la implementación:

- `npm:unpdf@1.6.2` importado correctamente
- `pdf.destroy()` en finally block (cleanup de memoria)
- Error handler usa `jobId` hoisted (no re-read del body)
- Manejo de scanned vs digital correcto

**Lo que no se verificó**: Que unpdf funciona en Deno Edge Functions (requiere deploy real)

---

## 9. E2E Completo (Upload → OCR → Persist → UI)

**Categoría: Pendiente** ⏳

El test E2E (`tests/ocr-e2e.spec.ts`) fue escrito pero no pudo ejecutarse porque:

- `createSignedUrl` de Supabase es client-side y construye URLs localmente
- Mockear esto requiere interceptar `window.fetch` antes de que la app cargue
- El approach con `addInitScript` + fetch override no funcionó (Supabase usa XMLHttp o tiene su propio fetch)

**Para completar esta validación se necesita**:
1. Backend real de Supabase (proyecto de testing)
2. Credenciales de servicio para la Edge Function
3. Ejecutar con `SUPABASE_URL` y `SUPABASE_ANON_KEY` reales

---

## Resumen

| # | Verificación | Categoría | Resultado |
|---|-------------|-----------|-----------|
| 1 | Extracción de texto | Experimental | ✅ Funciona |
| 2 | Detección digital/scanned | Experimental | ✅ Funciona |
| 3 | Persistencia incremental | Inspección del código | ⚠️ Lógica correcta, no ejecutado |
| 4 | Recuperación | Inspección del código | ⚠️ Lógica correcta, no ejecutado |
| 5 | Idempotencia | Inspección del código | ⚠️ Lógica correcta, no ejecutado |
| 6 | ProviderFallback | Inspección del código | ✅ Integrado |
| 7 | Independencia de React | Inspección del código | ✅ Verificado |
| 8 | Edge Function | Inspección del código | ⚠️ Lógica correcta, no ejecutado |
| 9 | E2E completo | Pendiente | ⏳ Requiere backend real |
