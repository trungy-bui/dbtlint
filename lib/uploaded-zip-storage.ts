import { createTriggerClient } from "@/lib/supabase/trigger";

const UPLOAD_BUCKET = "dbt-uploads";

export async function uploadedZipExists(storageFilePath: string) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return false;
  }

  const { data, error } = await createTriggerClient()
    .storage.from(UPLOAD_BUCKET)
    .exists(storageFilePath);

  return !error && data;
}

export async function deleteUploadedZip(storageFilePath: string) {
  const { error } = await createTriggerClient()
    .storage.from(UPLOAD_BUCKET)
    .remove([storageFilePath]);

  if (error) {
    throw new Error(`Failed to delete uploaded zip: ${error.message}`);
  }
}
