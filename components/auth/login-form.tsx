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
import { createClient } from "@/lib/supabase/client";
import {
  type LoginForm as LoginType,
  loginSchema,
} from "@/lib/validation/auth";
import { GitHubIcon, GoogleIcon } from "../shared/brand-icons";
import { getUser, type OAuthProvider } from "@/lib/auth";

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
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: plan
          ? `${window.location.origin}/callback?plan=${plan}`
          : `${window.location.origin}/callback`,
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
      className="w-full max-w-sm"
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 20 },
          show: { opacity: 1, y: 0 },
        }}
        className="flex flex-col items-center"
      >
        <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <Terminal className="size-6 text-emerald-400" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Lint your dbt projects. Ship with confidence.
        </p>
      </motion.div>

      <motion.div
        variants={{
          hidden: { opacity: 0, y: 20 },
          show: { opacity: 1, y: 0 },
        }}
        className="mt-8"
      >
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@company.com"
                      autoComplete="email"
                      disabled={hasSubmitted}
                      className="transition-shadow focus-visible:ring-4 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/60"
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
                    <FormLabel>Password</FormLabel>
                    <a
                      href="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-foreground"
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
                      className="transition-shadow focus-visible:ring-4 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/60"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">
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
                className="h-10 w-full bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
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
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or continue with</span>
        <span className="h-px flex-1 bg-border" />
      </motion.div>

      <motion.div
        variants={{
          hidden: { opacity: 0, y: 20 },
          show: { opacity: 1, y: 0 },
        }}
        className="flex flex-col gap-4"
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={hasSubmitted}
          onClick={() => handleOAuth("github")}
          className="h-10 w-full"
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
          className="h-10 w-full"
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
        className="mt-8 text-center text-sm text-muted-foreground"
      >
        Don&apos;t have an account?{" "}
        <a
          href="/register"
          className="font-medium text-emerald-400 hover:text-emerald-300"
        >
          Sign up
        </a>
      </motion.p>
    </motion.div>
  );
}
