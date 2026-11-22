# EcoPuntos

PWA de puntos por consumo y acciones sustentables, hecha para un proyecto escolar de Desarrollo Sustentable.

- Especificación: [SPEC.md](SPEC.md)
- Comandos, convenciones y estado del proyecto: [CLAUDE.md](CLAUDE.md)

## Arranque rápido (local)

1. Instala [Bun](https://bun.sh) y corre `bun install`.
2. Copia `.env.example` a `.env` y llena los secretos (`AUTH_SECRET`, `QR_SECRET` y `SEED_DEMO_PASSWORD`).
3. En una terminal, corre `bun run db:local` y déjala abierta. Es un Postgres local (PGlite), con su base sombra para Prisma.
4. En otra terminal, corre `bun run db:deploy`, luego `bun run db:seed` y luego `bun run dev`.
5. Abre http://localhost:3000. Los usuarios demo están en [CLAUDE.md](CLAUDE.md); su contraseña es `SEED_DEMO_PASSWORD`.

Para cambiar el esquema usa `bun run db:migrate`. Para probar la caja sin generar ventas a mano, `bun run tickets:demo` deja QR de prueba en `tickets-demo/`.

En VS Code, todo lo anterior está en **Terminal → Run Task** («EcoPuntos: inicializar todo» la primera vez y «EcoPuntos: arrancar» después).
