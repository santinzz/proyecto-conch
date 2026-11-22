// Administración: validación en el servidor y errores claros.
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { createTestDb, resetDb } from "../../../test/db";
import { createEntity, isAdminEntity, listEntity, updateEntity } from "./entities";

const db = createTestDb();
afterAll(() => db.$disconnect());
beforeEach(() => resetDb(db));

const product = {
  name: "Jabón a granel",
  priceCents: 4500,
  bulk: true,
  local: true,
  plasticFree: true,
  certified: false,
  active: true,
};

test("solo se administran los tipos conocidos", () => {
  expect(isAdminEntity("products")).toBe(true);
  expect(isAdminEntity("users")).toBe(false);
});

describe("crear y editar", () => {
  test("productos", async () => {
    const created = await createEntity(db, "products", product);
    const updated = await updateEntity(db, "products", created!.id, { ...product, priceCents: 5000, active: false });
    expect(updated).toMatchObject({ priceCents: 5000, active: false });
  });

  test("retos con fechas ISO; la final debe ser después de la inicial", async () => {
    const challenge = {
      title: "Trae tu envase 3 veces",
      metric: "BRING_CONTAINER_count",
      target: 3,
      reward: 80,
      startsAt: "2026-11-23T06:00:00.000Z",
      endsAt: "2026-12-07T05:59:00.000Z",
    };
    const created = await createEntity(db, "challenges", challenge);
    expect(created).toMatchObject({ target: 3, startsAt: new Date(challenge.startsAt) });
    await expect(createEntity(db, "challenges", { ...challenge, endsAt: challenge.startsAt })).rejects.toMatchObject({
      code: "INVALID",
    });
    await expect(createEntity(db, "challenges", { ...challenge, metric: "INVENTADA" })).rejects.toMatchObject({
      code: "INVALID",
    });
  });

  test("las reglas solo se editan, por su clave", async () => {
    await expect(createEntity(db, "rules", { points: 1, limitCount: null, limitPeriod: null })).rejects.toMatchObject({
      code: "NOT_ALLOWED",
    });
    const updated = await updateEntity(db, "rules", "BRING_CONTAINER", { points: 15, limitCount: 2, limitPeriod: "day" });
    expect(updated).toMatchObject({ key: "BRING_CONTAINER", points: 15, limitCount: 2 });
  });

  test("contenedores: código en mayúsculas y sin repetirse", async () => {
    const bin = await createEntity(db, "bins", { name: "Contenedor B", location: "Cafetería", code: " campus-02 " });
    expect(bin).toMatchObject({ code: "CAMPUS-02" });
    await expect(
      createEntity(db, "bins", { name: "Otro", location: "Biblioteca", code: "CAMPUS-02" }),
    ).rejects.toMatchObject({ code: "DUPLICATE" });
  });

  test("datos inválidos o registro inexistente", async () => {
    await expect(createEntity(db, "rewards", { name: "X", cost: 0, stock: 1, isDonation: false })).rejects.toMatchObject({
      code: "INVALID",
    });
    await expect(updateEntity(db, "products", "no-existe", product)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("lista ordenada", async () => {
    await createEntity(db, "rewards", { name: "Donar árbol", cost: 300, stock: 100, isDonation: true });
    await createEntity(db, "rewards", { name: "Cupón", cost: 100, stock: 10, isDonation: false });
    const rewards = (await listEntity(db, "rewards")) as { name: string }[];
    expect(rewards.map((r) => r.name)).toEqual(["Cupón", "Donar árbol"]);
  });
});
