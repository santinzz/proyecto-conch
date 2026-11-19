# EcoPuntos: especificación técnica para Claude Code

Nov 19, 2026 · @Santiago González Núñez

## Objetivo y alcance

Construir una PWA desplegada en internet que el equipo opere en un **piloto real de 2 a 3 semanas** con 15 a 30 usuarios (compañeros y familias), y que funcione también como caja en un **stand de venta de productos ecológicos** durante un evento escolar. El entregable final incluye datos de impacto medidos, no simulados.

**Qué entra**

- Registro e inicio de sesión con tres roles: cliente, operador (cajero o validador) y administrador.
- Recibos de luz y agua: subir foto o PDF, lectura por OCR, confirmación del usuario, validación del operador y puntos por reducción de consumo.
- Reciclaje en campus: QR fijo en el contenedor, solicitud del usuario y confirmación del operador.
- Caja del stand: el operador arma la venta con productos del catálogo y genera un QR firmado que el cliente escanea.
- Botón "trajo su bolsa o envase" en la caja.
- Retos con meta y fechas, niveles e insignias.
- Canje: cupones de un solo uso, recompensas físicas del equipo y donación de puntos a "árboles plantados".
- Panel de impacto: kWh, m³, kg de CO₂, envases evitados, piezas recicladas, usuarios activos, y exportación a CSV para el reporte.

**Qué no entra**

- Integración con terminales de punto de venta reales ni pagos en línea.
- App nativa (la PWA se instala desde el navegador).
- Ranking por colonia (opcional si sobra tiempo).

## Stack y estructura del repositorio

Un solo proyecto Next.js (frontend y API juntos) para que tres o cuatro personas lo terminen en pocas semanas y lo desplieguen gratis.

| Capa | Elección | Por qué |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | Frontend y API en un repo; despliegue en Vercel |
| Estilos | Tailwind CSS + shadcn/ui | Interfaz decente sin diseñador |
| Base de datos | PostgreSQL (Neon o Supabase, plan gratuito) | Relacional, transacciones para el libro de puntos |
| ORM | Prisma | Esquema tipado y migraciones |
| Autenticación | Auth.js (correo y contraseña) con roles | Sencillo y sin costo |
| Archivos | Supabase Storage o Vercel Blob | Fotos y PDF de recibos |
| OCR | Tesseract.js en el servidor (español) | Gratis; el usuario confirma lo leído |
| QR | `qrcode` (generar) y `html5-qrcode` (escanear con la cámara) | Funcionan en el navegador del celular |
| PWA | `@serwist/next` o manifest + service worker | Instalable en el teléfono |
| Gráficas | Recharts | Panel de impacto |
| Pruebas | Vitest (reglas de negocio) | Las reglas de puntos deben tener pruebas |

```
ecopuntos/
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.ts            # productos, reglas, retos, recompensas, usuarios demo
├─ src/
│  ├─ app/
│  │  ├─ (cliente)/      # inicio, escanear, recibos, retos, canjes, impacto
│  │  ├─ operador/       # caja, validar recibos, validar reciclaje
│  │  ├─ admin/          # catálogo, reglas, retos, recompensas, métricas
│  │  └─ api/            # route handlers
│  ├─ lib/
│  │  ├─ points/         # motor de reglas (funciones puras + tests)
│  │  ├─ qr.ts           # firma y verificación HMAC
│  │  ├─ ocr.ts          # extracción de consumo del recibo
│  │  └─ impact.ts       # CO2, litros, envases
│  └─ components/
├─ CLAUDE.md             # resumen de esta especificación
└─ .env.example          # DATABASE_URL, AUTH_SECRET, QR_SECRET, FE_SEN
```

## Roles y pantallas

Todo debe verse bien en el celular primero, porque el piloto y el stand se operan desde teléfonos.

| Rol | Pantalla | Qué hace |
| --- | --- | --- |
| Cliente | Inicio | Saldo, nivel, progreso al siguiente nivel, últimos movimientos y su impacto en CO₂ |
| Cliente | Escanear | Cámara para QR de ticket o de contenedor de reciclaje |
| Cliente | Mis recibos | Subir recibo, ver datos leídos por OCR, corregirlos y enviarlos; ver estado |
| Cliente | Retos | Retos activos con barra de avance; insignias ganadas |
| Cliente | Canjear | Catálogo de recompensas, donación a árboles y cupones con su QR |
| Cliente | Mi impacto | kWh, litros, CO₂ y envases evitados, con gráfica por semana |
| Operador | Caja | Buscar productos, armar venta, marcar "trajo envase", generar QR del ticket, canjear cupones |
| Operador | Validar recibos | Cola de recibos pendientes con la imagen y los datos; aprobar o rechazar con motivo |
| Operador | Validar reciclaje | Solicitudes pendientes del contenedor; confirmar número de piezas |
| Admin | Catálogo | Productos con criterios ecológicos; el Eco Score se calcula solo |
| Admin | Reglas, retos y recompensas | Editar puntos, límites, retos y stock |
| Admin | Métricas | Totales del piloto, usuarios activos y exportación CSV |
| Público | Impacto del piloto | Página sin login con los totales, para proyectar en la presentación |

