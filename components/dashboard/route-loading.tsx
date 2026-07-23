function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded-md bg-slate-800/70 ${className}`} />;
}

const dashboardStatSkeletonIds = ["projects", "scans", "errors", "warnings"];
const projectSkeletonIds = [
  "project-1",
  "project-2",
  "project-3",
  "project-4",
  "project-5",
  "project-6",
];

export function DashboardStatsSkeleton() {
  return (
    <output
      className="block space-y-6 animate-pulse motion-reduce:animate-none"
      aria-label="Loading dashboard statistics"
    >
      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-72 max-w-full" />
        <SkeletonBlock className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardStatSkeletonIds.map((id) => (
          <SkeletonBlock key={id} className="h-32 rounded-xl" />
        ))}
      </div>
      <span className="sr-only">Loading dashboard statistics</span>
    </output>
  );
}

export function RecentScansSkeleton() {
  return (
    <output
      className="block h-80 animate-pulse rounded-xl bg-slate-800/70 motion-reduce:animate-none"
      aria-label="Loading recent scans"
    />
  );
}

export function UploadPanelSkeleton() {
  return (
    <output
      className="block h-80 animate-pulse rounded-xl bg-slate-800/70 motion-reduce:animate-none"
      aria-label="Loading upload panel"
    />
  );
}

export function ProjectsRouteSkeleton() {
  return (
    <output
      className="block space-y-5 animate-pulse motion-reduce:animate-none"
      aria-label="Loading projects"
    >
      <SkeletonBlock className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {projectSkeletonIds.map((id) => (
          <SkeletonBlock key={id} className="h-64 rounded-2xl" />
        ))}
      </div>
      <span className="sr-only">Loading projects</span>
    </output>
  );
}

export function UploadRouteSkeleton() {
  return (
    <output
      className="mx-auto block w-full max-w-5xl space-y-8 animate-pulse motion-reduce:animate-none"
      aria-label="Loading upload page"
    >
      <div className="space-y-3">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-8 w-64 max-w-full" />
        <SkeletonBlock className="h-4 w-[32rem] max-w-full" />
      </div>
      <SkeletonBlock className="h-80 w-full rounded-2xl" />
      <span className="sr-only">Loading upload page</span>
    </output>
  );
}

export function BillingRouteSkeleton() {
  return (
    <output
      className="block max-w-6xl space-y-6 animate-pulse motion-reduce:animate-none"
      aria-label="Loading billing"
    >
      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <SkeletonBlock className="h-72 rounded-xl" />
        <SkeletonBlock className="h-56 rounded-xl" />
      </div>
      <span className="sr-only">Loading billing</span>
    </output>
  );
}

export function SimpleRouteSkeleton({ label }: { label: string }) {
  return (
    <output
      className="block space-y-4 animate-pulse motion-reduce:animate-none"
      aria-label={`Loading ${label}`}
    >
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-48 w-full rounded-xl" />
      <span className="sr-only">Loading {label}</span>
    </output>
  );
}
