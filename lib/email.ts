import type { ReactNode } from "react";
import { resend } from "@/lib/resend";

type SendEmailInput = {
  to: string | string[];
  subject: string;
  react: ReactNode;
};

export async function sendEmail({ to, subject, react }: SendEmailInput) {
  const from = process.env.RESEND_FROM_EMAIL;

  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }

  return resend.emails.send({
    from,
    to,
    subject,
    react,
  });
}
