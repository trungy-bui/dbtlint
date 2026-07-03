import { Dashboard } from "@/components/dashboard/dashboard";
import { getUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) return

  return <Dashboard user={user} />;
}
