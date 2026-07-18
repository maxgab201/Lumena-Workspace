# Lumena Workspace: arquitectura profesional de monetización, créditos, límites y orquestación de IA

## 1. Resumen ejecutivo

Lumena no debería tratar el consumo como una simple cantidad de tokens ni como una colección de contadores independientes.

La arquitectura recomendada es:

1. **Planes comerciales** que definen capacidades, límites y acceso.
2. **Créditos internos** como unidad comercial visible para el usuario.
3. **Tokens, páginas, imágenes, segundos y jobs** como unidades técnicas internas de medición.
4. **Un pricing engine versionado** que convierte costo técnico real en créditos cobrables.
5. **Un ledger inmutable** para registrar cada otorgamiento, reserva, consumo, liberación, reembolso y vencimiento.
6. **Reservas antes de ejecutar** operaciones potencialmente costosas.
7. **Liquidación posterior** basada en el consumo real del proveedor.
8. **Routing centralizado en backend**, nunca en el frontend.
9. **Fallback controlado**, con límites de costo explícitos.
10. **Entitlements separados de billing**: Stripe confirma pagos, pero Lumena decide qué acceso y qué derechos tiene el usuario.
11. **Límites por múltiples dimensiones**: usuario, workspace, plan, archivo, acción, modelo, día, mes y presupuesto.
12. **Protección contra costo impredecible** como principio de diseño, no como funcionalidad posterior.

La decisión más importante es no vender “tokens”. El usuario no debería tener que entender cuánto cuesta un millón de tokens de entrada, salida, imágenes, caché o razonamiento.

La unidad comercial debería ser:

> **Créditos Lumena: capacidad de uso de IA y procesamiento incluida en el plan o comprada adicionalmente.**

Internamente, cada crédito debe tener una equivalencia monetaria y una relación auditable con el costo real de proveedores.

---

# 2. Principios de diseño

## 2.1. El frontend nunca autoriza consumo

El frontend puede:

- solicitar una estimación;
- mostrar el saldo;
- mostrar el costo previsto;
- solicitar una acción;
- permitir elegir un modelo;
- mostrar límites y advertencias.

El frontend no puede:

- decidir cuántos créditos consumir;
- crear ledger entries;
- modificar saldos;
- declarar que una acción fue exitosa;
- seleccionar arbitrariamente un proveedor;
- cambiar el modelo real enviado al backend;
- saltarse límites;
- confirmar pagos o upgrades.

Toda operación debe seguir esta ruta:

```text
Frontend
  → API autenticada
    → Authorization / Entitlements
      → Cost Estimator
        → Credit Reservation
          → Job Orchestrator
            → Provider Adapter
              → Usage Metering
                → Credit Settlement
                  → Audit Log
```

## 2.2. Billing, acceso y consumo son subsistemas distintos

Conviene separar:

### Billing

- clientes;
- suscripciones;
- precios;
- facturas;
- pagos;
- impuestos;
- reintentos de cobro;
- chargebacks;
- cancelaciones.

### Entitlements

- qué plan posee el workspace;
- qué funciones están habilitadas;
- qué modelos están permitidos;
- cuáles son los límites efectivos;
- si el workspace está en período de gracia;
- si tiene acceso suspendido.

### Metering

- cuánto uso técnico se realizó;
- tokens;
- páginas;
- imágenes;
- segundos;
- jobs;
- tiempo de GPU;
- fallos;
- reintentos.

### Créditos

- cuánto saldo tiene el workspace;
- cuánto está reservado;
- cuánto fue consumido;
- cuánto fue devuelto;
- cuánto expiró;
- qué transacción originó cada movimiento.

No se deben mezclar estos dominios en una única tabla de “user_usage”.

## 2.3. Los precios de proveedores cambian

Los costos de los proveedores no son una constante de código.

Actualmente, los proveedores publican precios muy diferentes entre modelos y modalidades. Por ejemplo, los listados de mercado de julio de 2026 muestran diferencias importantes entre modelos económicos y modelos flagship de OpenAI, Anthropic y Google; incluso dentro de una misma empresa, el precio de salida puede ser varias veces superior al de entrada. Las páginas oficiales de Google también diferencian entre niveles Standard, Priority, caché, grounding y modelos con diferentes condiciones de facturación [Google Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).

Por eso:

- los precios deben estar en tablas;
- deben estar versionados;
- cada ejecución debe guardar el pricing snapshot usado;
- no se debe recalcular históricamente con precios actuales;
- se debe poder desactivar un modelo sin desplegar código;
- el margen debe poder cambiarse por plan y acción.

---

# 3. Modelo comercial recomendado

## 3.1. Moneda de referencia

Recomiendo:

- precios comerciales definidos en USD internamente;
- presentación en moneda local a través del proveedor de pagos;
- impuestos y conversión resueltos por Stripe o sistema equivalente;
- no almacenar ARS como única referencia de precio;
- guardar siempre:
  - moneda;
  - importe bruto;
  - importe neto;
  - impuestos;
  - tipo de cambio utilizado, si aplica;
  - identificador de precio externo.

Para Argentina, la presentación final puede incluir moneda local, impuestos y medios de pago específicos, pero el pricing engine debe continuar operando con una moneda interna estable, preferiblemente USD o una unidad monetaria de alta precisión.

## 3.2. Precio de un crédito

Recomendación inicial:

```text
1 crédito Lumena = USD 0,01 de valor de consumo comercial
```

Esto no significa que el proveedor cueste USD 0,01. Significa que Lumena vende una capacidad cuyo precio de lista equivale a un centavo.

La fórmula de precio debería ser:

```text
coste técnico =
    coste proveedor
  + coste OCR / visión
  + coste embeddings
  + coste almacenamiento temporal
  + coste de infraestructura
  + coste esperado de fallos
  + reserva de fraude y chargebacks

precio interno =
    coste técnico / objetivo de COGS

créditos =
    ceil(precio interno / 0,01)
```

Ejemplo:

```text
Coste técnico de una operación: USD 0,012
Objetivo de COGS: 30 %

Precio comercial mínimo:
0,012 / 0,30 = USD 0,04

Créditos:
ceil(0,04 / 0,01) = 4 créditos
```

Para operaciones muy pequeñas debe existir un mínimo:

```text
minimum_charge = 1 crédito
```

Para operaciones impredecibles:

```text
estimated_charge = reserva inicial
final_charge     = consumo real, con un techo autorizado
```

## 3.3. COGS objetivo

No recomendaría un objetivo inferior al siguiente:

