import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Correo no válido").trim().toLowerCase(),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.email("Correo no válido").trim().toLowerCase(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
  // Casilla del formulario ("on") o true desde la API.
  acceptPrivacy: z.union([z.literal(true), z.literal("on")], {
    error: "Acepta el aviso de privacidad para crear tu cuenta",
  }),
});
