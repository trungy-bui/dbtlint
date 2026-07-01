import { RegisterForm } from "@/components/auth/register-form";
import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}