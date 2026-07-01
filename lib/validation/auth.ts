import z from "zod";

export const loginSchema = z.object({
  email: z.string().email("Your email address should not be blank"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type LoginForm = z.infer<typeof loginSchema>;

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%*])(?=.{8,})/;

export const registerSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.email("Please enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        passwordRegex,
        "Password must contain 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number and 1 special character.",
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterForm = z.infer<typeof registerSchema>;
