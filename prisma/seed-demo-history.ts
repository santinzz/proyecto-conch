// Cuentas demo con historial (datos ficticios):
//   - Enrique de Leon Lopez: ~2 meses de uso, nivel Brote.
//   - Emilio de Hoyos Flores: ~5 meses de uso constante, nivel Árbol (el más alto).
//
// Las fechas son relativas al momento de correr el seed, así que las cuentas
// siempre aparentan la misma antigüedad. Se respetan las reglas del motor de
// puntos (SPEC.md): el saldo es la suma de PointEntry, 1 envase pagado por día,
// máximo 20 piezas de reciclaje por semana, bono de nivel en compras (calculado
// con el nivel previo a cada compra), reducción de recibo por cada 5% con tope
// de 200 y nivel por puntos ganados en los últimos 180 días.
//
// Es idempotente: una cuenta que ya tiene movimientos no se toca.
import { createHash } from "node:crypto";
import { BillKind, EntryType, EvidenceStatus, type PrismaClient, Role } from "../src/generated/prisma/client";
import { billReduction } from "../src/lib/points/bill";
import { ecoScore, type EcoScore } from "../src/lib/points/eco-score";
import { billImpact } from "../src/lib/points/impact";
import { levelFor } from "../src/lib/points/levels";

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

/** [días atrás, hora, minuto] */
type When = [number, number, number];

type DemoProfile = {
  key: string; // prefijo de los ids
  email: string;
  name: string;
  createdDaysAgo: number;
  // [días atrás, hora, renglones [productId, qty], trajo envase]
  sales: [number, number, [string, number][], boolean][];
  // [días atrás, piezas]; como máximo 20 por semana para que paguen completas
  recycles: [number, number][];
  bills: {
    kind: "ELECTRICITY" | "WATER";
    serviceNumber: string;
    // [inicio (días atrás), fin (días atrás), consumo, enviado (días atrás)]
    readings: [number, number, number, number][];
  }[];
  // Retos ya terminados que la cuenta completó.
  challenges: {
    id: string;
    title: string;
    metric: string;
    target: number;
    reward: number;
    startsDaysAgo: number;
    endsDaysAgo: number;
    completedAt: When; // justo después de la evidencia que lo completó
  }[];
  redemptions: {
    rewardId: string;
    cost: number;
    donation: boolean;
    code: string; // ECO-XXXX-XXXX, sin 0, O, 1 ni I
    when: When;
    usedAt?: When; // cupones usados en el stand
  }[];
};

// ------------------------------------------------------------------ Enrique

const ENRIQUE: DemoProfile = {
  key: "enrique",
  email: "enrique@ecopuntos.test",
  name: "Enrique de Leon Lopez",
  createdDaysAgo: 62,
  sales: [
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
  ],
  recycles: [
    [55, 12],
    [47, 18],
    [38, 9],
    [29, 15],
    [20, 20],
    [11, 14],
    [3, 11],
  ],
  bills: [
    {
      kind: "ELECTRICITY",
      serviceNumber: "571203948816",
      readings: [
        [122, 61, 380, 58], // línea base
        [61, 3, 318, 2], // ~12% menos consumo diario
      ],
    },
  ],
  challenges: [
    {
      // 5.º envase dentro de la ventana: la compra de hace 39 días.
      id: "reto-envase-octubre",
      title: "Trae tu envase 5 veces (primer mes)",
      metric: "BRING_CONTAINER_count",
      target: 5,
      reward: 100,
      startsDaysAgo: 58,
      endsDaysAgo: 30,
      completedAt: [39, 11, 19],
    },
  ],
  redemptions: [
    { rewardId: "rew-cupon-10", cost: 100, donation: false, code: "ECO-ENRQ-QX7M", when: [33, 18, 20], usedAt: [31, 12, 30] },
    { rewardId: "rew-arbol", cost: 300, donation: true, code: "ECO-ENR2-ARB4", when: [12, 18, 20] },
  ],
};

// ------------------------------------------------------------------- Emilio