| Categoría | COGS objetivo aproximado |
|---|---:|
| Chat estándar | 20–30 % |
| Resúmenes | 25–35 % |
| OCR y extracción | 20–35 % |
| Visión | 25–40 % |
| Generación de imágenes | 30–45 % |
| Presentaciones e infografías | 30–45 % |
| Modelos premium | 35–50 % |
| Free tier | máximo coste previamente presupuestado |

El margen real debe incluir:

- comisiones de pago;
- impuestos absorbidos;
- almacenamiento;
- soporte;
- reintentos;
- abuso;
- usuarios que consumen todo;
- usuarios que compran y solicitan refund;
- fluctuaciones cambiarias;
- aumentos de precio del proveedor.

Una operación puede tener margen positivo a nivel de API y aun así ser negativa para el negocio si produce demasiado soporte, almacenamiento o fraude.

---

# 4. Planes recomendados

Los valores siguientes son un punto de partida de producto, no precios definitivos. Deben validarse con cohortes reales, consumo observado y willingness-to-pay.

## 4.1. Tabla de planes

| Plan | Precio mensual sugerido | Precio anual sugerido | Créditos incluidos | Workspaces | Documentos activos | Páginas por mes | Modelos |
|---|---:|---:|---:|---:|---:|---:|---|
| Free | USD 0 | USD 0 | 100 | 1 | 5 | 250 | Budget |
| Go | USD 9 | USD 90 | 1.000 | 1 | 50 | 2.000 | Budget + Standard |
| Pro | USD 24 | USD 240 | 3.500 | 3 | 200 | 10.000 | Budget + Standard + Advanced |
| Max | USD 59 | USD 590 | 10.000 | 10 | 1.000 | 40.000 | Todos los modelos comerciales permitidos |

El descuento anual sugerido es aproximadamente 16,7 %, equivalente a dos meses gratuitos.

No conviene llamar a los planes “ilimitados”. Un plan puede tener:

- créditos incluidos;
- límites altos;
- límites de seguridad;
- fair use;
- cuotas de concurrencia;
- límites de archivos;
- límites de páginas;
- límites de tamaño.

## 4.2. Free

### Incluye

- lectura y extracción básica;
- OCR económico limitado;
- chat con modelo budget;
- resumen básico;
- highlights automáticos con modelo económico;
- flashcards limitadas;
- almacenamiento reducido;
- procesamiento asíncrono;
- soporte comunitario o autoservicio.

### Restricciones

- 100 créditos mensuales;
- máximo 5 documentos activos;
- máximo 250 páginas procesadas por mes;
- máximo 10 mensajes de chat diarios;
- máximo 3 generaciones derivadas por día;
- sin selección manual de modelos;
- sin modelos premium;
- sin exportaciones avanzadas;
- sin ejecución paralela;
- sin prioridad de procesamiento;
- posiblemente watermark o espera en funciones costosas.

### Estrategia

El Free debe demostrar el valor principal de Lumena, pero no permitir:

- OCR masivo;
- generación ilimitada;
- procesamiento de grandes libros;
- uso de modelos premium;
- loops automatizados;
- scraping de documentos como servicio gratuito.

El Free no debe ser un plan de producción.

## 4.3. Go

Pensado para estudiantes y usuarios individuales frecuentes.

Incluye:

- 1.000 créditos;
- modelos budget y standard;
- selección manual limitada;
- 2.000 páginas por mes;
- documentos de mayor tamaño;
- 25 mensajes de chat diarios;
- flashcards, glosarios y timelines;
- exportaciones normales;
- procesamiento con prioridad estándar;
- rollover limitado.

## 4.4. Pro

Pensado para investigadores, profesionales y usuarios intensivos.

Incluye:

- 3.500 créditos;
- modelos advanced;
- selección manual de modelos;
- modo automático de routing;
- 10.000 páginas mensuales;
- 100 mensajes diarios;
- más concurrencia;
- generación de mind maps;
- presentaciones limitadas;
- búsqueda semántica;
- mejores límites de tamaño;
- historial detallado de uso;
- prioridad de procesamiento;
- exportaciones avanzadas.

## 4.5. Max

Pensado para power users.

Incluye:

- 10.000 créditos;
- acceso a todos los modelos compatibles;
- modelos premium y de razonamiento;
- fallback multi-provider;
- 40.000 páginas mensuales;
- mayor concurrencia;
- lotes;
- presentación, infografía y derivados avanzados;
- límites superiores de archivos;
- prioridad alta;
- controles de presupuesto;
- API futura;
- alertas de uso;
- soporte prioritario.

No debería incluir acceso ilimitado a modelos con costos extremadamente altos. Es preferible:

```text
Max incluye acceso a modelos premium sujeto a:
- cuota específica;
- costo por operación;
- presupuesto diario;
- confirmación si la operación supera un umbral.
```

## 4.6. Rollover

Recomendación:

- créditos incluidos: expiran al final del período;
- permitir rollover de hasta 25 % del crédito mensual;
- el rollover expira después de un período adicional;
- créditos comprados: válidos 12 meses;
- al consumir, usar primero los créditos con fecha de expiración más próxima.

No conviene permitir acumulación ilimitada. Produce pasivos contables, complica refunds y puede generar picos de consumo futuros.

## 4.7. Qué pasa al superar un límite

Hay que distinguir:

### Límite de plan

Ejemplo: páginas mensuales.

Respuesta:

- bloquear nuevas operaciones que violen ese límite;
- permitir leer y exportar resultados existentes;
- ofrecer upgrade;
- ofrecer créditos extra solo si el límite es de créditos y no de capacidad;
- no permitir comprar créditos para saltarse un límite estructural del plan salvo que el producto lo defina explícitamente.

### Saldo insuficiente

Respuesta:

- mostrar costo estimado;
- ofrecer comprar créditos;
- ofrecer upgrade;
- permitir operaciones gratuitas de bajo costo, si corresponde;
- no iniciar el job hasta tener reserva suficiente.

### Límite de seguridad

Respuesta:

- bloquear temporalmente;
- mostrar motivo claro;
- requerir confirmación adicional o verificación;
- no simplemente cobrar más.

---

# 5. Sistema de créditos

## 5.1. Abstracción recomendada

No usar solamente:

- tokens;
- puntos arbitrarios;
- páginas;
- requests.

Usar tres capas:

### Capa comercial

```text
Lumena credits
```

Visible al usuario y usado en planes, paquetes y UX.

### Capa técnica

```text
input_tokens
output_tokens
cached_tokens
reasoning_tokens
pages
images
audio_seconds
embedding_tokens
gpu_seconds
provider_requests
```

### Capa económica

```text
provider_cost_micros
infrastructure_cost_micros
retail_value_micros
margin_snapshot
```

## 5.2. Estados del saldo

No guardar únicamente `balance`.

