# EcoPuntos

PWA de puntos por consumo y acciones sustentables, hecha para un proyecto escolar de Desarrollo Sustentable.

- Especificación: [SPEC.md](SPEC.md)
- Comandos, convenciones y estado del proyecto: [CLAUDE.md](CLAUDE.md)

## Arranque rápido (local)

1. Instala [Bun](https://bun.sh) y corre `bun install`.
2. Copia `.env.example` a `.env` y llena los secretos.
3. En una terminal, corre `bun run db:local`. Es un Postgres local y hay que dejarlo abierto.
4. En otra terminal, corre `bun run db:migrate`, luego `bun run db:seed` y luego `bun run dev`.
5. Abre http://localhost:3000.
