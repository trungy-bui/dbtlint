import { Upload } from "@/components/upload/upload";
import { getUser } from "@/lib/auth";
import { getUploadPlanState } from "@/lib/upload-plan";

export default async function UploadPage() {
  const user = await getUser();
  if (!user) return;
  const uploadPlanState = await getUploadPlanState(user.id);

  return (
    <div className="space-y-6">
      <header>
        <p className="terminal-label text-emerald-400">New analysis</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-50 sm:text-3xl">
          Upload project
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Add one or more dbt project archives and start a lint run.
        </p>
      </header>
      <div className="flex flex-1 flex-col items-center">
        <Upload existingProjects={uploadPlanState.existingProjects} />
      </div>
    </div>
  );
}