El saldo debe derivarse o proyectarse desde:

```text
available
reserved
consumed
refunded
expired
adjusted
```

Conceptualmente:

```text
available =
    granted
  + purchased
  + refunded
  + manual_adjustments
  - consumed
  - expired
  - reserved
```

La tabla de saldo es una proyección optimizada. La fuente de verdad es el ledger.

## 5.3. Reservas

Antes de una operación:

1. estimar costo;
2. validar límites;
3. crear reserva;
4. bloquear créditos;
5. ejecutar job;
6. medir consumo;
7. liquidar;
8. liberar excedente o cobrar diferencia dentro del techo.

Ejemplo:

```text
Saldo disponible: 120 créditos
Costo estimado: 35 créditos
Reserva: 35 créditos
Saldo disponible posterior: 85
Saldo reservado: 35
```

Si el consumo final es 22:

```text
consumido: 22
liberado: 13
```

Si el costo real es mayor que 35:

- solo se puede cobrar hasta el techo previamente autorizado;
- si se requiere más, hay que pedir confirmación o hacer una segunda reserva;
- nunca superar silenciosamente el máximo mostrado al usuario.

## 5.4. Ledger inmutable

Cada movimiento debe ser append-only.

Tipos mínimos:

```text
grant_plan
grant_purchase
grant_promotion
reserve
release
consume
refund
expire
chargeback_hold
chargeback_reversal
manual_adjustment
migration_adjustment
```

Cada entrada debe incluir:

- `id`;
- `workspace_id`;
- `user_id`;
- `bucket_id`;
- `event_type`;
- `amount`;
- `currency_or_unit`;
- `source_type`;
- `source_id`;
- `reservation_id`;
- `job_id`;
- `pricing_version`;
- `idempotency_key`;
- `created_at`;
- `effective_at`;
- `expires_at`;
- `metadata`;
- `created_by`;
- `reason`.

Nunca editar una entrada contable. Si hay un error:

```text
entrada incorrecta
+
entrada compensatoria
```

## 5.5. Buckets

Los créditos deben estar agrupados por origen:

- plan mensual;
- rollover;
- compra;
- promoción;
- compensación;
- enterprise allocation.

Esto permite:

- expiración distinta;
- refund correcto;
- prioridad de consumo;
- auditoría;
- prevención de fraude.

## 5.6. Compras adicionales

Paquetes de ejemplo:

| Paquete | Precio | Valor por crédito |
|---|---:|---:|
| Starter | USD 6 | USD 0,012 |
| Standard | USD 20 | USD 0,010 |
| Large | USD 90 | USD 0,009 |
| Enterprise | negociado | negociado |

No regalar descuentos excesivos. El usuario que compra créditos adicionales suele tener mayor consumo y mayor riesgo de costo.

Recomendaciones:

- compra manual inicialmente;
- auto-recharge solo después de tener historial de pagos;
- límite mensual de auto-recharge;
- confirmación 3DS cuando corresponda;
- no auto-recargar si el workspace está bajo riesgo;
- no permitir múltiples intentos de checkout concurrentes.

---

# 6. Tabla de consumo por acción

Los precios siguientes son precios comerciales orientativos en créditos. No deben quedar hardcodeados en componentes React.

## 6.1. Acciones documentales

| Acción | Unidad | Precio sugerido |
|---|---|---:|
| Extracción de texto nativa | por página | 0–1 |
| OCR estándar | por página | 2 |
| OCR alta precisión | por página | 4–8 |
| Detección de layout | por página | 2–5 |
| Visión de página | por página | 5–15 |
| Tabla compleja | por página | 4–12 |
| Indexado lexical | por 1.000 tokens | 1 |
| Embeddings | por 1.000 tokens | 1–3 |
| Búsqueda semántica | por consulta | 1–3 |
| Reindexado | por 1.000 tokens | 1–3 |
| Reintento de procesamiento | según acción | 50–100 % del precio original |

La extracción de texto nativa puede estar incluida en el plan y no consumir créditos, porque su costo marginal es bajo. OCR y visión sí deben medirse.

## 6.2. Acciones generativas

| Acción | Unidad | Precio sugerido |
|---|---|---:|
| Chat budget | por respuesta | 1–5 |
| Chat standard | por respuesta | 4–12 |
| Chat advanced | por respuesta | 10–30 |
| Chat premium | por respuesta | 30–100+ |
| Resumen corto | por documento | 5–20 |
| Resumen largo | por documento | 15–60 |
| Highlights automáticos | por 10 páginas | 5–15 |
| Flashcards | por 20 tarjetas | 5–15 |
| Glosario | por 50 términos | 8–25 |
| Timeline | por documento | 10–35 |
| Mind map | por documento | 15–60 |
| Presentación | por 10 diapositivas | 40–150 |
| Infografía | por salida | 30–150 |
| Preguntas de examen | por 20 preguntas | 8–25 |
| Reescritura o explicación | por respuesta | 3–15 |
| Regeneración | precio de nueva ejecución | 100 % |

La regeneración no debería ser gratuita por defecto. Si el error fue de Lumena o del proveedor, se puede devolver automáticamente.

## 6.3. Fórmula para chat

No cobrar siempre un precio fijo si el contexto varía mucho.

La estimación puede ser:

```text
chat_cost =
    base_action_fee
  + input_token_cost
  + output_token_cost
  + retrieval_cost
  + vision_cost
  + reasoning_cost
```

Para UX, se presenta como:

```text
Costo estimado: 8–14 créditos
Máximo protegido: 20 créditos
```

No conviene mostrar una cifra falsa de precisión si la operación depende de contexto dinámico.

## 6.4. Presupuestos máximos por acción

Cada acción debe tener:

```text
minimum_charge
estimated_charge
maximum_charge
hard_limit
```

Ejemplo para un resumen:

```json
{
  "minimum_charge": 8,
  "estimated_charge": 18,
  "maximum_charge": 30,
  "hard_limit": 50
}
```

Si el modelo intenta producir más tokens de los permitidos, el orquestador debe:

- cortar;
- resumir;
- paginar;
- o solicitar confirmación.

---

# 7. Orquestación multi-modelo y multi-provider

## 7.1. Arquitectura de adaptadores

Todos los proveedores deben implementar una interfaz común:

```typescript
interface ModelProviderAdapter {
  estimate(request: NormalizedModelRequest): Promise<CostEstimate>;
  execute(request: NormalizedModelRequest): Promise<ProviderResponse>;
  stream?(request: NormalizedModelRequest): AsyncIterable<ProviderChunk>;
  cancel?(providerRequestId: string): Promise<void>;
  normalizeUsage(response: ProviderResponse): NormalizedUsage;
  healthCheck(): Promise<ProviderHealth>;
}
```

