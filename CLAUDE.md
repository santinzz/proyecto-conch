@AGENTS.md

# EcoPuntos

PWA de puntos por consumo y acciones sustentables, hecha para un proyecto escolar de Desarrollo Sustentable. El piloto real dura de 2 a 3 semanas con 15 a 30 usuarios, y la app también funciona como caja del stand de productos ecológicos. La especificación completa está en `SPEC.md`, que manda sobre este archivo.

## Estado

- [x] Fase 1: base del proyecto (Next.js, Prisma, Auth.js con roles, seed). Falta el despliegue en Vercel y Neon, que hace el equipo.
- [ ] Fase 2: motor de puntos con pruebas
- [ ] Fase 3: caja y QR del ticket
- [ ] Fase 4: recibos con OCR
- [ ] Fase 5: reciclaje, retos y canjes
- [ ] Fase 6: impacto, métricas y PWA
- [ ] Fase 7: pulido para el piloto

Se trabaja una fase a la vez: primero se presenta un plan corto y se espera el visto bueno.

## Stack

- Bun 1.4 como gestor de paquetes y para correr scripts. No hay Node instalado.
- Next.js 16 (App Router, Turbopack) y TypeScript. **Next 16 cambió APIs:** antes de usar una, revisa `node_modules/next/dist/docs/`. Por ejemplo, `middleware` ahora se llama `proxy`.
- `cacheComponents` está **desactivado** a propósito, porque la sesión y el saldo se leen en cada petición.
- Tailwind 4 y shadcn/ui (estilo base-nova, sobre Base UI). `cn` viene del paquete `cn`. Para un botón que es enlace: `<Button nativeButton={false} render={<Link …/>}>`.
- Prisma 7.10 con `@prisma/adapter-pg`. El cliente se genera en `src/generated/prisma` (está en .gitignore) y la configuración vive en `prisma.config.ts`.
- Auth.js v5 (`next-auth@5 beta`) con correo y contraseña, sesiones JWT y bcryptjs.
- Zod 4 para validar entradas y Vitest para las reglas de negocio.

## Comandos

```bash
bun install            # también corre prisma generate
bun run db:local       # Postgres local con PGlite en 127.0.0.1:5433 (dejarlo abierto)
bun run db:migrate     # crear y aplicar migraciones en dev (prisma migrate dev)
bun run db:seed        # datos demo; es idempotente
bun run db:deploy      # aplicar migraciones en producción (Neon)
bun run db:studio      # explorar la base de datos
bun run dev            # servidor en http://localhost:3000
bun run test           # Vitest
bun run lint
bunx tsc --noEmit
```

Corre Prisma siempre con `bun --bun run prisma …` (los scripts ya lo hacen) para que se cargue `.env`.

## Estructura

- `src/auth.ts`: configuración de Auth.js.
- `src/lib/auth/session.ts`: `getSessionUser`, `requireUser(roles)` para páginas y `authorizeApi(roles)` para endpoints. Lee el rol de la base de datos, no del token.
- `src/lib/points/`: todo lo que da, quita o suma puntos. Contiene `balance.ts` (saldo).
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
- Pendiente para la Fase 4: estado `DRAFT` de recibos y qué hacer con los rechazados (las restricciones únicas bloquean volver a subirlos).

## Usuarios demo (seed)

`cliente@ecopuntos.test`, `operador@ecopuntos.test` y `admin@ecopuntos.test`. La contraseña es el valor de `SEED_DEMO_PASSWORD` en `.env`.
