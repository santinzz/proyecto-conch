import { describe, expect, test } from "vitest";
import { extractTicketToken, getQrSecret, newNonce, signTicket, ticketUrl, verifyTicket } from "./qr";

const SECRET = "s".repeat(40);
const NOW = new Date("2026-11-20T18:00:00Z");
const EXPIRES = new Date("2026-11-20T18:15:00Z");
const ticket = { saleId: "cmsale123", nonce: "abcDEF_-123", expiresAt: EXPIRES };

describe("signTicket / verifyTicket", () => {
  test("un token válido se verifica y devuelve sus datos", () => {
    const token = signTicket(ticket, SECRET);
    expect(token.split(".")).toHaveLength(4);
    expect(verifyTicket(token, SECRET, NOW)).toEqual({ ok: true, saleId: "cmsale123", nonce: "abcDEF_-123", expiresAt: EXPIRES });
  });

  test("vencido: justo al llegar a expiresAt y después", () => {
    const token = signTicket(ticket, SECRET);
    expect(verifyTicket(token, SECRET, EXPIRES)).toEqual({ ok: false, reason: "EXPIRED" });
    expect(verifyTicket(token, SECRET, new Date("2026-11-21T00:00:00Z"))).toEqual({ ok: false, reason: "EXPIRED" });
  });

  test("cambiar el saleId, el nonce o la fecha invalida la firma", () => {
    const [saleId, nonce, exp, sig] = signTicket(ticket, SECRET).split(".");
    expect(verifyTicket(`otraventa.${nonce}.${exp}.${sig}`, SECRET, NOW).ok).toBe(false);
    expect(verifyTicket(`${saleId}.otro.${exp}.${sig}`, SECRET, NOW).ok).toBe(false);
    expect(verifyTicket(`${saleId}.${nonce}.${Number(exp) + 3600}.${sig}`, SECRET, NOW).ok).toBe(false);
  });

  test("firma alterada o de otro secreto: inválido", () => {
    const token = signTicket(ticket, SECRET);
    const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    expect(verifyTicket(tampered, SECRET, NOW)).toEqual({ ok: false, reason: "INVALID" });
    expect(verifyTicket(signTicket(ticket, "x".repeat(40)), SECRET, NOW)).toEqual({ ok: false, reason: "INVALID" });
  });

  test("un token vencido con firma falsa se reporta como inválido, no como vencido", () => {
    const [saleId, nonce, exp] = signTicket(ticket, SECRET).split(".");
    expect(verifyTicket(`${saleId}.${nonce}.${exp}.firmafalsa`, SECRET, EXPIRES).reason).toBe("INVALID");
  });

  test("formatos raros: inválido", () => {
    for (const bad of ["", "a.b.c", "a.b.c.d.e", "a.b.no-numero.d", "a b.c.1.d", "....", "a.b.1.d\n"]) {
      expect(verifyTicket(bad, SECRET, NOW).ok).toBe(false);
    }
  });

  test("no firma ids con caracteres raros", () => {
    expect(() => signTicket({ ...ticket, saleId: "a.b" }, SECRET)).toThrow();
  });

  test("cada nonce es distinto y seguro para URL", () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newNonce()).not.toBe(a);
  });
});

describe("URL del QR", () => {
  test("ticketUrl y extractTicketToken van de ida y vuelta", () => {
    const token = signTicket(ticket, SECRET);
    const url = ticketUrl("https://ecopuntos.example", token);
    expect(url.startsWith("https://ecopuntos.example/escanear?t=")).toBe(true);
    expect(extractTicketToken(url)).toBe(token);
  });

  test("acepta el token solo y rechaza texto que no es ticket", () => {
    const token = signTicket(ticket, SECRET);
    expect(extractTicketToken(`  ${token} `)).toBe(token);
    expect(extractTicketToken("bin:CAMPUS-01")).toBeNull();
    expect(extractTicketToken("https://otra.cosa/")).toBeNull();
  });
});

test("QR_SECRET es obligatorio y largo", () => {
  expect(getQrSecret({ QR_SECRET: SECRET })).toBe(SECRET);
  expect(() => getQrSecret({})).toThrow();
  expect(() => getQrSecret({ QR_SECRET: "corto" })).toThrow();
});
