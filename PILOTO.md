# Guía del piloto de EcoPuntos

Para el equipo: cómo publicar la app, prepararla, probarla con pocas personas, operarla durante las 2 o 3 semanas y cerrarla. La parte técnica está en [CLAUDE.md](CLAUDE.md).

## 1. Publicar (una sola vez)

Producción: https://ecopuntos-eight.vercel.app. **Cada push a `main` despliega solo**, así que el orden importa.

1. **Variables en Vercel** (proyecto `ecopuntos` → Settings → Environment Variables → Production). Deben existir:
   - `DATABASE_URL` y `DATABASE_URL_UNPOOLED`: las de la rama `production` de Neon (ya están).
   - `AUTH_SECRET` y `QR_SECRET`: largos y aleatorios, **distintos** de los de tu `.env` local. Si `AUTH_SECRET` cambia, todos cierran sesión y cambian los seudónimos del CSV.
   - `FE_SEN="0.444"`: factor oficial vigente (ver `.env.example`).
   - `PRIVACY_CONTACT_EMAIL`: el correo del equipo para dudas de privacidad.
   - **No** pongas `SHADOW_DATABASE_URL` en Vercel: es solo para desarrollo local.
2. **Migraciones en Neon `production`**, antes del merge. Desde tu computadora, con la `DATABASE_URL_UNPOOLED` de `production` en la terminal (sin cambiar tu `.env`):
   ```powershell
   $env:DATABASE_URL_UNPOOLED="<cadena directa de production>"; bun run db:deploy; Remove-Item Env:DATABASE_URL_UNPOOLED
   ```
   Aplica `recibos_fase4`, `reciclaje_retos_canjes` y `ajustes_y_privacidad`. Las dos primeras recrean columnas de `Bill`: es seguro porque esa tabla está vacía en producción. Confírmalo antes con `select count(*) from "Bill";`.
3. **Merge a `main` en orden**: `fase-4-recibos` → `fase-5-reciclaje-retos-canjes` → `fase-6-impacto-metricas-pwa` → `fase-7-pulido` (cada una sale de la anterior). Revisen el diff de cada pull request: en la exposición les van a preguntar.
4. **Datos iniciales**, solo si la base de producción no los tiene (productos, reglas, retos, recompensas, contenedor): `bun run db:seed` con la misma variable del paso 2 y un `SEED_DEMO_PASSWORD` fuerte. El seed crea tres cuentas demo: después cambia su rol o no compartas la contraseña.

## 2. Preparar el piloto

- **Cuentas del equipo**: cada persona se registra normalmente; un admin entra a **Admin → Usuarios y roles** y la hace **Operador**. Nadie puede cambiar su propio rol.
- **Catálogo y reglas**: revisa precios y criterios en **Admin → Catálogo** y los puntos en **Admin → Reglas**.
- **Retos**: ajusta fechas y metas en **Admin → Retos** para que coincidan con el piloto.
- **Recompensas**: pon el stock real en **Admin → Recompensas**.
- **QR del contenedor**: **Operador → Validar reciclaje → Descargar para imprimir**. Imprímelo grande y pégalo en el contenedor.
- **Instalar en el celular**: en Android, Chrome ofrece "Instalar app"; en iPhone, Safari → Compartir → "Agregar a inicio". Pruébenlo en los dos.

## 3. Prueba con 3 o 4 personas (antes de abrirlo a todos)

Cada quien con su propio celular y su propia cuenta. Anoten todo lo que confunda o falle.

| # | Quién | Qué hacer | Qué debe pasar |
|---|---|---|---|
| 1 | Cliente | Registrarse desde el celular | Pide aceptar el aviso de privacidad y entra al inicio |
| 2 | Cliente | Instalar la app en el celular | Queda el ícono del brote en la pantalla de inicio |
| 3 | Operador | En la caja, vender un producto A y marcar "trajo envase" | Muestra el QR del ticket |
| 4 | Cliente | Escanear el QR con la cámara de la app | "+N puntos"; la caja dice que ya se canjeó |
| 5 | Cliente | Escanear el mismo QR otra vez | "Este ticket ya se canjeó" |
| 6 | Cliente | Subir un recibo real de CFE (foto y PDF) | Llena servicio, periodo y consumo; corregir y enviar |
| 7 | Operador | Aprobar el recibo | El primero queda como punto de partida (0 puntos) |
| 8 | Cliente | Escanear el QR del contenedor y registrar piezas | Queda "por confirmar" |
| 9 | Operador | Confirmar las piezas (corrigiendo si hace falta) | Suman 5 puntos por pieza |
| 10 | Cliente | Canjear el cupón de $10 | Sale el cupón con su QR |
| 11 | Operador | Caja → Cupones: escanear el cupón y entregarlo | Queda usado; no se puede usar dos veces |
| 12 | Todos | Revisar Retos, Mi impacto y /impacto | Los números cuadran con lo que hicieron |

Lo que falle, corríjanlo antes de abrir el piloto. Los recibos de CFE reales son la parte más frágil: si el lector no reconoce algún dato, el usuario lo escribe y el operador lo revisa con más cuidado.

## 4. Durante el piloto

- Revisen **Operador → Validar recibos** y **Validar reciclaje** al menos una vez al día. Los recibos marcados "⚠️ Revisar con detalle" se comparan contra la foto.
- Si algo se acreditó mal, corríjanlo con **Admin → Usuarios → Ajustar puntos**, siempre con motivo. Queda registrado.
- **Admin** muestra participantes, puntos, ventas, cupones e impacto. **/impacto** es la página pública para proyectar.

## 5. Cerrar el piloto

En **Admin → Cierre del piloto**, en este orden:

1. Descargar los CSV (movimientos e impacto por semana) para el reporte. Las personas salen como `U-xxxxxxxx`.
2. Terminar los recibos pendientes.
3. **Borrar las fotos y PDF de los recibos**, como promete el aviso de privacidad. Se conservan servicio, periodo, consumo y puntos.

## Antes de publicar el aviso de privacidad

El texto de `/privacidad` es una base razonable para un proyecto escolar, pero no es asesoría legal: pídanle a su profesor que lo revise y llenen `PRIVACY_CONTACT_EMAIL`.
