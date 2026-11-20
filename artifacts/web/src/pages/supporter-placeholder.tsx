import { Link } from "wouter";
import { ArrowRight, Bell, Bookmark, Inbox, SquarePlus } from "lucide-react";

const sections = {
  create: {
    title: "Create",
    icon: SquarePlus,
    description: "A space to share what's caught your attention.",
    detail: "Supporter posts and stories will be built in a later stage. Nothing can be published from this page yet.",
  },
  inbox: {
    title: "Inbox",
    icon: Inbox,
    description: "A home for your conversations.",
    detail: "Messaging hasn't been built yet. You can't send or receive messages here at this stage.",
  },
  notifications: {
    title: "Notifications",
    icon: Bell,
    description: "Keep up with your community.",
    detail: "Supporter notifications will be added in a later stage. This page doesn't show live alerts yet.",
  },
  saved: {
    title: "Saved",
    icon: Bookmark,
    description: "A place to return to the things that matter to you.",
    detail: "Saving posts and campaigns will be added in a later stage. There are no bookmarking tools connected to this page yet.",
  },
};

export type SupporterPlaceholderSection = keyof typeof sections;

export default function SupporterPlaceholder({ section }: { section: SupporterPlaceholderSection }) {
  const { title, icon: Icon, description, detail } = sections[section];
  return (
    <section className="py-2 sm:py-4" data-testid={`page-supporter-${section}`}>
      <h1 className="rp-display text-[44px] sm:text-[64px]">{title}</h1>
      <p className="mt-5 text-lg leading-relaxed">{description}</p>
      <div className="mt-8 border border-[#17100F]/30 bg-[#FBF8F2] p-6 sm:p-8">
        <Icon aria-hidden="true" className="h-8 w-8 mb-6" strokeWidth={1.5} />
        <p className="rp-label !text-[11px] text-[#CA0813]">Coming in a later stage</p>
        <h2 className="text-2xl font-bold mt-3">Your {title.toLowerCase()} space is ready to build.</h2>
        <p className="mt-3 text-base leading-relaxed max-w-lg text-[#17100F]/75">{detail}</p>
        <Link href="/discover" className="rp-btn rp-btn-yellow mt-7">
          Explore organisations <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
      <Link href="/feed" className="inline-flex items-center min-h-11 mt-5 font-semibold underline underline-offset-4">Back to Home</Link>
    </section>
  );
}
