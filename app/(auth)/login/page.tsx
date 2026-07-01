import { LoginForm } from "@/components/auth/login-form";
import { Suspense } from "react";

export default function LoginPage() {
    return (
        <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
            <Suspense>
                <LoginForm />
            </Suspense>
        </div>
    );
}