## Modelo de datos

El saldo nunca se guarda como campo editable: es la suma de `PointEntry`. Cada acción que da o quita puntos crea una fila nueva dentro de una transacción.

```prisma
enum Role { CUSTOMER OPERATOR ADMIN }
enum EntryType { PURCHASE BRING_CONTAINER RECYCLE BILL_REDUCTION CHALLENGE REDEEM DONATION ADJUSTMENT }
enum EvidenceStatus { PENDING APPROVED REJECTED }
enum BillKind { ELECTRICITY WATER }

model User {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  passwordHash  String
  role          Role     @default(CUSTOMER)
  createdAt     DateTime @default(now())
  entries       PointEntry[]
  bills         Bill[]
  services      ServiceAccount[]
}

model ServiceAccount {           // un número de servicio CFE o de agua por cuenta
  id        String   @id @default(cuid())
  kind      BillKind
  number    String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  @@unique([kind, number])
}

model Product {
  id          String  @id @default(cuid())
  name        String
  priceCents  Int
  bulk        Boolean @default(false)   // granel o retornable
  local       Boolean @default(false)
  plasticFree Boolean @default(false)
  certified   Boolean @default(false)
  active      Boolean @default(true)
}

model Sale {                     // venta del stand; genera el QR
  id              String    @id @default(cuid())
  operatorId      String
  items           Json      // [{productId, qty, priceCents, ecoScore}]
  totalCents      Int
  points          Int
  broughtContainer Boolean  @default(false)
  qrNonce         String    @unique
  expiresAt       DateTime
  claimedById     String?
  claimedAt       DateTime?
}

model Bill {
  id             String         @id @default(cuid())
  userId         String
  user           User           @relation(fields: [userId], references: [id])
  kind           BillKind
  serviceNumber  String
  periodStart    DateTime
  periodEnd      DateTime
  consumption    Float          // kWh o m3, confirmado por el usuario
  ocrConsumption Float?
  ocrConfidence  Float?
  fileUrl        String
  fileHash       String         @unique
  status         EvidenceStatus @default(PENDING)
  reviewNote     String?
  @@unique([serviceNumber, periodStart])
}

model RecycleBin { id String @id @default(cuid()) name String location String code String @unique }

model RecycleClaim {
  id        String         @id @default(cuid())
  userId    String
  binId     String
  pieces    Int
  status    EvidenceStatus @default(PENDING)
  createdAt DateTime       @default(now())
}

model PointEntry {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  type      EntryType
  points    Int       // positivo o negativo
  sourceId  String?   // Sale, Bill, RecycleClaim, Redemption...
  impact    Json?     // {kwh, m3, co2Kg, containers, pieces}
  createdAt DateTime  @default(now())
  @@unique([type, sourceId])   // una misma evidencia no paga dos veces
}

model Rule { action EntryType @id points Int limitCount Int? limitPeriod String? } // "day" | "week" | "bill"

model Challenge {
  id String @id @default(cuid())
  title String
  metric String      // ej. "BRING_CONTAINER_count", "ELECTRICITY_reduction_pct"
  target Float
  reward Int
  startsAt DateTime
  endsAt DateTime
}

model Reward { id String @id @default(cuid()) name String cost Int stock Int isDonation Boolean @default(false) }

model Redemption {
  id        String    @id @default(cuid())
  userId    String
  rewardId  String
  code      String    @unique   // cupón de un solo uso
  usedAt    DateTime?
  createdAt DateTime  @default(now())
}
```

## Reglas de negocio

Todas viven en `src/lib/points/` como funciones puras con pruebas en Vitest. Los valores salen de la tabla `Rule` para poder ajustarlos sin cambiar código.

**Eco Score de un producto:** cuenta cuántos de `bulk`, `local`, `plasticFree` y `certified` son verdaderos. 3 o 4 = A, 2 = B, 1 = C, 0 = sin puntos.

| Acción | Puntos (valor inicial) | Límite |
| --- | --- | --- |
| Compra, producto A | 3 por cada $10 del renglón | — |
| Compra, producto B | 2 por cada $10 | — |
| Compra, producto C | 1 por cada $10 | — |
| Trajo bolsa o envase | 10 | 1 por día |
| Reciclaje | 5 por pieza | 20 piezas por semana |
| Reducción en recibo | 50 por cada 5% completo de reducción | 200 por recibo |
| Reto completado | Lo que diga el reto (100 por defecto) | Una vez por reto |

