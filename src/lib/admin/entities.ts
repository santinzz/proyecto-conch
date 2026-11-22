// Administración (Fase 6): catálogo, reglas, retos, recompensas y contenedores.
// Cada tipo tiene su esquema Zod; el servidor valida todo aunque la interfaz ya lo haga.
import { z } from "zod";
import { CHALLENGE_METRICS } from "@/lib/points/challenge-metrics";
import type { Tx } from "@/lib/points/ledger";

export const ADMIN_ENTITIES = ["products", "rules", "challenges", "rewards", "bins"] as const;
export type AdminEntity = (typeof ADMIN_ENTITIES)[number];

export function isAdminEntity(value: string): value is AdminEntity {
  return (ADMIN_ENTITIES as readonly string[]).includes(value);
}

const name = z.string().trim().min(2, "Escribe un nombre").max(80);
const metricKeys = Object.keys(CHALLENGE_METRICS) as [keyof typeof CHALLENGE_METRICS, ...(keyof typeof CHALLENGE_METRICS)[]];

export const ADMIN_SCHEMAS = {
  products: z.object({
    name,
    priceCents: z.int().min(0).max(1_000_000),
    bulk: z.boolean(),
    local: z.boolean(),
    plasticFree: z.boolean(),
    certified: z.boolean(),
    active: z.boolean(),
  }),
  rules: z.object({
    points: z.int().min(0).max(10_000),
    limitCount: z.int().min(1).max(100_000).nullable(),
    limitPeriod: z.enum(["day", "week", "bill"]).nullable(),
  }),
  challenges: z
    .object({
      title: name,
      metric: z.enum(metricKeys),
      target: z.number().positive("La meta debe ser mayor que 0").max(100_000),
      reward: z.int().min(0).max(10_000),
      startsAt: z.iso.datetime().transform((s) => new Date(s)),
      endsAt: z.iso.datetime().transform((s) => new Date(s)),
    })
    .refine((c) => c.endsAt > c.startsAt, { message: "La fecha final debe ser después de la inicial", path: ["endsAt"] }),
  rewards: z.object({
    name,
    cost: z.int().min(1).max(100_000),
    stock: z.int().min(0).max(100_000),
    isDonation: z.boolean(),
  }),
  bins: z.object({
    name,
    location: z.string().trim().min(2, "Escribe dónde está").max(120),
    code: z
      .string()
      .transform((s) => s.trim().toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9-]{3,20}$/, "Código de 3 a 20 letras, números o guiones")),
  }),
} as const;

export type AdminErrorCode = "INVALID" | "NOT_FOUND" | "DUPLICATE" | "NOT_ALLOWED";

export class AdminError extends Error {
  constructor(
    public readonly code: AdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdminError";
  }
}

export const ADMIN_ERROR_STATUS: Record<AdminErrorCode, number> = {
  INVALID: 400,
  NOT_FOUND: 404,
  DUPLICATE: 409,
  NOT_ALLOWED: 405,
};

function parse<E extends AdminEntity>(entity: E, data: unknown): z.infer<(typeof ADMIN_SCHEMAS)[E]> {
  const parsed = ADMIN_SCHEMAS[entity].safeParse(data);
  if (!parsed.success) throw new AdminError("INVALID", parsed.error.issues[0]?.message ?? "Datos no válidos");
  return parsed.data as z.infer<(typeof ADMIN_SCHEMAS)[E]>;
}

function translate(e: unknown): never {
  const code = (e as { code?: string }).code;
  if (code === "P2002") throw new AdminError("DUPLICATE", "Ya existe un registro con ese código");
  if (code === "P2025") throw new AdminError("NOT_FOUND", "No se encontró el registro");
  throw e;
}

export async function listEntity(client: Tx, entity: AdminEntity) {
  switch (entity) {
    case "products":
      return client.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
    case "rules":
      return client.rule.findMany({ orderBy: { key: "asc" } });
    case "challenges":
      return client.challenge.findMany({ orderBy: { startsAt: "desc" } });
    case "rewards":
      return client.reward.findMany({ orderBy: [{ isDonation: "asc" }, { cost: "asc" }] });
    case "bins":
      return client.recycleBin.findMany({ orderBy: { code: "asc" } });
  }
}

/** Crea un registro. Las reglas no se crean: sus claves las usa el motor de puntos. */
export async function createEntity(client: Tx, entity: AdminEntity, data: unknown) {
  try {
    switch (entity) {
      case "products":
        return await client.product.create({ data: parse("products", data) });
      case "rules":
        throw new AdminError("NOT_ALLOWED", "Las reglas no se crean ni se borran; solo se editan");
      case "challenges":
        return await client.challenge.create({ data: parse("challenges", data) });
      case "rewards":
        return await client.reward.create({ data: parse("rewards", data) });
      case "bins":
        return await client.recycleBin.create({ data: parse("bins", data) });
    }
  } catch (e) {
    if (e instanceof AdminError) throw e;
    translate(e);
  }
}

export async function updateEntity(client: Tx, entity: AdminEntity, id: string, data: unknown) {
  try {
    switch (entity) {
      case "products":
        return await client.product.update({ where: { id }, data: parse("products", data) });
      case "rules":
        return await client.rule.update({ where: { key: id }, data: parse("rules", data) });
      case "challenges":
        return await client.challenge.update({ where: { id }, data: parse("challenges", data) });
      case "rewards":
        return await client.reward.update({ where: { id }, data: parse("rewards", data) });
      case "bins":
        return await client.recycleBin.update({ where: { id }, data: parse("bins", data) });
    }
  } catch (e) {
    if (e instanceof AdminError) throw e;
    translate(e);
  }
}
