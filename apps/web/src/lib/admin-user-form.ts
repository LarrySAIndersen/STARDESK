import { z } from "zod";

export const adminUserRoleValues = [
  "end_user",
  "agent",
  "admin",
  "top_admin",
  "supporter",
  "stardesk_reviewer",
  "kundeportal_2",
] as const;

export const adminUserPasswordSchema = z
  .object({
    new_password: z.string().min(8, "Mindst 8 tegn"),
    confirm_password: z.string().min(8, "Mindst 8 tegn"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Adgangskoderne matcher ikke",
    path: ["confirm_password"],
  });