**Reducción en recibo:** se compara contra el recibo aprobado anterior del mismo número de servicio. Si no hay recibo anterior, el primero solo sirve de línea base y da 0 puntos (pero sí cuenta para retos de participación). Para recibos con periodos de distinta duración, comparar el consumo diario promedio.

```ts
reductionPct = (prevDaily - currDaily) / prevDaily * 100
points = min(200, floor(reductionPct / 5) * 50)   // 0 si reductionPct <= 0
```

**Niveles** (puntos ganados, sin contar canjes, en los últimos 180 días): Semilla 0–499, Brote 500–1,999 (+10% en compras), Árbol 2,000+ (+20% en compras).

**Impacto:**

```ts
co2Kg     = kwhSaved * FE_SEN          // FE_SEN en kg CO2/kWh, variable de entorno
litros    = m3Saved * 1000
envases   = count(BRING_CONTAINER)
piezas    = sum(RecycleClaim.pieces aprobadas)
```

`FE_SEN` es el factor de emisión del Sistema Eléctrico Nacional que publica SEMARNAT cada año; hay que poner el valor oficial más reciente antes del piloto.

**Canje:** 100 puntos equivalen a $10 MXN de referencia. Un canje crea un `PointEntry` negativo y un `Redemption` con código; nunca se permite saldo negativo.

## API

Route handlers de Next.js con validación de entrada en Zod. Cada endpoint revisa el rol en el servidor; la interfaz nunca decide permisos.

| Método y ruta | Rol | Qué hace |
| --- | --- | --- |
| `POST /api/auth/register` | Público | Crear cuenta de cliente |
| `GET /api/me` | Cliente | Saldo, nivel, progreso e impacto acumulado |
| `GET /api/me/entries` | Cliente | Historial de movimientos paginado |
| `POST /api/sales` | Operador | Crear venta del stand; devuelve el contenido del QR firmado |
| `POST /api/sales/claim` | Cliente | Canjear el QR de un ticket; acredita puntos una sola vez |
| `POST /api/bills` | Cliente | Subir archivo; devuelve lo leído por OCR |
| `PATCH /api/bills/:id` | Cliente | Confirmar o corregir datos y enviar a validación |
| `GET /api/bills?status=PENDING` | Operador | Cola de validación |
| `POST /api/bills/:id/review` | Operador | Aprobar (acredita puntos) o rechazar con motivo |
| `POST /api/recycle/claim` | Cliente | Solicitud desde el QR del contenedor con número de piezas |
| `POST /api/recycle/:id/review` | Operador | Confirmar piezas y acreditar |
| `GET /api/challenges` | Cliente | Retos activos con el avance del usuario |
| `GET /api/rewards` | Cliente | Catálogo de recompensas |
| `POST /api/redemptions` | Cliente | Canjear recompensa o donar puntos |
| `POST /api/redemptions/:code/use` | Operador | Marcar cupón como usado en el stand |
| `CRUD /api/admin/products, rules, challenges, rewards, bins` | Admin | Administración |
| `GET /api/admin/metrics` y `/export.csv` | Admin | Totales del piloto y exportación |
| `GET /api/public/impact` | Público | Totales agregados sin datos personales |

Los retos se evalúan después de cada movimiento acreditado: si el usuario alcanza la meta dentro de las fechas, se crea el `PointEntry` de tipo `CHALLENGE` (protegido por la restricción única `[type, sourceId]` con `sourceId` = `challengeId:userId`).

## Seguridad y antifraude

**QR del ticket.** El contenido es `saleId.nonce.expiresAt.firma`, donde la firma es HMAC-SHA256 con `QR_SECRET`. Al reclamarlo, el servidor verifica la firma con comparación de tiempo constante, revisa que no haya expirado (15 minutos) y marca `claimedById` en la misma transacción que crea el `PointEntry`. Un segundo intento devuelve error.

**QR del contenedor.** Es fijo (`bin:<code>`), así que no da puntos por sí solo: solo crea una solicitud que el operador confirma.

**Recibos.**

- SHA-256 del archivo en `fileHash` único: el mismo archivo no se sube dos veces.
- `ServiceAccount` único por `[kind, number]`: un número de servicio pertenece a una sola cuenta.
- `[serviceNumber, periodStart]` único: no se paga dos veces el mismo periodo.
- Si el valor confirmado difiere más de 10% de lo leído por OCR, o la reducción supera 50%, se marca para revisión detallada.
- Solo se guardan número de servicio, periodo y consumo; la imagen se borra al terminar el piloto. Mostrar un aviso de privacidad breve al subir.

