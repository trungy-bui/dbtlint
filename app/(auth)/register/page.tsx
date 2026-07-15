import { RegisterForm } from "@/components/auth/register-form";
import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-6 py-6">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
