import { requireUser } from "@/lib/session";
import { UserManagement } from "@/components/users/user-management";
export default async function UsersPage() {
  const user = await requireUser(true);
  return <UserManagement currentUserId={user.id} />;
}