La capa de negocio no debe saber si el modelo viene de:

- OpenAI;
- Anthropic;
- Google;
- OpenRouter;
- NVIDIA;
- Ollama;
- LM Studio;
- un proveedor futuro.

## 7.2. Modelo lógico interno

Separar:

```text
provider
provider_account
provider_model
lumena_model
model_version
model_capability
model_pricing
routing_policy
```

Ejemplo:

```text
lumena_model:
  id: lumena_standard_chat_v1
  display_name: Lumena Standard
  provider_strategy: multi_provider
  capability: text_chat
  quality_tier: standard
  allowed_plans: go, pro, max
```

El usuario no necesariamente debe ver el identificador técnico real.

## 7.3. Capabilities

Cada modelo debe declarar:

- chat;
- OCR;
- visión;
- JSON estructurado;
- tool calling;
- contexto máximo;
- streaming;
- batch;
- razonamiento;
- multimodalidad;
- temperatura;
- control de tokens;
- idiomas;
- disponibilidad regional;
- política de datos;
- latencia;
- costo;
- confiabilidad.

## 7.4. Routing automático

El selector automático debe considerar:

```text
capability match
+ plan eligibility
+ document language
+ context length
+ modality
+ quality requirement
+ latency target
+ provider health
+ cost ceiling
+ regional policy
+ privacy policy
+ current quota
+ historical success rate
```

Función conceptual:

```text
score(model) =
    quality_weight * quality_score
  + reliability_weight * reliability_score
  - cost_weight * normalized_cost
  - latency_weight * latency_score
  - risk_weight * risk_score
```

Pero el scoring nunca puede ignorar restricciones duras.

### Restricciones duras

Antes de puntuar:

- modelo permitido por plan;
- capacidad compatible;
- costo dentro del máximo;
- contexto suficiente;
- proveedor operativo;
- región permitida;
- política de privacidad compatible;
- límite de uso no excedido.

## 7.5. Modos de selección

### Auto

Lumena elige el modelo óptimo según costo, calidad y disponibilidad.

### Economy

Prioriza costo bajo y latencia.

### Balanced

Equilibrio entre calidad, costo y velocidad.

### Quality

Prioriza calidad, con límite de créditos.

### Manual

El usuario elige un modelo visible y obtiene:

- precio estimado;
- límite máximo;
- tiempo aproximado;
- proveedor;
- política de datos;
- aviso si es premium.

## 7.6. Fallback

El fallback debe ser conservador.

### Permitido automáticamente

Si el proveedor falla antes de generar una respuesta útil:

```text
Provider A timeout
→ Provider B de igual o menor costo
```

### No permitido automáticamente

Cambiar de un modelo económico a uno premium sin autorización.

### Si hubo salida parcial

Debe registrarse:

- tokens generados;
- costo real;
- estado de la salida;
- si el proveedor cobró;
- si se hizo fallback;
- cuánto se cobró al usuario.

No asumir que una excepción implica costo cero.

## 7.7. Presupuesto de fallback

Cada job debe tener:

```text
max_provider_attempts = 2 o 3
max_total_credit_cost
max_wall_clock_time
max_output_tokens
max_fallback_cost
```

Ejemplo:

```json
{
  "max_provider_attempts": 2,
  "max_total_credits": 30,
  "max_fallback_credits": 10,
  "max_output_tokens": 1200
}
```

## 7.8. Proveedores locales

Ollama y LM Studio requieren una distinción importante.

### Si Lumena controla la infraestructura

Se pueden tratar como proveedores internos con:

- costo de GPU;
- costo de energía;
- capacidad;
- concurrencia;
- amortización;
- costo de almacenamiento.

### Si el usuario aporta su propio endpoint

Debe clasificarse como:

```text
BYOK / customer-managed provider
```

En ese caso:

- Lumena puede cobrar por la función;
- el costo del proveedor puede no ser conocido;
- deben existir políticas de seguridad;
- no almacenar claves en el frontend;
- cifrar credenciales;
- probar conectividad;
- aislar SSRF;
- limitar hosts;
- no permitir endpoints arbitrarios sin validación.

---

# 8. Seguridad financiera y prevención de abuso

## 8.1. Amenazas principales

### Manipulación del cliente

El usuario modifica:

- precio;
- modelo;
- plan;
- cantidad de tokens;
- resultado de la operación;
- estado de pago;
- `workspace_id`;
- `credits`.

Mitigación: toda validación y pricing debe ejecutarse en backend.

### Repetición de requests

Un atacante reenvía la misma solicitud cientos de veces.

Mitigación:

- `idempotency_key`;
- unique constraint;
- job deduplication;
- reservation deduplication;
- cooldown por acción.

### Loops de regeneración

Un botón o integración dispara regeneraciones infinitas.

Mitigación:

- máximo de regeneraciones por respuesta;
- máximo por documento;
- límite por usuario y workspace;
- circuit breaker;
- confirmación a partir de cierto umbral.

### Archivos costosos

Un PDF puede tener:

- miles de páginas;
- imágenes enormes;
- páginas escaneadas;
- fuentes malformadas;
- compresión bomba;
- archivos anidados;
- contenido que obliga a visión;
- malware;
- PDFs falsamente pequeños que se expanden mucho.

Mitigación:

- límite de tamaño comprimido;
- límite de tamaño descomprimido;
- límite de páginas;
- límite de imágenes;
- límite de resolución;
- timeout por página;
- sandbox;
- antivirus;
- parser aislado;
- límite de memoria;
- cancelación;
- quota reservation antes de procesar.

### Prompt injection documental

El contenido del PDF puede contener instrucciones maliciosas.

Mitigación:

- separar instrucciones de sistema de contenido documental;
- marcar el texto del documento como datos no confiables;
- no ejecutar acciones externas basadas únicamente en documentos;
- limitar tools;
- filtrar URLs;
- evitar que un documento controle el modelo;
- auditar tool calls.

### Uso automatizado

Bots pueden usar Lumena como proxy de IA.

Mitigación:

- límites por IP;
- límites por cuenta;
- señales de automatización;
- CAPTCHA o challenge adaptativo;
- verificación de email;
- verificación de pago;
- scoring de riesgo;
- bloqueo de cuentas recién creadas;
- límites más conservadores para Free.

## 8.2. Rate limiting multidimensional

Implementar límites en Redis, gateway o middleware equivalente.

### Por usuario

- requests por minuto;
- jobs por hora;
- tokens por día;
- operaciones premium por día.

### Por workspace

- concurrencia;
- páginas por hora;
- créditos por día;
- jobs simultáneos;
- gasto máximo.

### Por plan

