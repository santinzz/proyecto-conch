import { expect, test } from "vitest";
import { registerSchema } from "./schemas";

const base = { name: "Ana", email: "ANA@Correo.test", password: "12345678" };

test("el registro exige aceptar el aviso de privacidad", () => {
  expect(registerSchema.safeParse(base).success).toBe(false);
  expect(registerSchema.safeParse({ ...base, acceptPrivacy: false }).success).toBe(false);
  expect(registerSchema.safeParse({ ...base, acceptPrivacy: "on" }).success).toBe(true); // casilla del formulario
  expect(registerSchema.parse({ ...base, acceptPrivacy: true }).email).toBe("ana@correo.test");
});
