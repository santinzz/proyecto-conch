// Cuenta demo con historial: "Enrique de Leon Lopez", con 2 meses de actividad
// (compras en el stand, envases, reciclaje, recibos de luz, un reto y canjes).
// Todos los datos son ficticios. Las fechas son relativas al momento de correr
// el seed, así que la cuenta siempre aparenta llevar ~2 meses de uso.
//
// Respeta las reglas del motor de puntos (SPEC.md): el saldo es la suma de
// PointEntry, 1 envase pagado por día, máximo 20 piezas de reciclaje por semana,
// bono de nivel en compras y reducción de recibo por cada 5%.
//
// Es idempotente: si la cuenta ya tiene movimientos, no hace nada.
import { createHash } from "node:crypto";
import { BillKind, EntryType, EvidenceStatus, type PrismaClient, Role } from "../src/generated/prisma/client";
import { billReduction } from "../src/lib/points/bill";
import { ecoScore, type EcoScore } from "../src/lib/points/eco-score";
import { billImpact } from "../src/lib/points/impact";
import { levelFor } from "../src/lib/points/levels";

export const ENRIQUE_EMAIL = "enrique@ecopuntos.test";

const DAY = 24 * 60 * 60 * 1000;
const RATE: Record<EcoScore, number> = { A: 3, B: 2, C: 1 };

type ProductRow = {
  id: string;
  name: string;
  priceCents: number;
  bulk: boolean;
  local: boolean;
  plasticFree: boolean;
  certified: boolean;
};

// Compras en el stand: [días atrás, hora, renglones [productId, qty], trajo envase]
const SALES: [number, number, [string, number][], boolean][] = [
  [60, 10, [["prod-bolsa-tela", 1], ["prod-galletas", 1]], false],
  [57, 13, [["prod-jabon-granel", 1]], true],
  [53, 11, [["prod-cepillo-bambu", 2]], false],
  [50, 12, [["prod-jabon-granel", 1], ["prod-popote-acero", 1]], true],
  [46, 10, [["prod-miel-local", 1]], true],
  [43, 14, [["prod-jabon-granel", 2]], true],
  [39, 11, [["prod-galletas", 2], ["prod-cepillo-bambu", 1]], true],
  [35, 13, [["prod-miel-local", 1], ["prod-jabon-granel", 1]], true],
  [31, 10, [["prod-popote-acero", 2]], false],
  [27, 12, [["prod-jabon-granel", 1]], true],
  [23, 11, [["prod-miel-local", 2]], true],
  [19, 13, [["prod-bolsa-tela", 1], ["prod-jabon-granel", 1]], true],
  [14, 10, [["prod-cepillo-bambu", 1], ["prod-galletas", 1]], false],
  [10, 12, [["prod-jabon-granel", 2]], true],
  [6, 11, [["prod-miel-local", 1]], true],
  [2, 13, [["prod-jabon-granel", 1], ["prod-popote-acero", 1]], true],
];

// Reciclaje: [días atrás, piezas] (separados más de una semana: cada uno paga completo).
const RECYCLES: [number, number][] = [
  [55, 12],
  [47, 18],
  [38, 9],
  [29, 15],
  [20, 20],
  [11, 14],
  [3, 11],
];

const RETO_PASADO = {
  id: "reto-envase-octubre",
  title: "Trae tu envase 5 veces (primer mes)",
  metric: "BRING_CONTAINER_count",
  target: 5,
  reward: 100,
  startsDaysAgo: 58,
  endsDaysAgo: 30,
};

