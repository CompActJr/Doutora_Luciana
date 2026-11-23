import { requireUser } from "@/lib/session";
import { SimulatorWorkspace } from "@/components/simulator/simulator-workspace";
export default async function SimulatorPage() {
  await requireUser();
  return <SimulatorWorkspace />;
}
