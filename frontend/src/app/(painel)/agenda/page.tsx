import { requireUser } from "@/lib/session";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
export default async function CalendarPage() {
  await requireUser(true);
  return <CalendarWorkspace />;
}
