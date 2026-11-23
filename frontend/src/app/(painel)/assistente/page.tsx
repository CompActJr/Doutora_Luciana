import { requireUser } from "@/lib/session";
import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";

export default async function AssistantPage() {
  await requireUser();
  return <AssistantWorkspace />;
}
