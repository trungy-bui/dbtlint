"use client";

import { AlertCircle, Check, ExternalLink, Mail, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FREE_PLAN_SCAN_LIMIT } from "@/lib/plan-limits";
import { createClient } from "@/lib/supabase/client";

type PlanType = "free" | "team";
type SubscriptionStatus =
  | "active"
  | "paused"
  | "cancelled"
  | "payment_failed"
  | "refunded"
  | string;

interface PlanData {
  type: PlanType;
  name: string;
  price: number;
  scansUsed?: number;
  scansLimit?: number;
  subscriptionStatus?: SubscriptionStatus | null;
  nextBillingDate?: string | null;
}

type BillingPlanStatus = {
  plan: PlanData;
  email: string | null;
};

type UserPlanResponse = {
  plan: PlanType | null;
  email: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  nextBillingDate: string | null;
  scansUsed: number | null;
  scansLimit: number | null;
};

type PortalResponse = {
  url?: string;
  error?: string;
};

const fallbackBillingStatus: BillingPlanStatus = {
  plan: {
    type: "free",
    name: "Free",
    price: 0,
    scansUsed: 0,
    scansLimit: FREE_PLAN_SCAN_LIMIT,
    subscriptionStatus: null,
    nextBillingDate: null,
  },
  email: null,
};

const statusStyles: Record<string, string> = {
  active: "bg-signal-pass/10 text-signal-pass border-signal-pass/40",
  paused: "bg-signal-warn/10 text-signal-warn border-signal-warn/40",
  payment_failed: "bg-signal-fail/10 text-signal-fail border-signal-fail/40",
  cancelled: "bg-muted text-muted-foreground border-border",
  refunded: "bg-muted text-muted-foreground border-border",
};

const statusLabel = (s: SubscriptionStatus) =>
  s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");

const freeHighlights = [
  { label: "1 dbt project", included: true },
  { label: "5 scans/mo", included: true },
  { label: "CI/CD", included: false },
  { label: "Team collaboration", included: false },
];

function formatBillingDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeBillingStatus(data: UserPlanResponse): BillingPlanStatus {
  const isTeam = data.plan === "team";

  return {
    plan: {
      type: isTeam ? "team" : "free",
      name: isTeam ? "Team" : "Free",
      price: isTeam ? 29 : 0,
      scansUsed: isTeam ? undefined : (data.scansUsed ?? 0),
      scansLimit: isTeam
        ? undefined
        : (data.scansLimit ?? FREE_PLAN_SCAN_LIMIT),
      subscriptionStatus: data.subscriptionStatus,
      nextBillingDate: data.nextBillingDate,
    },
    email: data.email,
  };
}

async function fetchBillingStatus(): Promise<BillingPlanStatus> {
  try {
    const response = await fetch("/api/user/plan", { cache: "no-store" });

    if (!response.ok) {
      return fallbackBillingStatus;
    }

    const data = (await response.json()) as UserPlanResponse;
    return normalizeBillingStatus(data);
  } catch (error) {
    console.error("fetchBillingStatus: network request failed", error);
    return fallbackBillingStatus;
  }
}

function BillingPageSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
      <div className="space-y-6">
        <Card className="border-hairline bg-panel p-6 space-y-6 opacity-70">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="h-6 w-32 rounded bg-muted" />
              <div className="h-4 w-48 rounded bg-muted" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-16 rounded bg-muted" />
              <div className="h-9 w-36 rounded-md bg-muted" />
            </div>
          </div>
          <div className="h-px bg-hairline" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-1.5 w-full rounded-full bg-muted" />
            <div className="h-3 w-40 rounded bg-muted" />
          </div>
        </Card>
      </div>

      <Card className="border-hairline bg-panel p-5 space-y-4 opacity-70">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
        <div className="h-px bg-hairline" />
        <div className="h-9 w-32 rounded bg-muted" />
      </Card>
    </div>
  );
}

