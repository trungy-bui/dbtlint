import { Upload } from "@/components/upload/upload";
import { getUser } from "@/lib/auth";
import { getUploadPlanState } from "@/lib/upload-plan";

export default async function UploadPage() {
  const user = await getUser();
  if (!user) return;
  const uploadPlanState = await getUploadPlanState(user.id);

  return (
    <div className="flex flex-1 flex-col items-center justify-top">
      <Upload existingProjects={uploadPlanState.existingProjects} />
    </div>
  );
}
