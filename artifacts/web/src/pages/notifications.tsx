import { Link } from "wouter";
import SupporterPlaceholder from "@/pages/supporter-placeholder";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NotificationsInbox } from "@/components/supporter/NotificationsInbox";

/** Mobile full page; desktop deep-link shows the same inbox as a dismissible card with a way home. */
export default function NotificationsPage() {
  const { isAuthenticated, user } = useAuth();
  // Guests and organisations keep the existing placeholder access behaviour; no private API call.
  if (!isAuthenticated || user?.accountType !== "supporter") return <SupporterPlaceholder section="notifications" />;
  return (
    <div>
      <Link href="/feed" className="rp-link-u rpn-back" data-testid="link-notifications-back-home">
        <ArrowLeft size={16} aria-hidden /> Back to Home
      </Link>
      <NotificationsInbox variant="page" titleId="rpn-page-title" />
    </div>
  );
}
