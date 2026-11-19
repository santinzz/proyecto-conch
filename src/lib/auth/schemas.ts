import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Correo no válido").trim().toLowerCase(),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.email("Correo no válido").trim().toLowerCase(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
});
