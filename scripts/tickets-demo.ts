// Tickets de prueba para escanear en local.
//
// Crea ventas reales del "Operador Demo" en la base LOCAL (bun run db:local) y
// guarda sus QR en tickets-demo/ (PNG sueltos + index.html para ver o imprimir).
//
//   bun run tickets:demo
//
// - Los QR válidos vencen a los 15 minutos (QR_TTL_SECONDS), igual que en la caja.
//   Vuelve a correr el script para tener tickets nuevos.
// - Cada ticket se canjea UNA sola vez y con un usuario distinto del operador
//   (usa cliente@ecopuntos.test).
// - El QR lleva la URL de la red local (p. ej. http://192.168.x.x:3000/escanear?t=…)
//   para que también funcione con la cámara normal del celular conectado al mismo
//   Wi-Fi. Para otra dirección: TICKETS_BASE_URL=http://… bun run tickets:demo
import { mkdir, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import QRCode from "qrcode";
import { PrismaClient } from "../src/generated/prisma/client";
import { getQrSecret, newNonce, QR_TTL_SECONDS, signTicket, ticketUrl } from "../src/lib/qr";
import { type CreateSaleInput, createSale } from "../src/lib/sales";

const PORT = process.env.PORT ?? "3000";
const OUT_DIR = path.resolve(process.cwd(), "tickets-demo");
const OPERATOR_EMAIL = "operador@ecopuntos.test";
const TZ = "America/Mexico_City";

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Falta DATABASE_URL en .env");
const dbHost = new URL(connectionString).hostname;
if (!["127.0.0.1", "localhost", "[::1]"].includes(dbHost)) {
  console.error(
    `DATABASE_URL apunta a ${dbHost}. Este script solo crea ventas de prueba en la base local ` +
      "(bun run db:local); no lo corras contra Neon.",
  );
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** IP de la red local (Wi-Fi o cable), para que el celular pueda abrir la URL del QR. */
function lanAddress(): string | null {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a!.address);
  const rank = (ip: string) => (ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : 2);
  return addresses.filter((ip) => rank(ip) < 2).sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

type Ticket = {
  file: string;
  title: string;
  description: string;
  expected: string;
  /** Texto que va dentro del QR. */
  content: string;
  /** Enlace para abrirlo en esta misma computadora (sin cámara). */
  localLink: string | null;
};

type SaleScenario = {
  file: string;
  title: string;
  description: string;
  sale: CreateSaleInput;
  /** Para el ticket vencido: la venta se crea como si fuera de hace N minutos. */
  minutesAgo?: number;
  expected: (basePoints: number) => string;
};

const scenarios: SaleScenario[] = [
  {
    file: "01-compra-eco-a",
    title: "Compra con Eco Score A",
    description: "2 × Jabón líquido a granel ($90). A paga 3 puntos por cada $10.",
    sale: { items: [{ productId: "prod-jabon-granel", qty: 2 }], broughtContainer: false },
    expected: (p) => `+${p} puntos (más el bono de nivel, si el usuario ya subió de nivel).`,
  },
  {
    file: "02-compra-variada",
    title: "Compra variada (A, B, C y sin Eco Score)",
    description:
      "Jabón a granel (A), cepillo de bambú (B), 2 popotes de acero (C) y galletas artesanales (sin Eco Score, no suman).",
    sale: {
      items: [
        { productId: "prod-jabon-granel", qty: 1 },
        { productId: "prod-cepillo-bambu", qty: 1 },
        { productId: "prod-popote-acero", qty: 2 },
        { productId: "prod-galletas", qty: 1 },
      ],
      broughtContainer: false,
    },
    expected: (p) => `+${p} puntos de compra.`,
  },
  {
    file: "03-solo-envase",
    title: "Solo trajo su envase",
    description: "Venta sin productos: el cliente solo trajo su envase.",
    sale: { items: [], broughtContainer: true },
    expected: () => "+10 puntos por envase (máximo una vez al día por usuario).",
  },
  {
    file: "04-compra-y-envase",
    title: "Compra + envase",
    description: "Bolsa de tela reutilizable (B, $60) y el cliente trajo su envase.",
    sale: { items: [{ productId: "prod-bolsa-tela", qty: 1 }], broughtContainer: true },
    expected: (p) =>
      `+${p} de compra y +10 por envase. Si ese mismo día ya canjeaste el ticket 03, ` +
      "el envase suma 0 y aparece el aviso de límite diario.",
  },
  {
    file: "05-ticket-vencido",
    title: "Ticket vencido",
    description: "Venta registrada hace 20 minutos: su QR ya pasó los 15 minutos de vigencia.",
    sale: { items: [{ productId: "prod-miel-local", qty: 1 }], broughtContainer: false },
    minutesAgo: 20,
    expected: () => "Error: «QR vencido: pide al cajero que genere uno nuevo».",
  },
];

async function main() {
  const secret = getQrSecret();
  const operator = await db.user.findUnique({ where: { email: OPERATOR_EMAIL } });
  if (!operator) throw new Error(`No existe ${OPERATOR_EMAIL}. Corre primero: bun run db:seed`);

  const lan = lanAddress();
  const baseUrl = process.env.TICKETS_BASE_URL ?? `http://${lan ?? "localhost"}:${PORT}`;
  const localBase = `http://localhost:${PORT}`;
  const now = new Date();

  const tickets: Ticket[] = [];
  for (const s of scenarios) {
    const createdAt = new Date(now.getTime() - (s.minutesAgo ?? 0) * 60_000);
    const { sale, token } = await createSale(db, { ...s.sale, operatorId: operator.id, secret, now: createdAt });
    tickets.push({
      file: s.file,
      title: s.title,
      description: s.description,
      expected: s.expected(sale.points),
      content: ticketUrl(baseUrl, token),
      localLink: ticketUrl(localBase, token),
    });
  }

  // QR con firma alterada: no existe en la base y la firma no coincide con QR_SECRET.
  const forged = signTicket(
    { saleId: "venta-falsa", nonce: newNonce(), expiresAt: new Date(now.getTime() + QR_TTL_SECONDS * 1000) },
    "esta-no-es-la-clave-QR_SECRET-de-la-app",
  );
  tickets.push(
    {
      file: "06-qr-alterado",
      title: "QR alterado (firma inválida)",
      description: "Parece un ticket, pero no lo firmó la app.",
      expected: "Error: «QR inválido».",
      content: ticketUrl(baseUrl, forged),
      localLink: ticketUrl(localBase, forged),
    },
    {
      file: "07-no-es-ticket",
      title: "Código que no es de EcoPuntos",
      description: "Un QR cualquiera con la URL de otro sitio.",
      expected: "Error en el escáner de la app: «Ese código no es un ticket de EcoPuntos».",
      content: "https://example.com/promocion",
      localLink: null,
    },
    {
      file: "08-contenedor-reciclaje",
      title: "Contenedor de reciclaje (Fase 5)",
      description: "QR del contenedor CAMPUS-01. El reciclaje todavía no está implementado.",
      expected: "Aviso en el escáner de la app: «Los contenedores de reciclaje llegan pronto».",
      content: "bin:CAMPUS-01",
      localLink: null,
    },
  );

  await mkdir(OUT_DIR, { recursive: true });
  const qrOptions = { width: 600, margin: 2, errorCorrectionLevel: "M" as const };
  const cards: string[] = [];
  for (const t of tickets) {
    await QRCode.toFile(path.join(OUT_DIR, `${t.file}.png`), t.content, qrOptions);
    const dataUrl = await QRCode.toDataURL(t.content, qrOptions);
    cards.push(card(t, dataUrl));
  }

  const validUntil = new Date(now.getTime() + QR_TTL_SECONDS * 1000);
  await writeFile(path.join(OUT_DIR, "index.html"), page(cards, now, validUntil, baseUrl), "utf8");

  console.log(`Listo: ${tickets.length} tickets en ${OUT_DIR}`);
  console.log(`Los QR válidos vencen a las ${time(validUntil)}. Abre tickets-demo/index.html para verlos.`);
  console.log(`URL dentro de los QR: ${baseUrl}`);
}

function time(d: Date) {
  return d.toLocaleTimeString("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

function esc(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function card(t: Ticket, dataUrl: string) {
  const link = t.localLink
    ? `<a href="${esc(t.localLink)}" target="_blank" rel="noopener">Canjear sin cámara (abre en esta computadora)</a>`
    : "";
  return `<article>
  <img src="${dataUrl}" alt="QR: ${esc(t.title)}">
  <div>
    <p class="num">${esc(t.file)}.png</p>
    <h2>${esc(t.title)}</h2>
    <p>${esc(t.description)}</p>
    <p class="exp"><strong>Resultado esperado:</strong> ${esc(t.expected)}</p>
    ${link}
  </div>
</article>`;
}

function page(cards: string[], generated: Date, validUntil: Date, baseUrl: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tickets de prueba · EcoPuntos</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 960px; padding: 24px; color: #1f2a1f; }
  h1 { margin: 0 0 4px; }
  .aviso { background: #fff7e0; border: 1px solid #f0d58a; border-radius: 8px; padding: 12px 16px; margin: 16px 0 24px; }
  .aviso p { margin: 4px 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 16px; }
  article { display: flex; gap: 16px; border: 1px solid #d5e2d5; border-radius: 12px; padding: 16px; break-inside: avoid; }
  article img { width: 180px; height: 180px; flex-shrink: 0; }
  h2 { font-size: 1.05rem; margin: 2px 0 6px; }
  article p { margin: 4px 0; font-size: .9rem; }
  .num { color: #5b6b5b; font-family: ui-monospace, monospace; font-size: .8rem; }
  .exp { background: #eef6ee; border-radius: 6px; padding: 6px 8px; }
  a { font-size: .85rem; }
  @media print { .aviso { break-after: avoid; } a { display: none; } }
</style>
</head>
<body>
<h1>Tickets de prueba · EcoPuntos</h1>
<p>Generados el ${generated.toLocaleString("es-MX", { timeZone: TZ, dateStyle: "long", timeStyle: "short" })}.</p>
<div class="aviso">
  <p><strong>Los QR válidos vencen a las ${time(validUntil)}</strong> (15 minutos, igual que en la caja). Para tener nuevos, corre <code>bun run tickets:demo</code> o la tarea «Generar tickets demo» de VS Code.</p>
  <p>Canjéalos con <code>cliente@ecopuntos.test</code>: el operador no puede canjear sus propias ventas. Cada ticket se canjea una sola vez; escanéalo dos veces para ver «Este ticket ya se canjeó».</p>
  <p>Con la cámara del celular (mismo Wi-Fi) el QR abre <code>${esc(baseUrl)}</code>. En la computadora usa <a href="http://localhost:3000/escanear" target="_blank" rel="noopener">localhost:3000/escanear</a> → «Abrir cámara».</p>
</div>
<div class="grid">
${cards.join("\n")}
</div>
</body>
</html>
`;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
