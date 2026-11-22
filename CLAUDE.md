@AGENTS.md

# EcoPuntos

PWA de puntos por consumo y acciones sustentables, hecha para un proyecto escolar de Desarrollo Sustentable. El piloto real dura de 2 a 3 semanas con 15 a 30 usuarios, y la app también funciona como caja del stand de productos ecológicos. La especificación completa está en `SPEC.md`, que manda sobre este archivo.

## Estado

- [x] Fase 1: base del proyecto (Next.js, Prisma, Auth.js con roles, seed). Desplegada en Vercel, con la base en Neon.
- [x] Fase 2: motor de puntos con pruebas (87 pruebas).
- [x] Fase 3: caja y QR del ticket (113 pruebas). Falta probar la cámara en un celular real, porque necesita HTTPS (Vercel).
- [x] Fase 4: recibos con OCR (142 pruebas). Falta afinar el lector con recibos reales de CFE y de agua, y aplicar la migración `recibos_fase4` en la rama `production` de Neon antes de publicarla.
- [ ] Fase 5: reciclaje, retos y canjes
- [ ] Fase 6: impacto, métricas y PWA
- [ ] Fase 7: pulido para el piloto

Se trabaja una fase a la vez: primero se presenta un plan corto y se espera el visto bueno.

- Repositorio (privado): https://github.com/santinzz/proyecto-conch, rama `main`.
- Producción: https://ecopuntos-eight.vercel.app (proyecto `ecopuntos` en Vercel, conectado al repo de GitHub).
  - **Cada push a `main` despliega a producción automáticamente.** Las otras ramas generan despliegues de preview, pero esos no tienen base de datos, porque las variables solo están en Production.
  - Vercel **no** aplica migraciones. Si un cambio trae una migración nueva, aplícala primero en la rama `production` de Neon (`bun run db:deploy` con su `DATABASE_URL_UNPOOLED`) y después haz el push.

## Stack

- Bun 1.4 como gestor de paquetes y para correr scripts. No hay Node instalado.
- Next.js 16 (App Router, Turbopack) y TypeScript. **Next 16 cambió APIs:** antes de usar una, revisa `node_modules/next/dist/docs/`. Por ejemplo, `middleware` ahora se llama `proxy`.
- `cacheComponents` está **desactivado** a propósito, porque la sesión y el saldo se leen en cada petición.
- Tailwind 4 y shadcn/ui (estilo base-nova, sobre Base UI). `cn` viene del paquete `cn`. Para un botón que es enlace: `<Button nativeButton={false} render={<Link …/>}>`.
- Neon (Postgres): proyecto `small-base-81280859`, rama `production`, enlazado con el CLI `neon` (`neon.ts`; `.neon` está ignorado en git). `neon deploy` o `neon env pull` escriben `DATABASE_URL` (con pooling) y `DATABASE_URL_UNPOOLED` (directa) **en `.env`**, y sobrescriben lo que hubiera ahí.
- Prisma 7.10 con `@prisma/adapter-pg`. `src/lib/db.ts` crea un `Pool` de `pg` con la URL con pooling y lo registra con `attachDatabasePool` (Vercel Fluid compute), como recomiendan las skills de Neon en `.claude/skills/`. El cliente se genera en `src/generated/prisma` (está en .gitignore) y la configuración vive en `prisma.config.ts`.
- Auth.js v5 (`next-auth@5 beta`) con correo y contraseña, sesiones JWT y bcryptjs.
- Zod 4 para validar entradas y Vitest para las reglas de negocio.

## Comandos

```bash
bun install            # también corre prisma generate
bun run db:local       # Postgres local con PGlite: base en 127.0.0.1:5433 y base sombra en :5435 (dejarlo abierto)
bun run db:migrate     # crear y aplicar migraciones en dev (prisma migrate dev)
bun run db:seed        # datos demo; es idempotente
bun run db:deploy      # aplicar migraciones en producción (Neon)
bun run db:studio      # explorar la base de datos
bun run dev            # servidor en http://localhost:3000
bun run tickets:demo   # QR de tickets de prueba en tickets-demo/ (solo con la base local)
bun run test           # Vitest
bun run lint
bunx tsc --noEmit
```

