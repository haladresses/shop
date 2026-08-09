import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { ADMIN_HELP_TOPICS } from "@/lib/adminHelp";
import HelpCenterClient from "@/components/admin/HelpCenterClient";

export default async function AdminHelpPage() {
  const user = await getCurrentUserWithPermissions();
  if (!user || !user.permissions.includes("admin.help.view")) {
    redirect("/signin");
  }

  const visibleTopics = ADMIN_HELP_TOPICS.filter((topic) => user.permissions.includes(topic.permission));
  const hiddenCount = ADMIN_HELP_TOPICS.length - visibleTopics.length;

  return (
    <HelpCenterClient
      visibleTopics={visibleTopics}
      hiddenCount={hiddenCount}
    />
  );
}