**Límites.** Antes de acreditar, el motor cuenta los movimientos del mismo tipo en el periodo de la regla y recorta los puntos al límite.

**General.** Contraseñas con bcrypt o argon2; sesiones de Auth.js; rate limit básico en login, subida de recibos y reclamo de QR; ningún secreto en el cliente.

## Plan de implementación

Pídanle a Claude Code una fase a la vez y no pasen a la siguiente hasta que se cumplan sus criterios. Así el código se puede revisar por partes y hay algo funcional en cada paso.

1. **Base del proyecto.** Next.js, Tailwind, Prisma, Auth.js con roles, despliegue en Vercel con la base de datos en Neon o Supabase.
   - Se puede registrar un cliente e iniciar sesión en la URL pública.
   - Las rutas `/operador` y `/admin` rechazan a quien no tiene el rol.
   - `prisma db seed` crea productos, reglas, un contenedor, retos, recompensas y tres usuarios demo.
2. **Motor de puntos.** `src/lib/points/` con Eco Score, cálculo por compra, reducción de recibo, límites y niveles.
   - Pruebas en Vitest para cada regla, incluidos los casos límite (0% y 50% de reducción, límite diario alcanzado, primer recibo sin línea base).
   - El saldo siempre es la suma de `PointEntry`.
3. **Caja y QR del ticket.** Pantalla de caja, firma HMAC, escáner en el celular del cliente.
   - Una venta genera un QR; escanearlo acredita los puntos una vez; el segundo intento falla; un QR vencido falla.
   - El botón "trajo envase" respeta el límite de uno por día.
4. **Recibos con OCR.** Subida, Tesseract.js, confirmación del usuario, cola del operador.
   - Con dos recibos reales de CFE, el segundo aprobado acredita puntos según la reducción y registra kWh y CO₂.
   - Archivo repetido, periodo repetido o número de servicio de otra cuenta son rechazados.
   - Si el OCR falla, el usuario puede escribir los datos y el operador los revisa.
5. **Reciclaje, retos y canjes.**
   - Escanear el QR del contenedor crea una solicitud; al confirmarla se acreditan puntos.
   - Un reto se completa solo al llegar a la meta y paga una vez.
   - Canjear genera un cupón QR que el operador marca como usado; no se permite saldo negativo.
6. **Impacto, métricas y PWA.**
   - "Mi impacto" y la página pública muestran totales y gráfica semanal.
   - El admin exporta un CSV con los movimientos y el impacto del piloto.
   - La app se instala en Android y iPhone desde el navegador.
7. **Pulido para el piloto.** Textos en español, estados vacíos y de error, aviso de privacidad, revisión con 3 o 4 personas antes de abrirlo a todos.

Con las fases 1 a 4 ya tienen un piloto de recibos y stand funcional; las fases 5 y 6 completan la experiencia y el reporte.

## Prompt inicial para Claude Code

Exporten este documento a Markdown, guárdenlo en la raíz del repositorio como `SPEC.md` y peguen esto en Claude Code:

```markdown
Vamos a construir EcoPuntos, una PWA de puntos por consumo y acciones sustentables
para un proyecto escolar de Desarrollo Sustentable. La especificación completa está
en SPEC.md; léela completa antes de escribir código.

Reglas de trabajo:
- Trabaja una fase del "Plan de implementación" a la vez. Empieza por la Fase 1.
- Antes de programar cada fase, dame un plan corto y espera mi visto bueno.
- Al terminar una fase, verifica tú mismo sus criterios de aceptación (corre las
  pruebas, levanta el servidor) y dime cómo probarlo yo.
- Crea un CLAUDE.md con el resumen del proyecto, comandos y convenciones, y
  mantenlo actualizado.
- El saldo de puntos SIEMPRE es la suma de PointEntry; nunca lo guardes como campo.
- Toda acreditación de puntos va en una transacción y pasa por src/lib/points/.
- Los permisos se revisan en el servidor en cada endpoint.
- Interfaz en español, pensada primero para celular.
- Nada de secretos en el código: usa .env y deja un .env.example.
- Haz commits pequeños por funcionalidad con mensajes en español.

Si algo de SPEC.md es ambiguo o choca con una buena práctica, pregúntame en lugar
de suponer.
```

**Consejos para el equipo**

- Revisen el diff de cada fase antes de aprobar; si nadie entiende una parte, pídanle a Claude Code que la explique. En la exposición les van a preguntar.
- Consigan pronto dos recibos reales de CFE para probar el OCR: es la parte más frágil.
- Pongan el valor oficial de `FE_SEN` antes del piloto y citen la fuente en el reporte.