Pruebas:
- Las unitarias van junto al código (`src/**/*.test.ts`).
- Las de integración (`ledger.test.ts`) usan un PGlite en memoria que levanta `test/global-setup.ts` en el puerto 5434, con las migraciones aplicadas. No tocan tu base local.
- Vitest corre con `pool: "threads"`, porque Bun no soporta `forks`, y con `TZ=UTC`, igual que Vercel.
- PGlite ejecuta las transacciones de una en una, así que las pruebas de concurrencia pasan ahí aunque no haya bloqueo, y no reproduce los deadlocks. La concurrencia se verificó contra Neon con peticiones HTTP simultáneas. En Neon apareció un deadlock entre `FOR UPDATE` y el candado `KEY SHARE` de las llaves foráneas; por eso `lockUser` usa `FOR NO KEY UPDATE`.

Corre Prisma siempre con `bun --bun run prisma …` (los scripts ya lo hacen) para que se cargue `.env`.
- En local con PGlite, `db:migrate` usa la base sombra que levanta `db:local` (`SHADOW_DATABASE_URL`): PGlite ignora el nombre de la base, así que sin ella Prisma creaba su base sombra encima de la real (error P3005). Si `.env` apunta a Neon, quita esa variable.
- En VS Code, `.vscode/tasks.json` tiene tareas para todo esto (Terminal → Run Task), incluida «0. Verificar todo» (pruebas, tipos y lint; deja el resultado en `.next/verificacion.log`).
- Migraciones y seed usan `DATABASE_URL_UNPOOLED`, la conexión directa, porque el pooler de Neon rompe Prisma Migrate. Si no existe, usan `DATABASE_URL`.
- **Ramas de Neon:**
  - `production` es la que usa Vercel (variables cargadas en el proyecto de Vercel, solo para Production).
  - `dev` es para el desarrollo local: es permanente, se creó como copia de `production` y `.env` apunta a ella. `bun run dev`, `db:migrate` y `db:seed` trabajan sobre `dev`.
  - Para cambiar de rama usa `neon checkout <rama>`, que reescribe las URLs en `.env`. **Nunca hagas `neon checkout production` para desarrollar.**
  - Flujo de migraciones: primero `bun run db:migrate` en `dev`. Para producción, aplica las migraciones con `DATABASE_URL_UNPOOLED` de `production` (`bun run db:deploy` con esa variable) antes de desplegar en Vercel.
  - Las ramas nuevas que no se llamen `dev` expiran a los 7 días (política en `neon.ts`).
- `bun run start` (modo producción) en local necesita `AUTH_TRUST_HOST=true`. En Vercel no hace falta.

## Estructura

- `src/auth.ts`: configuración de Auth.js.
- `src/lib/auth/session.ts`: `getSessionUser`, `requireUser(roles)` para páginas y `authorizeApi(roles)` para endpoints. Lee el rol de la base de datos, no del token.
- `src/lib/points/`: todo lo que da, quita o suma puntos.
  - Funciones puras con su `*.test.ts` al lado: `eco-score.ts`, `purchase.ts`, `bill.ts` (reducción y `needsDetailedReview`), `limits.ts` (`applyLimit` y `periodRange` en hora de CDMX), `levels.ts`, `impact.ts` y `rules.ts` (claves de `Rule`).
  - `ledger.ts`: la única puerta de escritura. Contiene `creditPurchase`, `creditBringContainer`, `creditRecycle`, `creditBillReduction` y `debitPoints`. Cada una recibe el `tx` de `db.$transaction`, bloquea la fila del usuario y truena si se llama fuera de una transacción. Los errores esperados son `PointsError` con `code`: `ALREADY_CREDITED`, `INSUFFICIENT_BALANCE`, `USER_NOT_FOUND` o `RULES_MISSING`.
  - `balance.ts`: `getBalance` y `getLevel` para las páginas (solo en el servidor).
