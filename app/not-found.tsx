import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#0a0e14] px-6 text-slate-100">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center">
          <h1 className="pr-5 text-2xl font-bold">404</h1>
          <div className="border-l border-slate-700 pl-5">
            <p className="text-sm text-slate-400">
              This page could not be found.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
