import { requireUser } from "@/lib/session";
import { IntegrationsWorkspace } from "@/components/content/integrations-workspace";
export default async function IntegrationsPage() {
  const user = await requireUser();
  return <IntegrationsWorkspace admin={user.role === "admin"} />;
}