- `src/lib/qr.ts`: `signTicket` y `verifyTicket` (HMAC con `QR_SECRET`, comparación en tiempo constante, vence a los 15 min). Solo corre en el servidor. `src/lib/qr-token.ts` tiene `ticketUrl` y `extractTicketToken`, que también corren en el navegador.
- `src/lib/sales.ts`: `createSale` (precios y Eco Score salen de la base de datos) y `claimSale` (reclamo atómico: marca la venta y acredita compra y envase en la misma transacción). Los errores son `SaleError` con `code`.
- Endpoints de ventas: `POST /api/sales` (operador), `POST /api/sales/claim` (con sesión, con rate limit) y `GET /api/sales/:id` (estado para la caja; cada operador ve solo sus ventas).
- Pantallas: `src/app/operador/caja` (caja) y `src/app/escanear` (escáner con `html5-qrcode`). `escanear` está fuera del grupo `(cliente)` para que el login regrese al ticket con `?next=`.
- `src/lib/bills.ts`: recibos de la Fase 4. `createBillDraft` (borrador con lo leído por el OCR), `submitBill` (el cliente confirma y envía; aplica el antifraude), `reviewBill` (el operador aprueba y acredita con `creditBillReduction`, o rechaza con motivo), `deleteBill` y `estimateBill`. Los errores son `BillError` con `code`. `submitBill` y `reviewBill` se llaman dentro de `db.$transaction`.
- `src/lib/bills/`: `parse.ts` (lee servicio, periodo y consumo del texto, con pruebas), `file.ts` (tipo real del archivo por sus primeros bytes y SHA-256), `limits.ts` y `labels.ts`.
- `src/lib/ocr.ts`: texto del recibo. Con un PDF usa unpdf; con una foto, Tesseract.js en español (descarga el idioma a la carpeta temporal la primera vez). Si falla devuelve null y el usuario escribe los datos.
- Endpoints de recibos: `POST /api/bills` (subir, con rate limit), `PATCH /api/bills/:id` (confirmar y enviar), `DELETE /api/bills/:id`, `GET /api/bills/:id/file` (dueño u operador, sin caché), `GET /api/bills?status=` y `POST /api/bills/:id/review` (operador).
- Pantallas de recibos: `src/app/(cliente)/recibos` (subir, confirmar, estado) y `src/app/operador/recibos` (cola y revisión).
- `src/lib/db.ts`: cliente Prisma único.
- `src/lib/rate-limit.ts`: rate limit en memoria, por instancia.
- `src/app/(auth)`: login y registro. `src/app/(cliente)`: pantallas del cliente. `src/app/operador` y `src/app/admin`: áreas protegidas.
- `prisma/schema.prisma` y `prisma/seed.ts`.

## Reglas que no se rompen

- **El saldo SIEMPRE es la suma de `PointEntry`.** Nunca se guarda como campo.
- **Toda acreditación de puntos** va dentro de una transacción (`db.$transaction`) y pasa por `src/lib/points/`.
- **Los permisos se revisan en el servidor** en cada endpoint (`authorizeApi`) y en cada página (`requireUser`). Revisarlos en el layout no basta, y la interfaz nunca decide permisos.
- Una misma evidencia no paga dos veces: lo garantiza `@@unique([type, sourceId])` en `PointEntry`.
- Interfaz en español, pensada primero para celular (columna de `max-w-2xl` y botones de al menos 44 px de alto).
- Nada de secretos en el código. Todo va en `.env`, y `.env.example` queda documentado.
- Commits pequeños por funcionalidad, con mensajes en español.
- Si la spec es ambigua o choca con una buena práctica, se pregunta en lugar de suponer.

## Decisiones tomadas (diferencias con SPEC.md)

