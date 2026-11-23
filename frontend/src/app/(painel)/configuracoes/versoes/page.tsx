import { requireUser } from "@/lib/session";
import { VersionsWorkspace } from "@/components/content/versions-workspace";

export default async function VersionsPage() {
  const user = await requireUser();
  return <VersionsWorkspace admin={user.role === "admin"} />;
}
