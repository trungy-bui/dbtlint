import { Dashboard } from "@/components/dashboard/dashboard";
import { getUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getUser();

  return <Dashboard user={user} />;
}