- Free: muy conservador;
- Go: moderado;
- Pro: alto;
- Max: alto, pero no ilimitado.

### Por acción

Ejemplo:

| Acción | Free | Go | Pro | Max |
|---|---:|---:|---:|---:|
| OCR por minuto | 20 páginas | 100 | 500 | 1.000 |
| Chat por minuto | 5 | 15 | 40 | 80 |
| Generación pesada por hora | 2 | 10 | 30 | 80 |
| Presentaciones por día | 0 | 1 | 5 | 20 |
| Regeneraciones por respuesta | 1 | 2 | 3 | 5 |

## 8.3. Límites de gasto

Cada workspace debería tener:

```text
daily_credit_cap
monthly_credit_cap
single_job_cap
premium_model_cap
fallback_cap
auto_recharge_cap
```

Aunque el saldo disponible sea superior, el job se bloquea si supera el límite de seguridad.

## 8.4. Circuit breakers

Activar circuit breaker cuando:

- aumenta la tasa de errores;
- un proveedor devuelve respuestas anormalmente largas;
- sube el costo medio;
- aparecen loops;
- un modelo queda fuera de presupuesto;
- hay actividad sospechosa;
- los jobs pendientes superan un umbral.

El circuit breaker puede:

- bajar a modelos budget;
- pausar una capacidad;
- pausar un proveedor;
- exigir confirmación;
- bloquear la cuenta;
- alertar operaciones.

## 8.5. Seguridad con Stripe

Stripe debe ser el sistema de procesamiento de pagos, pero no la fuente única de autorización de producto.

Buenas prácticas:

- verificar la firma del webhook sobre el body raw;
- registrar `event_id`;
- aplicar idempotencia;
- tolerar eventos duplicados;
- tolerar eventos fuera de orden;
- reconsultar el objeto actual cuando sea necesario;
- no activar una suscripción únicamente porque el usuario regresó de Checkout;
- conceder acceso a partir de estado confirmado en backend.

