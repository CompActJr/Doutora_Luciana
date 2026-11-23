import { requireUser } from "@/lib/session";
import { KnowledgeWorkspace } from "@/components/knowledge/knowledge-workspace";

export default async function KnowledgePage() {
  await requireUser();
  return <KnowledgeWorkspace />;
}
