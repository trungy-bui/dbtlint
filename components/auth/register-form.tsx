"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Loader2, Terminal } from "lucide-react";
import { useRouter } from "next/navigation";
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

  const onSubmit = async (data: RegisterType) => {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
      },
    });

    if (error) {
      form.setError("root", { message: error.message });
      toast.error(error.message);
      return;
    }

    router.push("/login");
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/callback`,
        skipBrowserRedirect: false,
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
      className="w-full max-w-sm"
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
        className="flex flex-col items-center"
      >
        <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <Terminal className="size-6 text-emerald-400" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground text-pretty">
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
        className="mt-8"
      >
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ada Lovelace"
                      autoComplete="name"
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@company.com"
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={hasSubmitted}
                      className="transition-shadow focus-visible:ring-4 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/60"
                      {...field}
                    />
                  </FormControl>
                  {password ? (
                    <div className="mt-1 flex flex-col gap-1.5">
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${i < passwordStrength ? meta.color : "bg-border"}`}
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
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
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
            className="flex flex-col gap-3"
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
                className="h-10 w-full"
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
                className="h-10 w-full"
              >
                <GoogleIcon className="size-4" />
                Sign up with Google
              </Button>
            </motion.div>
          </motion.div>
        </Form>
      </motion.div>
    </motion.div>
  );
}
