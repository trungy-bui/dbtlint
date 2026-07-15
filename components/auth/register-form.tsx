"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Loader2, Terminal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { OAuthProvider } from "@/lib/auth";
import { getPasswordStrength, strengthMetadata } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";
import {
  type RegisterForm as RegisterType,
  registerSchema,
} from "@/lib/validation/auth";
import { GitHubIcon, GoogleIcon } from "../shared/brand-icons";

export function RegisterForm() {
  const supabase = createClient();
  const form = useForm<RegisterType>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });
  const hasSubmitted = form.formState.isSubmitting;
  const router = useRouter();

  const password = form.watch("password");
  const passwordStrength = useMemo(
    () => getPasswordStrength(password ?? ""),
    [password],
  );
  const meta = strengthMetadata[passwordStrength];
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");

  const onSubmit = async (data: RegisterType) => {
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
      },
    });

    console.log("signUpData:", signUpData); // add this
    console.log("session:", signUpData?.session);

    if (error) {
      form.setError("root", { message: error.message });
      toast.error(error.message);
      return;
    }

    if (signUpData.session) {
      router.push(
        plan === "team" ? "/api/lemonsqueezy/checkout" : "/dashboard",
      );
      return;
    }

    router.push(plan ? `/login?plan=${plan}` : "/login");
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    const redirectUrl = new URL("/callback", window.location.origin);

    if (plan) {
      redirectUrl.searchParams.set("plan", plan);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl.toString(),
      },
    });

    if (error) {
      toast.error(error.message);
    }
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: 0.08, delayChildren: 0.1 },
        },
      }}
      initial="hidden"
      animate="show"
      className="relative isolate w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-5 text-slate-100 shadow-[0_28px_80px_rgba(2,6,23,0.55)] before:fixed before:inset-0 before:-z-10 before:bg-slate-950 sm:p-6"
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 24 },
          show: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: "easeOut" },
          },
        }}
        className="flex flex-col items-center border-b border-slate-800 pb-4"
      >
        <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Terminal className="size-4 text-emerald-400" />
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-50">
          Create your account
        </h1>
        <p className="mt-1 text-pretty text-center text-sm leading-6 text-slate-400">
          Start linting your dbt projects in minutes.
        </p>
      </motion.div>

      <motion.div
        variants={{
          hidden: { opacity: 0, y: 24 },
          show: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: "easeOut" },
          },
        }}
        className="mt-5"
      >
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-slate-300">
                    Full name
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ada Lovelace"
                      autoComplete="name"
                      disabled={hasSubmitted}
                      className="h-11 border-slate-700 bg-slate-950/80 px-3 text-slate-100 placeholder:text-slate-600 focus-visible:border-emerald-400/60 focus-visible:ring-3 focus-visible:ring-emerald-400/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-slate-300">
                    Email
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
                      disabled={hasSubmitted}
                      className="h-11 border-slate-700 bg-slate-950/80 px-3 text-slate-100 placeholder:text-slate-600 focus-visible:border-emerald-400/60 focus-visible:ring-3 focus-visible:ring-emerald-400/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-slate-300">
                    Password
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={hasSubmitted}
                      className="h-11 border-slate-700 bg-slate-950/80 px-3 text-slate-100 placeholder:text-slate-600 focus-visible:border-emerald-400/60 focus-visible:ring-3 focus-visible:ring-emerald-400/20"
                      {...field}
                    />
                  </FormControl>
                  {password ? (
                    <div className="mt-1 flex flex-col gap-1.5">
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${i < passwordStrength ? meta.color : "bg-slate-800"}`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs ${meta.text}`}>
                        Password strength: {meta.label}
                      </p>
                    </div>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-slate-300">
                    Confirm password
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={hasSubmitted}
                      className="h-11 border-slate-700 bg-slate-950/80 px-3 text-slate-100 placeholder:text-slate-600 focus-visible:border-emerald-400/60 focus-visible:ring-3 focus-visible:ring-emerald-400/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <p
                role="alert"
                className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-300"
              >
                {form.formState.errors.root.message}
              </p>
            )}

            <motion.div
              whileHover={{ scale: hasSubmitted ? 1 : 1.02 }}
              whileTap={{ scale: hasSubmitted ? 1 : 0.98 }}
            >
              <Button
                type="submit"
                size="lg"
                disabled={hasSubmitted}
                className="h-11 w-full cursor-pointer bg-emerald-400 font-semibold text-slate-950 shadow-[0_10px_28px_rgba(16,185,129,0.16)] hover:bg-emerald-300"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Creating
                    account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </motion.div>
          </form>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 24 },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.5, ease: "easeOut" },
              },
            }}
            className="mt-6 grid gap-3 sm:grid-cols-2"
          >
            <motion.div
              whileHover={{ scale: hasSubmitted ? 1 : 1.02 }}
              whileTap={{ scale: hasSubmitted ? 1 : 0.98 }}
            >
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={hasSubmitted}
                onClick={() => handleOAuth("github")}
                className="h-11 w-full cursor-pointer border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                <GitHubIcon className="size-4" />
                Sign up with GitHub
              </Button>
            </motion.div>

            <motion.div
              whileHover={{ scale: hasSubmitted ? 1 : 1.02 }}
              whileTap={{ scale: hasSubmitted ? 1 : 0.98 }}
            >
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={hasSubmitted}
                onClick={() => handleOAuth("google")}
                className="h-11 w-full cursor-pointer border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                <GoogleIcon className="size-4" />
                Sign up with Google
              </Button>
            </motion.div>
          </motion.div>
        </Form>
      </motion.div>

      <motion.p
        variants={{
          hidden: { opacity: 0, y: 20 },
          show: { opacity: 1, y: 0 },
        }}
        className="mt-7 text-center text-sm text-slate-400"
      >
        Already have an account?{" "}
        <a
          href={plan ? `/login?plan=${plan}` : "/login"}
          className="cursor-pointer font-medium text-emerald-400 transition-colors duration-200 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Log in
        </a>
      </motion.p>
    </motion.div>
  );
}
