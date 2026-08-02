import { Upload } from "@/components/upload/upload";
import { getUser } from "@/lib/auth";
import { getUploadPlanState } from "@/lib/upload-plan";

export default async function UploadPage() {
  const user = await getUser();
  if (!user) return;
  const uploadPlanState = await getUploadPlanState(user.id);

  return <Upload existingProjects={uploadPlanState.existingProjects} />;
}
