import { Link } from "wouter";
import SupporterPlaceholder from "@/pages/supporter-placeholder";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NotificationsInbox } from "@/components/supporter/NotificationsInbox";

/** Mobile full page; desktop deep-link shows the same inbox as a dismissible card with a way home. */
export default function NotificationsPage() {
  const { isAuthenticated, user, token } = useAuth();
  const allowed = user?.accountType === "supporter" || (user?.accountType === "organisation" && user.approvalStatus === "approved");
  // Guests, unapproved organisations and admin delegation keep the placeholder; no private API call.
  if (token?.startsWith("org-admin.")) return <div className="rpa-page" data-testid="page-notifications">
    <h1 className="rpa-h1">Notifications</h1>
    <p>Private notifications are available to the organisation owner and authorised team members. Admin access is limited to content management.</p>
  </div>;
  if (!isAuthenticated || !allowed) return <SupporterPlaceholder section="notifications" />;
  return (
    <div>
      <Link href="/feed" className="rp-link-u rpn-back" data-testid="link-notifications-back-home">
        <ArrowLeft size={16} aria-hidden /> Back to Home
      </Link>
      <NotificationsInbox variant="page" titleId="rpn-page-title" />
    </div>
  );
}
