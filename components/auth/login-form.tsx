"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Loader2, Terminal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { createClient } from "@/lib/supabase/client";
import {
  type LoginForm as LoginType,
  loginSchema,
} from "@/lib/validation/auth";
import { GitHubIcon, GoogleIcon } from "../shared/brand-icons";

export function LoginForm() {
  const supabase = createClient();
  const form = useForm<LoginType>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const hasSubmitted = form.formState.isSubmitting;
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");

  const onSubmit = async (data: LoginType) => {
    const { error } = await supabase.auth.signInWithPassword(data);

    if (error) {
      form.setError("root", { message: error.message });
      toast.error(error.message);
      return;
    }

    toast.success("Signed in!");
    if (plan === "team") {
      router.push("/api/lemonsqueezy/checkout");
    } else {
      router.push("/dashboard");
    }
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
      return;
    }
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } },
      }}
      initial="hidden"
      animate="show"
      className="relative isolate w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-6 text-slate-100 shadow-[0_28px_80px_rgba(2,6,23,0.55)] before:fixed before:inset-0 before:-z-10 before:bg-slate-950 sm:p-8"
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 20 },
          show: { opacity: 1, y: 0 },
        }}
        className="flex flex-col items-center border-b border-slate-800 pb-6"
      >
        <div className="flex size-12 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Terminal className="size-5 text-emerald-400" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-50">
          Welcome back
        </h1>
        <p className="mt-1 text-center text-sm leading-6 text-slate-400">
          Lint your dbt projects. Ship with confidence.
        </p>
      </motion.div>

      <motion.div
        variants={{
          hidden: { opacity: 0, y: 20 },
          show: { opacity: 1, y: 0 },
        }}
        className="mt-6"
      >
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
          >
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
                      placeholder="name@company.com"
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
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium text-slate-300">
                      Password
                    </FormLabel>
                    <a
                      href="/forgot-password"
                      className="cursor-pointer text-xs text-slate-400 transition-colors duration-200 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
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
                    <Loader2 className="size-4 animate-spin" /> Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </motion.div>
          </form>
        </Form>
      </motion.div>

      <motion.div
        variants={{
          hidden: { opacity: 0, y: 20 },
          show: { opacity: 1, y: 0 },
        }}
        className="my-6 flex items-center gap-3"
      >
        <span className="h-px flex-1 bg-slate-800" />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          or continue with
        </span>
        <span className="h-px flex-1 bg-slate-800" />
      </motion.div>

      <motion.div
        variants={{
          hidden: { opacity: 0, y: 20 },
          show: { opacity: 1, y: 0 },
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={hasSubmitted}
          onClick={() => handleOAuth("github")}
          className="h-11 w-full cursor-pointer border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          Sign in with GitHub
          <GitHubIcon />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={hasSubmitted}
          onClick={() => handleOAuth("google")}
          className="h-11 w-full cursor-pointer border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          Sign in with Google
          <GoogleIcon />
        </Button>
      </motion.div>

      <motion.p
        variants={{
          hidden: { opacity: 0, y: 20 },
          show: { opacity: 1, y: 0 },
        }}
        className="mt-7 text-center text-sm text-slate-400"
      >
        Don&apos;t have an account?{" "}
        <a
          href="/register"
          className="cursor-pointer font-medium text-emerald-400 transition-colors duration-200 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Sign up
        </a>
      </motion.p>
    </motion.div>
  );
}