- `Rule` usa una clave de texto (`PURCHASE_A`, `PURCHASE_B`, `PURCHASE_C`, `BRING_CONTAINER`, `RECYCLE`, `BILL_REDUCTION`, `CHALLENGE`) en vez de `EntryType`. Así las compras pueden tener tres valores.
- `limitCount` en `Rule` cambia de significado según la regla: veces por periodo (envase), piezas por periodo (reciclaje) o puntos máximos por recibo (reducción).
- `Bill` es único por `[kind, serviceNumber, periodStart]`.
- Se agregaron relaciones (`Sale`, `RecycleClaim`, `Redemption`), `createdAt` en `Sale` y `Bill`, y un índice `PointEntry(userId, type, createdAt)`.
- El admin también puede entrar al área de operador.
- Días y semanas de los límites: hora de Ciudad de México, con semanas de lunes a domingo.
- Compras: `floor(subtotal del renglón / $10) × tasa`. El bono de nivel se aplica al total, redondeando hacia abajo, y sale del nivel que tenía el usuario antes de esa compra.
- Recibos: se compara el consumo diario promedio, con días = `periodEnd − periodStart`. El porcentaje se redondea a 2 decimales antes de calcular los bloques de 5%. kWh o m³ ahorrados = (diario anterior − diario actual) × días del periodo actual. El primer recibo crea un movimiento de 0 puntos como línea base.
- Envase extra en el mismo día: se registra con 0 puntos y cuenta como envase evitado.
- Reciclaje que rebasa las 20 piezas semanales: se aprueba completo y registra todas las piezas en el impacto, pero solo paga las que caben (`impact.paidPieces`).
- Nivel: puntos positivos de los últimos 180 días, sin contar `REDEEM` ni `DONATION`.
- El QR contiene una URL (`/escanear?t=<token>`), así que también funciona con la cámara normal del teléfono.
- Puede reclamar un ticket cualquier usuario con sesión, excepto el operador que registró esa venta.
- `Sale.points` guarda los puntos base, sin bono. El bono de nivel se calcula al reclamar y queda en el `PointEntry`.
- Se permite una venta sin productos si el cliente trajo su envase.
- El límite de envase se cuenta para quien reclama el ticket.
- Las pruebas de integración corren con `fileParallelism: false` porque comparten una sola base de datos. `test/db.ts` tiene `createTestDb` y `resetDb`.
- Recibos: estado propio `BillStatus` con `DRAFT` (subido, sin confirmar). Lo leído por el OCR va en columnas `ocr*` aparte de lo confirmado, y las restricciones únicas solo aplican a lo confirmado.
- El archivo del recibo se guarda en la base (`BillFile`, BYTEA) y no en Vercel Blob: queda privado detrás de los permisos y funciona igual en local. Se borra al terminar el piloto.
- Un recibo rechazado se corrige y se reenvía (vuelve a `PENDING`), o se borra. El cliente puede borrar borradores y rechazados.
- El número de servicio queda ligado a la cuenta (`ServiceAccount`) al aprobar. Al enviar se rechaza si ya es de otra cuenta o está en un recibo pendiente de otra persona.
- Periodos: de 20 a 100 días, sin terminar en el futuro y sin encimarse con otro recibo pendiente o aprobado del mismo servicio (se toleran 3 días). Se compara contra el recibo APROBADO anterior.
- Revisión detallada: además de lo que pide SPEC.md, también si el número de servicio o el inicio del periodo no coinciden con lo leído por el OCR.
- Nadie valida su propio recibo, igual que el operador no canjea sus propias ventas.
- Tickets de prueba: `bun run tickets:demo` crea ventas reales del operador demo en la base local y guarda sus QR en `tickets-demo/` (ignorada en git).
- `next.config.ts`: `allowedDevOrigins` permite abrir `next dev` desde el celular en la red local; `serverExternalPackages` y `outputFileTracingIncludes` llevan Tesseract.js a la función de `/api/bills`. Esto último no se ha probado en Vercel.

## Usuarios demo (seed)

`cliente@ecopuntos.test`, `operador@ecopuntos.test` y `admin@ecopuntos.test`. La contraseña es el valor de `SEED_DEMO_PASSWORD` en `.env`.
