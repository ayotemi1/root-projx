import { Link, useSearch } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useTextPost } from "@/components/supporter/TextPostProvider";
import { useSupporterPostDraft } from "@/components/supporter/SupporterPostDraftProvider";
import { ArrowRight, Bell, Bookmark, Camera, Copy, Inbox, Pencil, SquarePlus } from "lucide-react";

const composers = {
  post: { title: "Post composer", icon: Copy, detail: "Sharing photos or video as a supporter hasn't been built yet. Publishing is unavailable, and nothing you do here will be posted." },
  story: { title: "Story composer", icon: Camera, detail: "Supporter stories (phone only, gone after 24 hours) haven't been built yet. Publishing is unavailable." },
  text: { title: "Text post composer", icon: Pencil, detail: "Writing a text post as a supporter hasn't been built yet. Publishing is unavailable, and nothing you do here will be posted." },
};

const sections = {
  create: {
    title: "Create",
    icon: SquarePlus,
    description: "A space to share what's caught your attention.",
    detail: "Share photos and videos as a post. Stories aren’t available yet.",
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
  const { isAuthenticated, user } = useAuth();
  const search = useSearch();
  const type = new URLSearchParams(search).get("type");
  const draft = useSupporterPostDraft();
  const textPost = useTextPost();
  if (section === "create" && type === "text") {
    return (
      <section className="py-2 sm:py-4" data-testid="page-supporter-create-text-entry">
        <h1 className="rp-display text-[40px] sm:text-[56px]">Text post</h1>
        <div className="mt-8 border border-[#17100F]/30 bg-[#FBF8F2] p-6 sm:p-8">
          <Pencil aria-hidden="true" className="h-8 w-8 mb-6" strokeWidth={1.5} />
          <p className="text-base leading-relaxed max-w-lg text-[#17100F]/75">Share a short update of up to 500 characters, and tag a community if you like.</p>
          {!isAuthenticated ? (
            <Link href="/login" className="rp-btn rp-btn-yellow mt-7">Sign in to write a text post</Link>
          ) : user?.accountType === "supporter" ? (
            <button type="button" className="rp-btn rp-btn-yellow mt-7" disabled={!textPost} onClick={e => textPost?.openComposer(e.currentTarget)} data-testid="button-write-text-post">Write a text post</button>
          ) : <p className="mt-5">Text posts are available to supporter accounts.</p>}
        </div>
        <Link href="/feed" className="inline-flex items-center min-h-11 mt-5 font-semibold underline underline-offset-4" data-testid="link-composer-back">Back to Home</Link>
      </section>
    );
  }
  if (section === "create" && type === "post" && draft && isAuthenticated && user?.accountType === "supporter") {
    return (
      <section className="py-2 sm:py-4" data-testid="page-supporter-create-post-entry">
        <h1 className="rp-display text-[40px] sm:text-[56px]">New post</h1>
        <div className="mt-8 border border-[#17100F]/30 bg-[#FBF8F2] p-6 sm:p-8">
          <Copy aria-hidden="true" className="h-8 w-8 mb-6" strokeWidth={1.5} />
          <p className="text-base leading-relaxed max-w-lg text-[#17100F]/75">Choose up to 5 photos or videos, crop and edit them, then add a caption and share.</p>
          <button type="button" className="rp-btn rp-btn-yellow mt-7" onClick={e => draft.openPicker(e.currentTarget)} data-testid="button-choose-media">Choose media</button>
        </div>
        <Link href="/feed" className="inline-flex items-center min-h-11 mt-5 font-semibold underline underline-offset-4" data-testid="link-composer-back">Back to Home</Link>
      </section>
    );
  }
  if (section === "create" && type && Object.hasOwn(composers, type)) {
    const c = composers[type as keyof typeof composers];
    const CIcon = c.icon;
    return (
      <section className="py-2 sm:py-4" data-testid={`page-supporter-create-${type}`}>
        <h1 className="rp-display text-[40px] sm:text-[56px]">{c.title}</h1>
        <div className="mt-8 border border-[#17100F]/30 bg-[#FBF8F2] p-6 sm:p-8">
          <CIcon aria-hidden="true" className="h-8 w-8 mb-6" strokeWidth={1.5} />
          <p className="rp-label !text-[11px] text-[#CA0813]" data-testid="status-composer-unavailable">Not built yet · Publishing unavailable</p>
          <h2 className="text-2xl font-bold mt-3">This composer doesn't exist yet.</h2>
          <p className="mt-3 text-base leading-relaxed max-w-lg text-[#17100F]/75">{c.detail}</p>
        </div>
        <Link href="/feed" className="inline-flex items-center min-h-11 mt-5 font-semibold underline underline-offset-4" data-testid="link-composer-back">Back to Home</Link>
      </section>
    );
  }
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
