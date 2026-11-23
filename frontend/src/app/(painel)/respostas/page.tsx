import { requireUser } from "@/lib/session";
import { ResponseWorkspace } from "@/components/responses/response-workspace";
export default async function ResponsesPage() {
  await requireUser();
  return <ResponseWorkspace />;
}