export async function seedEnrique(
  db: PrismaClient,
  opts: { passwordHash: string; products: ProductRow[]; feSen: number; now: Date },
) {
  const { now } = opts;
  const at = (daysAgo: number, hour = 12, minute = 0) => {
    const d = new Date(now.getTime() - daysAgo * DAY);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const operator = await db.user.findUniqueOrThrow({ where: { email: "operador@ecopuntos.test" } });
  const createdAt = at(62, 9, 30);
  const user = await db.user.upsert({
    where: { email: ENRIQUE_EMAIL },
    update: { passwordHash: opts.passwordHash },
    create: {
      email: ENRIQUE_EMAIL,
      name: "Enrique de Leon Lopez",
      role: Role.CUSTOMER,
      passwordHash: opts.passwordHash,
      createdAt,
      privacyAcceptedAt: createdAt,
    },
  });

  if ((await db.pointEntry.count({ where: { userId: user.id } })) > 0) {
    console.log("Enrique de Leon Lopez ya tiene historial; no se toca.");
    return;
  }

  // Eventos en orden cronológico para calcular el nivel (bono de compra) en cada momento.
  type Entry = {
    type: EntryType;
    points: number;
    sourceId: string;
    impact?: object;
    createdAt: Date;
  };
  const entries: Entry[] = [];
  let earned = 0;
  const credit = (e: Entry) => {
    entries.push(e);
    if (e.points > 0) earned += e.points;
  };

  const productById = new Map(opts.products.map((p) => [p.id, p]));
  type Event = { when: Date; run: () => Promise<void> };
  const events: Event[] = [];

  // Compras + envases
  let containers = 0;
  SALES.forEach(([daysAgo, hour, lines, broughtContainer], i) => {
    const when = at(daysAgo, hour, 15);
    events.push({
      when,
      run: async () => {
        const items = lines.map(([productId, qty]) => {
          const p = productById.get(productId)!;
          return { productId, qty, priceCents: p.priceCents, ecoScore: ecoScore(p) };
        });
        const base = items.reduce(
          (s, it) => s + (it.ecoScore ? Math.floor((it.qty * it.priceCents) / 1000) * RATE[it.ecoScore] : 0),
          0,
        );
        const bonusPct = levelFor(earned).purchaseBonusPct;
        const points = base + Math.floor((base * bonusPct) / 100);
        const saleId = `sale-enrique-${String(i + 1).padStart(2, "0")}`;
        await db.sale.create({
          data: {
            id: saleId,
            operatorId: operator.id,
            items,
            totalCents: items.reduce((s, it) => s + it.qty * it.priceCents, 0),
            points: base, // Sale.points guarda los puntos base; el bono va en el PointEntry
            broughtContainer,
            qrNonce: `seed-enrique-${saleId}`,
            expiresAt: new Date(when.getTime() + 15 * 60 * 1000),
            claimedById: user.id,
            claimedAt: new Date(when.getTime() + 3 * 60 * 1000),
            createdAt: when,
          },
        });
        const claimedAt = new Date(when.getTime() + 3 * 60 * 1000);
        credit({ type: EntryType.PURCHASE, points, sourceId: saleId, createdAt: claimedAt });
        if (broughtContainer) {
          credit({
            type: EntryType.BRING_CONTAINER,
            points: 10,
            sourceId: saleId,
            impact: { containers: 1 },
            createdAt: claimedAt,
          });
          // Reto del primer mes: se completa con el 5.º envase dentro de su ventana.
          if (daysAgo <= RETO_PASADO.startsDaysAgo && daysAgo >= RETO_PASADO.endsDaysAgo) {
            containers++;
            if (containers === RETO_PASADO.target) {
              credit({
                type: EntryType.CHALLENGE,
                points: RETO_PASADO.reward,
                sourceId: `${RETO_PASADO.id}:${user.id}`,
                createdAt: new Date(claimedAt.getTime() + 1000),
              });
            }
          }
        }
      },
    });
  });

  // Reciclaje (pendiente de revisión → aprobado al día siguiente)
  RECYCLES.forEach(([daysAgo, pieces], i) => {
    const when = at(daysAgo, 16, 40);
    events.push({
      when,
      run: async () => {
        const claimId = `recycle-enrique-${i + 1}`;
        const reviewedAt = new Date(when.getTime() + 20 * 60 * 60 * 1000);
        await db.recycleClaim.create({
          data: {
            id: claimId,
            userId: user.id,
            binId: (await db.recycleBin.findUniqueOrThrow({ where: { code: "CAMPUS-01" } })).id,
            pieces,
            confirmedPieces: pieces,
            status: EvidenceStatus.APPROVED,
            reviewedById: operator.id,
            reviewedAt,
            createdAt: when,
          },
        });
        credit({
          type: EntryType.RECYCLE,
          points: pieces * 5,
          sourceId: claimId,
          impact: { pieces, paidPieces: pieces },
          createdAt: reviewedAt,
        });
      },
    });
  });

  // Recibos de luz: línea base y luego uno con ~12% menos consumo diario.
  const serviceNumber = "571203948816";
  const bills = [
    { id: "bill-enrique-luz-1", periodStart: at(122, 0), periodEnd: at(61, 0), consumption: 380, submitted: 58 },
    { id: "bill-enrique-luz-2", periodStart: at(61, 0), periodEnd: at(3, 0), consumption: 318, submitted: 2 },
  ];
  await db.serviceAccount.create({ data: { kind: BillKind.ELECTRICITY, number: serviceNumber, userId: user.id } });
  bills.forEach((b, i) => {
    const submittedAt = at(b.submitted, 19, 5);
    events.push({
      when: submittedAt,
      run: async () => {
        const prev = i > 0 ? bills[i - 1] : null;
        const result = billReduction(prev, b, { pointsPer5Pct: 50, maxPerBill: 200 });
        const reviewedAt = new Date(submittedAt.getTime() + 18 * 60 * 60 * 1000);
        await db.bill.create({
          data: {
            id: b.id,
            userId: user.id,
            kind: BillKind.ELECTRICITY,
            serviceNumber,
            periodStart: b.periodStart,
            periodEnd: b.periodEnd,
            consumption: b.consumption,
            ocrServiceNumber: serviceNumber,
            ocrPeriodStart: b.periodStart,
            ocrPeriodEnd: b.periodEnd,
            ocrConsumption: b.consumption,
            ocrConfidence: 0.91,
            fileHash: createHash("sha256").update(`seed:${b.id}`).digest("hex"),
            reductionPct: result.baseline ? null : result.reductionPct,
            status: "APPROVED",
            reviewedById: operator.id,
            submittedAt,
            reviewedAt,
            createdAt: new Date(submittedAt.getTime() - 5 * 60 * 1000),
          },
        });
        credit({
          type: EntryType.BILL_REDUCTION,
          points: result.points,
          sourceId: b.id,
          impact: billImpact("ELECTRICITY", result.saved, opts.feSen),
          createdAt: reviewedAt,
        });
      },
    });
  });

  // Canjes: un cupón de $10 (ya usado en el stand) y la donación de un árbol.
  const redemptions = [
    { id: "redeem-enrique-1", rewardId: "rew-cupon-10", cost: 100, code: "ECO-ENRQ-QX7M", daysAgo: 33, usedDaysAgo: 31, donation: false },
    { id: "redeem-enrique-2", rewardId: "rew-arbol", cost: 300, code: "ECO-ENR2-ARB4", daysAgo: 12, usedDaysAgo: 12, donation: true },
  ];
  for (const r of redemptions) {
    const when = at(r.daysAgo, 18, 20);
    events.push({
      when,
      run: async () => {
        await db.reward.update({ where: { id: r.rewardId }, data: { stock: { decrement: 1 } } });
        await db.redemption.create({
          data: {
            id: r.id,
            userId: user.id,
            rewardId: r.rewardId,
            code: r.code,
            usedAt: r.donation ? when : at(r.usedDaysAgo, 12, 30),
            usedById: r.donation ? null : operator.id,
            createdAt: when,
          },
        });
        credit({
          type: r.donation ? EntryType.DONATION : EntryType.REDEEM,
          points: -r.cost,
          sourceId: r.id,
          createdAt: when,
        });
      },
    });
  }

  await db.challenge.upsert({
    where: { id: RETO_PASADO.id },
    update: {},
    create: {
      id: RETO_PASADO.id,
      title: RETO_PASADO.title,
      metric: RETO_PASADO.metric,
      target: RETO_PASADO.target,
      reward: RETO_PASADO.reward,
      startsAt: at(RETO_PASADO.startsDaysAgo, 0),
      endsAt: at(RETO_PASADO.endsDaysAgo, 23, 59),
    },
  });

  events.sort((a, b) => a.when.getTime() - b.when.getTime());
  for (const e of events) await e.run();

  await db.pointEntry.createMany({
    data: entries.map((e) => ({ ...e, userId: user.id, impact: e.impact ?? undefined })),
  });

  const balance = entries.reduce((s, e) => s + e.points, 0);
  console.log(
    `Enrique de Leon Lopez: ${entries.length} movimientos, ${earned} puntos ganados, ` +
      `saldo ${balance}, nivel ${levelFor(earned).name}.`,
  );
}