// Canastas que va rotando: casi todo Eco Score A y B, siempre con su envase.
const EMILIO_BASKETS: [string, number][][] = [
  [["prod-jabon-granel", 2], ["prod-miel-local", 1]],
  [["prod-miel-local", 2]],
  [["prod-jabon-granel", 1], ["prod-cepillo-bambu", 2]],
  [["prod-bolsa-tela", 1], ["prod-jabon-granel", 2]],
  [["prod-miel-local", 1], ["prod-cepillo-bambu", 1], ["prod-popote-acero", 1]],
  [["prod-jabon-granel", 3]],
];

const EMILIO: DemoProfile = {
  key: "emilio",
  email: "emilio@ecopuntos.test",
  name: "Emilio de Hoyos Flores",
  createdDaysAgo: 172,
  // Una compra cada 4 días durante ~5.5 meses, todas con envase propio.
  sales: Array.from({ length: 42 }, (_, i) => {
    const daysAgo = 170 - i * 4;
    return [daysAgo, 10 + (i % 5), EMILIO_BASKETS[i % EMILIO_BASKETS.length], true] as DemoProfile["sales"][number];
  }),
  // 20 piezas cada semana (el máximo que paga la regla), 24 semanas seguidas.
  recycles: Array.from({ length: 24 }, (_, i) => [167 - i * 7, 20] as [number, number]),
  bills: [
    {
      kind: "ELECTRICITY",
      serviceNumber: "389150276604",
      readings: [
        [184, 124, 420, 120], // línea base (7.0 kWh/día)
        [124, 64, 336, 60], // −20% → 200 puntos
        [64, 4, 270, 2], // −19.6% → 150 puntos
      ],
    },
    {
      kind: "WATER",
      serviceNumber: "AGD-0457712",
      readings: [
        [178, 118, 30, 115], // línea base (0.5 m³/día)
        [118, 58, 23.4, 55], // −22% → 200 puntos
        [58, 6, 16.6, 4], // −18% → 150 puntos
      ],
    },
  ],
  challenges: [
    {
      id: "reto-envase-10-julio",
      title: "Trae tu envase 10 veces",
      metric: "BRING_CONTAINER_count",
      target: 10,
      reward: 150,
      startsDaysAgo: 171,
      endsDaysAgo: 120,
      completedAt: [134, 14, 19], // 10.ª compra con envase (hace 134 días, 14:18)
    },
    {
      id: "reto-reciclaje-60-agosto",
      title: "Recicla 60 piezas",
      metric: "RECYCLE_pieces",
      target: 60,
      reward: 150,
      startsDaysAgo: 150,
      endsDaysAgo: 110,
      completedAt: [131, 12, 41], // 3.ª entrega de 20 piezas en la ventana (aprobada hace 131 días)
    },
    {
      id: "reto-luz-15-septiembre",
      title: "Reduce 15% tu consumo de luz",
      metric: "ELECTRICITY_reduction_pct",
      target: 15,
      reward: 200,
      startsDaysAgo: 75,
      endsDaysAgo: 40,
      completedAt: [59, 13, 6], // aprobación del recibo con −20%
    },
    {
      id: "reto-agua-15-octubre",
      title: "Reduce 15% tu consumo de agua",
      metric: "WATER_reduction_pct",
      target: 15,
      reward: 200,
      startsDaysAgo: 70,
      endsDaysAgo: 35,
      completedAt: [54, 13, 6], // aprobación del recibo con −22%
    },
  ],
  redemptions: [
    { rewardId: "rew-arbol", cost: 300, donation: true, code: "ECO-EMH2-ARBA", when: [140, 19, 0] },
    { rewardId: "rew-bolsa-tela", cost: 500, donation: false, code: "ECO-EMH3-BLSA", when: [110, 18, 30], usedAt: [106, 11, 45] },
    { rewardId: "rew-arbol", cost: 300, donation: true, code: "ECO-EMH4-ARBB", when: [90, 19, 0] },
    { rewardId: "rew-cupon-10", cost: 100, donation: false, code: "ECO-EMH5-CPNA", when: [70, 18, 10], usedAt: [66, 12, 20] },
    { rewardId: "rew-arbol", cost: 300, donation: true, code: "ECO-EMH6-ARBC", when: [45, 19, 0] },
    { rewardId: "rew-arbol", cost: 300, donation: true, code: "ECO-EMH7-ARBD", when: [15, 19, 0] },
  ],
};

export const DEMO_PROFILES = [ENRIQUE, EMILIO];