function PlanOverviewCard({
  plan,
  onUpgrade,
  onManagePortal,
  isPortalLoading,
}: {
  plan: PlanData;
  onUpgrade: () => void;
  onManagePortal: () => void;
  isPortalLoading: boolean;
}) {
  const isFree = plan.type === "free";
  const usagePercent =
    isFree && plan.scansLimit
      ? Math.min(((plan.scansUsed ?? 0) / plan.scansLimit) * 100, 100)
      : 0;
  const nextBillingDate = formatBillingDate(plan.nextBillingDate);
  const statusStyle =
    plan.subscriptionStatus &&
    (statusStyles[plan.subscriptionStatus] ?? statusStyles.cancelled);

  return (
    <Card className="border-hairline bg-panel p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-ink">{plan.name} plan</h2>
          {!isFree && plan.subscriptionStatus && statusStyle && (
            <Badge
              className={`${statusStyle} border rounded-full text-[11px] font-medium px-2 py-0.5`}
            >
              {statusLabel(plan.subscriptionStatus)}
            </Badge>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-4">
            <p className="text-2xl font-semibold text-ink">
              {plan.price === 0 ? "$0" : `$${plan.price}`}
              <span className="text-sm font-normal text-ink-muted">/mo</span>
            </p>
            {isFree ? (
              <Button
                onClick={onUpgrade}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Upgrade to Team
              </Button>
            ) : (
              <Button
                onClick={onManagePortal}
                disabled={isPortalLoading}
                variant="outline"
                className="border-primary/40 text-primary hover:bg-primary/10"
              >
                {isPortalLoading ? "Opening..." : "Manage subscription"}
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            )}
          </div>
          {isFree && (
            <p className="text-xs text-ink-muted">
              Unlock unlimited projects, CI/CD, and team rules
            </p>
          )}
        </div>
      </div>

      {!isFree && plan.subscriptionStatus === "payment_failed" && (
        <div className="p-3 bg-signal-fail/10 border border-signal-fail/40 rounded-lg flex gap-2.5 items-start">
          <AlertCircle className="w-4 h-4 text-signal-fail flex-shrink-0 mt-0.5" />
          <p className="text-sm text-ink">
            Your last payment failed - update your payment method to avoid
            service interruption.
          </p>
        </div>
      )}

      {!isFree && plan.subscriptionStatus === "cancelled" && (
        <div className="p-3 bg-signal-warn/10 border border-signal-warn/40 rounded-lg flex gap-2.5 items-start">
          <AlertCircle className="w-4 h-4 text-signal-warn flex-shrink-0 mt-0.5" />
          <p className="text-sm text-ink">
            Your subscription is cancelled
            {nextBillingDate ? ` and will end on ${nextBillingDate}` : ""}.
            You&apos;ll keep Team access until then.
          </p>
        </div>
      )}

      {isFree && (
        <div className="flex flex-wrap gap-2">
          {freeHighlights.map((f) => (
            <span
              key={f.label}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                f.included
                  ? "border-signal-pass/30 bg-signal-pass/10 text-signal-pass"
                  : "border-hairline bg-panel-raised text-ink-muted"
              }`}
            >
              {f.included ? (
                <Check className="w-3 h-3" />
              ) : (
                <X className="w-3 h-3" />
              )}
              {f.label}
            </span>
          ))}
        </div>
      )}

      <div className="h-px bg-hairline" />

      {isFree ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-ink-muted">Scans this month</p>
            <p className="text-sm text-ink font-medium">
              {plan.scansUsed} of {plan.scansLimit}
            </p>
          </div>
          <Progress value={usagePercent} className="h-1.5" />
          <p className="text-xs text-ink-muted">
            Resets on the 1st of next month
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-signal-pass/10">
            <Check className="w-4 h-4 text-signal-pass" />
          </div>
          <div>
            <p className="text-sm text-ink">Unlimited scans</p>
            {nextBillingDate && plan.subscriptionStatus !== "cancelled" && (
              <p className="text-xs text-ink-muted mt-0.5">
                Next billing date: {nextBillingDate}
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function PlanComparisonTable({ onUpgrade }: { onUpgrade: () => void }) {
  const features = [
    { name: "dbt projects", free: "1", team: "Unlimited" },
    { name: "Scans per month", free: "5", team: "Unlimited" },
    { name: "CI/CD integration", free: false, team: true },
    { name: "Shared rule sets", free: false, team: true },
    { name: "Priority support", free: false, team: true },
    { name: "Custom rules", free: false, team: true },
    { name: "Team collaboration", free: false, team: true },
  ];

  return (
    <Card className="border-hairline bg-panel p-6">
      <h3 className="text-base font-semibold text-ink mb-1">Compare plans</h3>
      <p className="text-sm text-ink-muted mb-5">See what you get with Team.</p>

      <div className="overflow-x-auto rounded-lg border border-hairline">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel-raised">
              <th className="text-left py-3 px-4 font-medium text-ink-muted text-xs uppercase tracking-wide">
                Feature
              </th>
              <th className="text-center py-3 px-4 font-medium text-ink-muted text-xs uppercase tracking-wide">
                Free
              </th>
              <th className="text-center py-3 px-4 font-semibold text-primary text-xs uppercase tracking-wide bg-primary/10">
                Team
              </th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.name} className="border-t border-hairline">
                <td className="py-3.5 px-4 text-ink">{f.name}</td>
                <td className="py-3.5 px-4 text-center">
                  {typeof f.free === "boolean" ? (
                    f.free ? (
                      <Check className="w-4 h-4 text-signal-pass mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-ink-muted/40 mx-auto" />
                    )
                  ) : (
                    <span className="text-ink-muted">{f.free}</span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-center bg-primary/5">
                  {typeof f.team === "boolean" ? (
                    f.team ? (
                      <Check className="w-4 h-4 text-signal-pass mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-ink-muted/40 mx-auto" />
                    )
                  ) : (
                    <span className="text-ink font-medium">{f.team}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex justify-center">
        <Button
          onClick={onUpgrade}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Upgrade to Team - $29/mo
        </Button>
      </div>
    </Card>
  );
}

function CancelSubscriptionSection({
  onCancel,
  isCancelling,
}: {
  onCancel: () => void;
  isCancelling: boolean;
}) {
  return (
    <Card className="border-hairline bg-panel p-6 flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-ink">Cancel subscription</h3>
        <p className="text-xs text-ink-muted mt-0.5">
          You&apos;ll keep Team access until the end of your billing period.
        </p>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="text-sm text-ink-muted hover:text-signal-fail transition-colors"
          >
            Cancel
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent className="border-hairline bg-panel">
          <AlertDialogTitle className="text-ink">
            Cancel subscription
          </AlertDialogTitle>
          <AlertDialogDescription className="text-ink-muted">
            Are you sure you want to cancel your Team subscription? You&apos;ll
            lose access to Team features at the end of your current billing
            period.
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end pt-2">
            <AlertDialogCancel className="border-hairline bg-panel-raised hover:bg-panel-raised/80 text-ink">
              Keep subscription
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-signal-fail text-white hover:bg-signal-fail/90"
              disabled={isCancelling}
              onClick={onCancel}
            >
              {isCancelling ? "Cancelling..." : "Cancel subscription"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function AccountSummaryCard({
  plan,
  email,
}: {
  plan: PlanData;
  email: string | null;
}) {
  return (
    <Card className="border-hairline bg-panel p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">Account</h3>

      <div className="space-y-3">
        <div className="flex items-start gap-2.5">
          <Mail className="w-4 h-4 text-ink-muted flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-ink-muted">Billing email</p>
            <p className="text-sm text-ink">{email ?? "Not available"}</p>
          </div>
        </div>

        {plan.type === "team" && (
          <p className="text-xs text-ink-muted">
            Payment method details are available in the Lemon Squeezy customer
            portal.
          </p>
        )}
      </div>

      <div className="h-px bg-hairline" />

      <div>
        <p className="text-xs text-ink-muted mb-1">Need help?</p>
        <a
          href="mailto:support@dbtlint.com"
          className="text-sm text-primary hover:underline"
        >
          Contact support
        </a>
      </div>
    </Card>
  );
}

export default function BillingPage() {
  const [billingStatus, setBillingStatus] = useState<BillingPlanStatus>(
    fallbackBillingStatus,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  async function refreshBillingStatus() {
    const nextBillingStatus = await fetchBillingStatus();
    setBillingStatus(nextBillingStatus);
    return nextBillingStatus;
  }

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;
    let billingRequestId = 0;

    async function updateBillingStatus(sessionExists: boolean) {
      const requestId = ++billingRequestId;

      if (!isMounted) {
        return;
      }

      if (!sessionExists) {
        setBillingStatus(fallbackBillingStatus);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const nextBillingStatus = await fetchBillingStatus();

      if (!isMounted || requestId !== billingRequestId) {
        return;
      }

      setBillingStatus(nextBillingStatus);
      setIsLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      void updateBillingStatus(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void updateBillingStatus(Boolean(session));
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const currentPlan = billingStatus.plan;

  const handleUpgrade = () => {
    window.location.href = "/api/lemonsqueezy/checkout";
  };

  const handleManagePortal = async () => {
    setIsPortalLoading(true);

    try {
      const response = await fetch("/api/lemonsqueezy/portal", {
        cache: "no-store",
      });
      const data = (await response.json()) as PortalResponse;

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Customer portal unavailable");
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to open Lemon Squeezy customer portal", error);
      toast.error("Could not open the billing portal. Please try again.");
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);

    try {
      const response = await fetch("/api/lemonsqueezy/cancel", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel subscription");
      }

      await refreshBillingStatus();
      toast.success(
        "Subscription cancelled. Team access stays active until the period ends.",
      );
    } catch (error) {
      console.error("Failed to cancel Lemon Squeezy subscription", error);
      toast.error("Could not cancel the subscription. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink mb-1">Billing & plan</h1>
        <p className="text-sm text-ink-muted">
          Manage your subscription and usage.
        </p>
      </div>

      {isLoading ? (
        <BillingPageSkeleton />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
          <div className="space-y-6">
            <PlanOverviewCard
              plan={currentPlan}
              onUpgrade={handleUpgrade}
              onManagePortal={handleManagePortal}
              isPortalLoading={isPortalLoading}
            />

            {currentPlan.type === "free" && (
              <PlanComparisonTable onUpgrade={handleUpgrade} />
            )}
            {currentPlan.type === "team" &&
              currentPlan.subscriptionStatus !== "cancelled" && (
                <CancelSubscriptionSection
                  onCancel={handleCancelSubscription}
                  isCancelling={isCancelling}
                />
              )}
          </div>

          <AccountSummaryCard plan={currentPlan} email={billingStatus.email} />
        </div>
      )}
    </div>
  );
}
