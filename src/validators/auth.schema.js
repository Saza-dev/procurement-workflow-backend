import { z } from "zod";

// shared fields
const userBase = {
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(255),
};

export const loginUserSchema = z.object({
  body: z.object({
    ...userBase,
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    ...userBase,
    role: z.enum(["ADMIN", "DH", "PE", "FM", "OM", "CEO", "HR"], {
      errorMap: () => ({ message: "Invalid role selected" }),
    }),
  }),
});