Stripe documenta explícitamente la verificación de firma y el manejo de eventos duplicados [Stripe webhooks](https://docs.stripe.com/webhooks).

Eventos importantes:

```text
checkout.session.completed
invoice.paid
invoice.payment_failed
invoice.payment_action_required
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
charge.refunded
charge.dispute.created
charge.dispute.closed
```

## 8.6. Chargebacks

Cuando hay chargeback:

1. marcar el pago como disputado;
2. congelar créditos comprados por esa transacción;
3. congelar créditos promocionales asociados;
4. impedir nuevas compras si el riesgo es alto;
5. mantener acceso únicamente según política;
6. crear entrada de ledger `chargeback_hold`;
7. revertir o liberar según resultado de la disputa.

No borrar los créditos silenciosamente. El usuario debe poder ver el ajuste en el historial.

## 8.7. Refunds

Reglas recomendadas:

- refund de suscripción: no devolver automáticamente todos los créditos ya usados;
- devolución de crédito comprado: solo de saldo no consumido;
- operación fallida por Lumena: refund automático de la reserva;
- proveedor fallido sin costo: liberar reserva;
- proveedor cobró tokens pero la respuesta fue inválida: decisión de negocio, normalmente crédito parcial o total;
- fraude: preservar evidencia y congelar saldo.

Cada refund debe incluir motivo:

```text
provider_failure
lumena_bug
duplicate_charge
manual_support
payment_refund
chargeback
policy_exception
```

---

# 9. Modelo de datos recomendado

A continuación, una estructura lógica. No es necesario crear todas las tablas en la primera versión, pero el diseño debe preservar estas separaciones.

## 9.1. Identidad y workspaces

### `users`

- `id`
- `auth_user_id`
- `email`
- `status`
- `risk_level`
- `created_at`

### `workspaces`

- `id`
- `owner_user_id`
- `name`
- `status`
- `default_region`
- `created_at`

### `workspace_members`

- `workspace_id`
- `user_id`
- `role`
- `status`
- `created_at`

El saldo debe pertenecer principalmente al **workspace**, no al usuario individual. Esto permite preparar equipos y enterprise.

## 9.2. Catálogo comercial

### `plans`

- `id`
- `code`
- `version`
- `display_name`
- `status`
- `is_public`
- `effective_from`
- `effective_to`

### `plan_prices`

- `id`
- `plan_id`
- `billing_interval`
- `currency`
- `amount`
- `external_price_id`
- `tax_behavior`
- `effective_from`

### `plan_entitlements`

- `plan_id`
- `entitlement_key`
- `value_type`
- `value`
- `unit`
- `hard_limit`
- `soft_limit`

Ejemplos:

```text
chat_daily_requests
monthly_pages
max_file_size_bytes
allowed_model_tiers
max_concurrency
semantic_search_enabled
presentation_enabled
```

No codificar estos límites exclusivamente en TypeScript.

## 9.3. Billing

### `billing_customers`

- `workspace_id`
- `provider`
- `external_customer_id`
- `billing_email`
- `tax_country`

### `subscriptions`

- `workspace_id`
- `provider`
- `external_subscription_id`
- `plan_id`
- `status`
- `current_period_start`
- `current_period_end`
- `cancel_at_period_end`
- `trial_end`
- `last_synced_at`

### `invoices`

- `workspace_id`
- `external_invoice_id`
- `subscription_id`
- `amount`
- `currency`
- `status`
- `paid_at`
- `failure_reason`

### `payment_events`

- `provider`
- `external_event_id`
- `event_type`
- `payload_hash`
- `received_at`
- `processed_at`
- `processing_status`

Unique:

```text
(provider, external_event_id)
```

## 9.4. Créditos

### `credit_accounts`

- `workspace_id`
- `available`
- `reserved`
- `consumed`
- `expired`
- `version`
- `updated_at`

### `credit_buckets`

- `id`
- `workspace_id`
- `source_type`
- `source_id`
- `original_amount`
- `remaining_amount`
- `expires_at`
- `priority`
- `status`

### `credit_ledger`

- `id`
- `workspace_id`
- `bucket_id`
- `entry_type`
- `amount`
- `direction`
- `reservation_id`
- `job_id`
- `pricing_version`
- `idempotency_key`
- `metadata`
- `created_at`

### `credit_reservations`

- `id`
- `workspace_id`
- `job_id`
- `requested_amount`
- `reserved_amount`
- `settled_amount`
- `released_amount`
- `status`
- `expires_at`
- `idempotency_key`

Estados:

```text
pending
confirmed
partially_settled
released
expired
cancelled
failed
```

## 9.5. Usage y jobs

### `usage_jobs`

- `id`
- `workspace_id`
- `user_id`
- `document_id`
- `action_type`
- `requested_model`
- `selected_model`
- `routing_policy`
- `status`
- `estimated_credits`
- `maximum_credits`
- `actual_credits`
- `created_at`
- `started_at`
- `completed_at`

### `usage_attempts`

- `id`
- `job_id`
- `provider_id`
- `provider_model_id`
- `attempt_number`
- `status`
- `provider_request_id`
- `input_tokens`
- `output_tokens`
- `cached_tokens`
- `reasoning_tokens`
- `provider_cost_micros`
- `latency_ms`
- `error_code`

### `usage_events`

- `id`
- `workspace_id`
- `job_id`
- `metric`
- `quantity`
- `unit`
- `source`
- `recorded_at`

## 9.6. Providers y modelos

### `providers`

- `id`
- `code`
- `status`
- `region`
- `privacy_class`
- `health_status`

### `provider_accounts`

- `id`
- `provider_id`
- `secret_reference`
- `account_status`
- `monthly_budget`
- `current_spend`
- `last_health_check`

### `provider_models`

- `id`
- `provider_id`
- `external_model_id`
- `display_name`
- `context_window`
- `capabilities`
- `quality_tier`
- `status`

### `provider_pricing`

- `id`
- `provider_model_id`
- `input_price_per_unit`
- `output_price_per_unit`
- `cached_input_price`
- `image_price`
- `audio_price`
- `batch_multiplier`
- `effective_from`
- `effective_to`
- `source_url`
- `retrieved_at`

### `model_routes`

- `capability`
- `plan_tier`
- `quality_mode`
- `provider_model_id`
- `priority`
- `max_share`
- `fallback_group`
- `cost_ceiling`
- `status`

## 9.7. Seguridad y auditoría

### `rate_limit_counters`

- `scope_type`
- `scope_id`
- `metric`
- `window`
- `count`
- `reset_at`

### `security_events`

- `workspace_id`
- `user_id`
- `event_type`
- `severity`
- `signal`
- `metadata`
- `created_at`

### `audit_log`

- `actor_type`
- `actor_id`
- `workspace_id`
- `action`
- `resource_type`
- `resource_id`
- `before`
- `after`
- `request_id`
- `ip_hash`
- `user_agent_hash`
- `created_at`

---

# 10. Supabase y seguridad de datos

Supabase puede servir como base de persistencia, pero la lógica financiera crítica debe ejecutarse mediante backend controlado, Edge Functions seguras o servicios internos.

Las tablas expuestas deben tener RLS habilitado. Supabase recomienda combinar grants explícitos con Row Level Security; RLS controla qué filas puede ver o modificar cada rol, mientras que los grants controlan qué objetos son accesibles [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).

Recomendaciones:

- no exponer `credit_ledger` para escritura desde el cliente;
- no exponer `credit_accounts` para escritura;
- no permitir que el cliente invoque funciones contables arbitrarias;
- usar `service_role` exclusivamente en backend;
- separar schemas:
  - `public` para datos apropiadamente expuestos;
  - `billing`;
  - `credits`;
  - `internal`;
  - `audit`;
- no almacenar claves de proveedores en tablas accesibles desde el cliente;
- usar Vault o secret manager;
- no confiar en `workspace_id` enviado por el cliente;
- derivar el workspace desde membresía autenticada;
- auditar cambios de plan y permisos.

El `service_role` no debe utilizarse en el navegador bajo ninguna circunstancia.

---

# 11. UX de planes, créditos y límites

## 11.1. No mezclar conceptos

La interfaz debe diferenciar:

### Plan

Lo que el usuario paga periódicamente y qué funciones habilita.

### Créditos

La capacidad comercial disponible.

### Tokens

Una métrica técnica que puede aparecer en una vista avanzada, pero no debe ser el lenguaje principal.

### Uso

El historial de operaciones realizadas.

Ejemplo de copy:

> Plan Pro  
> 2.140 créditos disponibles  
> 1.360 créditos usados este período  
> 8.400 de 10.000 páginas procesadas

## 11.2. Barra de saldo

Mostrar:

- saldo disponible;
- créditos reservados;
- créditos incluidos restantes;
- créditos comprados restantes;
- fecha de expiración;
- próximo reset;
- consumo diario;
- previsión de agotamiento.

Ejemplo:

```text
Disponible: 842 créditos
Reservados: 36 créditos
Se renuevan: 1.240 créditos el 3 de agosto
Créditos comprados: 500, vencen el 12 de septiembre
```

## 11.3. Previsualización de costo

Antes de una acción:

```text
Analizar documento
Costo estimado: 24 créditos
Rango esperado: 18–30 créditos
Límite máximo: 30 créditos
Modelo: Lumena Standard
Incluye OCR de 42 páginas
```

Para operaciones costosas:

```text
Esta presentación puede consumir hasta 120 créditos.
¿Deseas continuar?
[Cancelar] [Continuar]
```

## 11.4. Cuando se agota el saldo

No mostrar solamente:

> Error: insufficient credits

Mostrar:

> No tienes suficientes créditos para ejecutar este análisis.  
> Estimación: 48 créditos. Disponible: 21 créditos.  
> Puedes comprar créditos o cambiar a un modo más económico.

Acciones:

- comprar créditos;
- elegir modelo económico;
- reducir alcance;
- procesar solo algunas páginas;
- actualizar plan.

## 11.5. Cuando falla un proveedor

Si se hace fallback:

> El modelo principal no respondió. Completamos la operación con un proveedor alternativo. El costo se mantuvo dentro del límite autorizado.

Si no se puede hacer fallback:

> El proveedor no está disponible. No se consumieron créditos.

Si hubo costo parcial:

> El proveedor procesó parcialmente la solicitud. Se cobraron 3 créditos y se devolvieron 12 créditos reservados.

## 11.6. Upgrade

No ofrecer upgrade en cada error.

Mostrar upgrade cuando:

- el usuario alcanza repetidamente el límite;
- usa una función premium;
- tiene un patrón de consumo estable;
- el plan superior resuelve la limitación;
- el valor es claro.

Debe verse:

```text
Con Pro obtienes:
- 3.500 créditos mensuales
- modelos avanzados
- 10.000 páginas
- mayor concurrencia
```

No decir “ilimitado” si existe una política de fair use.

---

# 12. Estrategia de márgenes

## 12.1. No exponer todos los modelos

No conviene mostrar modelos por proveedor de forma indiscriminada.

Mostrar categorías:

- Económico;
- Equilibrado;
- Alta calidad;
- Razonamiento;
- Visión;
- Premium.

Ventajas:

- se puede cambiar el proveedor sin romper UX;
- se evita que el usuario compare únicamente precio por token;
- se controla el margen;
- se pueden reemplazar modelos retirados;
- se pueden optimizar rutas internamente.

La selección manual de modelos reales puede estar disponible en Pro y Max, pero con:

- lista curada;
- modelo versionado;
- precio visible;
- disponibilidad por región;
- advertencia de privacidad.

## 12.2. Modelos premium

Para modelos caros:

- no habilitarlos en Free;
- permitirlos solo en Pro o Max;
- aplicar cuota;
- aplicar límite por operación;
- exigir confirmación;
- evitar fallback automático hacia ellos;
- ofrecerlos como add-on si es necesario;
- monitorizar margen por modelo.

## 12.3. Caching

El caching debe considerarse tanto técnicamente como comercialmente.

Casos posibles:

- mismo documento ya indexado;
- mismo resumen con la misma versión de prompt;
- misma consulta y contexto;
- embeddings existentes;
- cache de contexto del proveedor.

Si la respuesta se sirve desde cache:

- puede cobrarse una cantidad mínima;
- puede ser gratuita si el costo marginal es casi cero;
- debe registrarse como `cache_hit`;
- no debe generar nuevos costos de proveedor;
- no debe permitir abusar repitiendo la misma solicitud para obtener créditos o respuestas inconsistentes.

## 12.4. Batch y procesamiento asíncrono

Para:

- flashcards;
- glosarios;
- timelines;
- embeddings;
- presentaciones;
- reindexado.

Se debe preferir:

- jobs asíncronos;
- batch cuando el proveedor lo soporte;
- límites de concurrencia;
- progreso;
- cancelación;
- reanudación segura.

Los trabajos batch pueden tener descuento comercial si el proveedor realmente reduce costos, pero no debe asumirse automáticamente.

---

# 13. Estrategia de Free Tier

El Free tier debe optimizar activación y conversión, no maximizar horas de uso gratuito.

## 13.1. Lo que sí debería permitir

- subir un PDF;
- extraer texto;
- probar chat;
- generar un resumen;
- ver highlights;
- crear una pequeña cantidad de flashcards;
- experimentar con el visor y la sincronización.

## 13.2. Lo que debería limitarse

- OCR de alta calidad;
- visión página por página;
- documentos masivos;
- presentaciones;
- infografías;
- modelos premium;
- API;
- procesamiento simultáneo;
- exportación masiva;
- automatización.

## 13.3. Anti-abuso del Free

- verificación de email;
- limitación por dispositivo/IP con señales de riesgo;
- no permitir infinitas cuentas gratuitas;
- cuota diaria y mensual;
- límite de páginas;
- hash perceptual de archivos repetidos;
- throttling para cuentas nuevas;
- límites más estrictos si el comportamiento parece automatizado.

---

# 14. Riesgos y trade-offs

## 14.1. Complejidad de créditos

### Beneficio

- abstrae tokens;
- permite múltiples proveedores;
- facilita margen;
- unifica OCR, visión y generación;
- habilita paquetes y promociones.

### Costo

- mayor complejidad contable;
- requiere explicabilidad;
- necesita ledger robusto;
- puede frustrar al usuario si el precio parece arbitrario.

Mitigación: mostrar estimaciones claras y evitar cambios silenciosos.

## 14.2. Pricing fijo por acción

### Beneficio

- UX simple;
- previsibilidad;
- fácil de vender.

### Riesgo

Un documento de 2 páginas y uno de 500 páginas no cuestan lo mismo.

Solución:

- precio base;
- componente por página/tokens;
- máximo;
- preview;
- confirmación.

## 14.3. Pricing totalmente dinámico

### Beneficio

- refleja costo real;
- protege margen.

### Riesgo

- difícil de entender;
- costos variables;
- sensación de “taxímetro”.

Solución: mostrar rangos, no microfacturación token por token.

## 14.4. Fallback

### Beneficio

- más disponibilidad;
- menos errores;
- menor dependencia de un proveedor.

### Riesgo

- doble costo;
- diferencias de calidad;
- salida inconsistente;
- problemas de privacidad;
- cambio inesperado de jurisdicción.

Solución: fallback de igual o menor costo por defecto, con política explícita.

## 14.5. Modelos locales

### Beneficio

- control;
- privacidad;
- menor costo variable;
- independencia.

### Riesgo

- costos de infraestructura;
- capacidad limitada;
- mayor operación;
- calidad irregular;
- dificultad para escalar.

## 14.6. Rollover

### Beneficio

- percepción de justicia;
- menor frustración.

### Riesgo

- pasivo de créditos;
- picos futuros;
- complejidad de expiración.

Recomendación: rollover limitado y con vencimiento.

## 14.7. “Un plan con IA ilimitada”

No recomendarlo.

Puede parecer atractivo en marketing, pero es peligroso si:

- se habilitan modelos premium;
- no se limitan documentos;
- se permiten loops;
- el costo de proveedor sube;
- usuarios intensivos representan gran parte de la base.

Si se quiere usar la palabra “ilimitado”, debe significar:

> Uso amplio sujeto a fair use, límites técnicos, modelos incluidos y política de seguridad.

---

# 15. Qué no conviene hacer

1. Guardar solamente un campo `credits_balance`.
2. Permitir que el frontend modifique créditos.
3. Usar tokens como moneda visible principal.
4. Hardcodear precios dentro de componentes.
5. Dar acceso premium porque el usuario volvió de Checkout.
6. Confiar en `checkout.session.completed` sin reconciliar el estado.
7. Activar un upgrade desde el cliente.
8. Cobrar antes de saber si el job se inició sin usar reservas.
9. No liberar reservas huérfanas.
10. Reintentar indefinidamente ante errores de proveedor.
11. Hacer fallback automático a un modelo más caro.
12. Permitir que el usuario elija cualquier `provider_model_id`.
13. Exponer claves de proveedores en el navegador.
14. Usar `service_role` en frontend.
15. Permitir endpoints BYOK arbitrarios sin protección SSRF.
16. Crear un plan Free sin límites de páginas.
17. Ofrecer presentaciones ilimitadas.
18. No versionar el pricing de proveedores.
19. Recalcular usos históricos con precios actuales.
20. Borrar movimientos de ledger.
21. Mezclar refunds con correcciones manuales.
22. Suponer que todos los errores de proveedor cuestan cero.
23. Tratar PDFs como contenido confiable.
24. Permitir que instrucciones del documento ejecuten herramientas.
25. No tener límites máximos por job.
26. No registrar el costo real por proveedor.
27. Ocultar totalmente cómo se consumen créditos.
28. Cambiar el precio de una operación durante su ejecución.
29. Crear paquetes de créditos con expiración ambigua.
30. Crear pricing enterprise antes de tener métricas de consumo reales.

---

# 16. Roadmap de implementación

## Fase 0: decisiones de negocio

Antes del código, aprobar:

- unidad comercial;
- precios de planes;
- créditos mensuales;
- política de expiración;
- política de refunds;
- objetivo de COGS;
- modelos incluidos por plan;
- límites de seguridad;
- si los créditos pertenecen al usuario o workspace;
- tratamiento de modelos locales;
- política de datos por proveedor.

Estas decisiones requieren aprobación humana porque impactan directamente en ingresos, margen y responsabilidad financiera.

## Fase 1: foundation financiera

Implementar primero:

1. catálogo de planes;
2. entitlements versionados;
3. credit accounts;
4. credit buckets;
5. ledger inmutable;
6. reservations;
7. settlement;
8. idempotency keys;
9. audit logs;
10. billing webhook seguro;
11. reconciliación con Stripe;
12. dashboard interno de uso y costo.

No comenzar por el routing complejo si todavía no existe una contabilidad sólida.

## Fase 2: metering y acciones básicas

Implementar:

- OCR por página;
- extracción;
- indexado;
- embeddings;
- chat;
- resúmenes;
- highlights;
- flashcards;
- glosarios;
- timelines.

Cada acción debe producir:

```text
estimate
reservation
job
provider attempts
usage
settlement
ledger entries
```

## Fase 3: provider framework

Agregar:

- adaptadores;
- normalización de respuestas;
- normalización de uso;
- tablas de pricing;
- health checks;
- routing económico;
- fallback conservador;
- snapshots de modelo y pricing.

## Fase 4: seguridad avanzada

Agregar:

- rate limiting;
- límites de concurrencia;
- límites por acción;
- límites de gasto;
- circuit breakers;
- detección de anomalías;
- riesgo de cuenta;
- controles para PDFs malformados;
- sandbox;
- controles de prompt injection;
- reconciliación diaria de costos.

## Fase 5: compras adicionales y UX comercial

Agregar:

- checkout de créditos;
- paquetes;
- expiración;
- refunds;
- alertas;
- auto-recharge opcional;
- upgrade/downgrade;
- usage dashboard;
- estimaciones visibles;
- centro de facturación.

## Fase 6: Pro y Max

Agregar:

- selección manual;
- modelos avanzados;
- lotes;
- mayor concurrencia;
- presentación;
- infografías;
- límites premium;
- prioridad;
- reglas de fair use.

## Fase 7: Enterprise

Preparar:

- workspaces múltiples;
- pools de créditos;
- presupuestos por equipo;
- límites por departamento;
- SSO/SAML;
- SCIM;
- audit export;
- retención configurable;
- BYOK;
- proveedores privados;
- regiones;
- facturación contractual;
- purchase orders;
- SLA;
- rate limits negociados.

---

# 17. Métricas que deben monitorizarse

## Economía

- ARPU;
- COGS por usuario;
- COGS por workspace;
- margen bruto;
- margen por plan;
- margen por modelo;
- margen por acción;
- créditos comprados;
- créditos consumidos;
- créditos expirados;
- porcentaje de rollover usado;
- costo de fallbacks;
- costo de reintentos;
- ratio de refunds;
- ratio de chargebacks.

## Producto

- activación;
- primer documento procesado;
- primer chat;
- primera generación derivada;
- conversión Free → Go;
- conversión Go → Pro;
- churn;
- expansión;
- uso antes del upgrade;
- funciones que disparan conversión.

## Operación

- tasa de error por proveedor;
- latencia p50/p95/p99;
- fallback rate;
- cache hit rate;
- jobs abandonados;
- reservas huérfanas;
- discrepancia entre estimación y costo real;
- documentos rechazados;
- costo por página;
- costo promedio por respuesta.

Una métrica especialmente importante es:

```text
actual_cost / estimated_cost
```

Si este ratio se desvía sistemáticamente, el pricing engine está mal calibrado.

---

# 18. Decisiones críticas que requieren aprobación humana

## Crítico 1: unidad de monetización

Decidir si 1 crédito representa USD 0,01, USD 0,005 u otra unidad.

## Crítico 2: margen mínimo

Definir cuál es el COGS máximo aceptable por plan y por modelo.

## Crítico 3: política de pérdidas

Definir cuánto puede perder Lumena en:

- errores de proveedores;
- operaciones parciales;
- chargebacks;
- usuarios Free abusivos;
- reembolsos.

## Crítico 4: acceso a modelos premium

Definir si Pro puede usar modelos premium, con qué cuota y bajo qué confirmación.

## Crítico 5: expiración

Definir si los créditos vencen, cuánto rollover se permite y cómo se comportan las compras.

## Crítico 6: derechos sobre datos

Definir proveedor por proveedor:

- si los datos se utilizan para entrenamiento;
- región de procesamiento;
- retención;
- subprocesadores;
- requisitos enterprise;
- BYOK.

## Crítico 7: fallback

Definir si se permite cambiar de proveedor cuando ya hubo costo parcial.

## Crítico 8: plan Free

Definir cuánto costo mensual máximo puede absorber el Free por usuario activo.

## Crítico 9: documentos grandes

Definir si Lumena:

- rechaza documentos;
- cobra por páginas;
- procesa por lotes;
- limita páginas;
- requiere Max o Enterprise.

## Crítico 10: enterprise

Definir si enterprise usa:

- créditos;
- presupuesto monetario;
- commit anual;
- overage;
- factura mensual;
- tarifas negociadas.

---

# 19. Recomendación final

La arquitectura ideal para Lumena es una plataforma de **entitlements + créditos + ledger + metering + routing**, no un contador de tokens integrado dentro del chat.

La secuencia correcta es:

```text
Plan
  → Entitlements
    → Estimación
      → Límite
        → Reserva
          → Job
            → Provider routing
              → Usage metering
                → Settlement
                  → Ledger
                    → UX y auditoría
```

La prioridad debe ser:

1. **ledger inmutable y reservas**;
2. **entitlements centralizados**;
3. **metering real por acción**;
4. **precios versionados**;
5. **provider adapters**;
6. **routing y fallback controlado**;
7. **protección contra abuso**;
8. **UX de costos y límites**;
9. **modelos premium**;
10. **enterprise y BYOK**.

La regla financiera fundamental debe ser:

> Ninguna ejecución de IA debe comenzar si Lumena no puede estimar su costo, reservar su capacidad, limitar su costo máximo, registrar su proveedor y liquidar el consumo de manera idempotente.

Y la regla de producto fundamental:

> El usuario debe entender qué puede hacer, cuánto puede costar y qué ocurrirá si alcanza un límite, sin tener que conocer la economía interna de los tokens.