// ------------------------------------------------------------------- motor

export async function seedDemoHistories(
  db: PrismaClient,
  opts: { passwordHash: string; products: ProductRow[]; feSen: number; now: Date },
) {
  for (const profile of DEMO_PROFILES) await seedProfile(db, profile, opts);
}

async function seedProfile(
  db: PrismaClient,
  p: DemoProfile,
  opts: { passwordHash: string; products: ProductRow[]; feSen: number; now: Date },
) {
  const { now } = opts;
  const at = (daysAgo: number, hour = 12, minute = 0) => {
    const d = new Date(now.getTime() - daysAgo * DAY);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const atW = ([d, h, m]: When) => at(d, h, m);

  const operator = await db.user.findUniqueOrThrow({ where: { email: "operador@ecopuntos.test" } });
  const bin = await db.recycleBin.findUniqueOrThrow({ where: { code: "CAMPUS-01" } });
  const createdAt = at(p.createdDaysAgo, 9, 30);
  const user = await db.user.upsert({
    where: { email: p.email },
    update: { passwordHash: opts.passwordHash },
    create: {
      email: p.email,
      name: p.name,
      role: Role.CUSTOMER,
      passwordHash: opts.passwordHash,
      createdAt,
      privacyAcceptedAt: createdAt,
    },
  });

  if ((await db.pointEntry.count({ where: { userId: user.id } })) > 0) {
    console.log(`${p.name} ya tiene historial; no se toca.`);
    return;
  }

  type Entry = { type: EntryType; points: number; sourceId: string; impact?: object; createdAt: Date };
  const entries: Entry[] = [];
  let earned = 0;
  const credit = (e: Entry) => {
    entries.push(e);
    if (e.points > 0) earned += e.points;
  };

  // Todo se ejecuta en orden cronológico para que el nivel (y su bono) sea el de cada momento.
  const events: { when: Date; run: () => Promise<void> }[] = [];
  const productById = new Map(opts.products.map((pr) => [pr.id, pr]));

  // Compras + envases
  p.sales.forEach(([daysAgo, hour, lines, broughtContainer], i) => {
    const when = at(daysAgo, hour, 15);
    const claimedAt = new Date(when.getTime() + 3 * 60 * 1000);
    events.push({
      when: claimedAt,
      run: async () => {
        const items = lines.map(([productId, qty]) => {
          const pr = productById.get(productId)!;
          return { productId, qty, priceCents: pr.priceCents, ecoScore: ecoScore(pr) };
        });
        const base = items.reduce(
          (s, it) => s + (it.ecoScore ? Math.floor((it.qty * it.priceCents) / 1000) * RATE[it.ecoScore] : 0),
          0,
        );
        const points = base + Math.floor((base * levelFor(earned).purchaseBonusPct) / 100);
        const saleId = `sale-${p.key}-${String(i + 1).padStart(2, "0")}`;
        await db.sale.create({
          data: {
            id: saleId,
            operatorId: operator.id,
            items,
            totalCents: items.reduce((s, it) => s + it.qty * it.priceCents, 0),
            points: base, // Sale.points guarda los puntos base; el bono va en el PointEntry
            broughtContainer,
            qrNonce: `seed-${saleId}`,
            expiresAt: new Date(when.getTime() + 15 * 60 * 1000),
            claimedById: user.id,
            claimedAt,
            createdAt: when,
          },
        });
        credit({ type: EntryType.PURCHASE, points, sourceId: saleId, createdAt: claimedAt });
        if (broughtContainer) {
          credit({
            type: EntryType.BRING_CONTAINER,
            points: 10,
            sourceId: saleId,
            impact: { containers: 1 },
            createdAt: claimedAt,
          });
        }
      },
    });
  });

  // Reciclaje: se entrega por la tarde y el operador lo aprueba al día siguiente.
  p.recycles.forEach(([daysAgo, pieces], i) => {
    const when = at(daysAgo, 16, 40);
    const reviewedAt = new Date(when.getTime() + 20 * 60 * 60 * 1000);
    events.push({
      when: reviewedAt,
      run: async () => {
        const claimId = `recycle-${p.key}-${i + 1}`;
        await db.recycleClaim.create({
          data: {
            id: claimId,
            userId: user.id,
            binId: bin.id,
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

  // Recibos: el primero de cada servicio es la línea base; los demás pagan por reducción.
  for (const service of p.bills) {
    await db.serviceAccount.create({
      data: { kind: service.kind as BillKind, number: service.serviceNumber, userId: user.id },
    });
    const readings = service.readings.map(([start, end, consumption, submitted]) => ({
      periodStart: at(start, 0),
      periodEnd: at(end, 0),
      consumption,
      submittedAt: at(submitted, 19, 5),
    }));
    readings.forEach((b, i) => {
      const reviewedAt = new Date(b.submittedAt.getTime() + 18 * 60 * 60 * 1000);
      events.push({
        when: reviewedAt,
        run: async () => {
          const billId = `bill-${p.key}-${service.kind === "ELECTRICITY" ? "luz" : "agua"}-${i + 1}`;
          const result = billReduction(i > 0 ? readings[i - 1] : null, b, { pointsPer5Pct: 50, maxPerBill: 200 });
          await db.bill.create({
            data: {
              id: billId,
              userId: user.id,
              kind: service.kind as BillKind,
              serviceNumber: service.serviceNumber,
              periodStart: b.periodStart,
              periodEnd: b.periodEnd,
              consumption: b.consumption,
              ocrServiceNumber: service.serviceNumber,
              ocrPeriodStart: b.periodStart,
              ocrPeriodEnd: b.periodEnd,
              ocrConsumption: b.consumption,
              ocrConfidence: 0.91,
              fileHash: createHash("sha256").update(`seed:${billId}`).digest("hex"),
              reductionPct: result.baseline ? null : result.reductionPct,
              status: "APPROVED",
              reviewedById: operator.id,
              submittedAt: b.submittedAt,
              reviewedAt,
              createdAt: new Date(b.submittedAt.getTime() - 5 * 60 * 1000),
            },
          });
          credit({
            type: EntryType.BILL_REDUCTION,
            points: result.points,
            sourceId: billId,
            impact: billImpact(service.kind, result.saved, opts.feSen),
            createdAt: reviewedAt,
          });
        },
      });
    });
  }

  // Retos terminados (se crean si no existen) y su pago.
  for (const c of p.challenges) {
    await db.challenge.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        title: c.title,
        metric: c.metric,
        target: c.target,
        reward: c.reward,
        startsAt: at(c.startsDaysAgo, 0),
        endsAt: at(c.endsDaysAgo, 23, 59),
      },
    });
    const completedAt = atW(c.completedAt);
    events.push({
      when: completedAt,
      run: async () =>
        credit({ type: EntryType.CHALLENGE, points: c.reward, sourceId: `${c.id}:${user.id}`, createdAt: completedAt }),
    });
  }

  // Canjes y donaciones.
  p.redemptions.forEach((r, i) => {
    const when = atW(r.when);
    events.push({
      when,
      run: async () => {
        const balance = entries.reduce((s, e) => s + e.points, 0);
        if (balance < r.cost) throw new Error(`${p.name}: saldo insuficiente para el canje ${r.code}`);
        const id = `redeem-${p.key}-${i + 1}`;
        await db.reward.update({ where: { id: r.rewardId }, data: { stock: { decrement: 1 } } });
        await db.redemption.create({
          data: {
            id,
            userId: user.id,
            rewardId: r.rewardId,
            code: r.code,
            usedAt: r.donation ? when : r.usedAt ? atW(r.usedAt) : null,
            usedById: !r.donation && r.usedAt ? operator.id : null,
            createdAt: when,
          },
        });
        credit({ type: r.donation ? EntryType.DONATION : EntryType.REDEEM, points: -r.cost, sourceId: id, createdAt: when });
      },
    });
  });

  events.sort((a, b) => a.when.getTime() - b.when.getTime());
  for (const e of events) await e.run();

  await db.pointEntry.createMany({
    data: entries.map((e) => ({ ...e, userId: user.id, impact: e.impact ?? undefined })),
  });

  const balance = entries.reduce((s, e) => s + e.points, 0);
  console.log(
    `${p.name}: ${entries.length} movimientos, ${earned} puntos ganados, saldo ${balance}, nivel ${levelFor(earned).name}.`,
  );
}
