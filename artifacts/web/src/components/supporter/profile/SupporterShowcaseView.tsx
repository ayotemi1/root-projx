import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Eye, EyeOff, Lock, MessageSquare, Send } from "lucide-react";
import type { SupporterShowcase } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { StartMessageButton } from "@/components/messaging/StartMessageButton";
import { InvolvementTab, MediaTab, PostsTab, SavedTab } from "./ProfileTabs";
import "./profile.css";

export type ShowcaseMode = "owner" | "preview" | "visitor";
type Tab = "posts" | "media" | "involvement" | "saved";

const monthYear = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : null;

const TABS = ["posts", "media", "involvement", "saved"] as const;

/** Real photo, or plain black circle with yellow initials. Ring only for a real unexpired story. */
function ProfileAvatar({ showcase }: { showcase: SupporterShowcase }) {
  const [failed, setFailed] = useState(false);
  const exp = showcase.storyExpiresAt ? Date.parse(showcase.storyExpiresAt) : NaN;
  const story = Number.isFinite(exp) && exp > Date.now();
  const inner = (
    <div className="w-full h-full rounded-full overflow-hidden bg-[#17100F] text-[#F3BF2C] grid place-items-center rp-display text-[38px] sm:text-[48px]" data-testid="img-avatar">
      {showcase.avatarUrl && !failed ? <img src={showcase.avatarUrl} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} /> : showcase.avatarInitials}
    </div>
  );
  return (
    <div className="w-24 h-24 sm:w-[124px] sm:h-[124px] shrink-0">
      {story ? (
        <div className="w-full h-full rounded-full p-[4px] bg-[linear-gradient(135deg,#F3BF2C,#CA0813)]" data-testid="status-story-ring">
          <div className="w-full h-full rounded-full p-[3px] bg-[#F4EFE6]">{inner}</div>
        </div>
      ) : inner}
    </div>
  );
}

export function SupporterShowcaseView({ showcase, mode, token, onPreview, onExitPreview }: {
  showcase: SupporterShowcase; mode: ShowcaseMode; token: string | null; onPreview?: () => void; onExitPreview?: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const editable = mode === "owner";
  const tabs: Tab[] = editable ? [...TABS] : ["posts", "media", "involvement"];
  // Owner and visitor tabs live in the URL (refresh/back/direct entry); Preview stays local.
  const urlTab = (() => {
    if (location === "/saved") return "saved";
    const sp = new URLSearchParams(search);
    if (sp.get("post")) return "posts";
    const t = sp.get("tab");
    return (TABS as readonly string[]).includes(t ?? "") ? t as Tab : "posts";
  })();
  const [previewTab, setPreviewTab] = useState<Tab>("posts");
  const wanted = mode === "preview" ? previewTab : urlTab;
  const tab: Tab = tabs.includes(wanted) ? wanted : "posts";
  const setTab = (t: Tab) => {
    if (mode === "preview") { setPreviewTab(t); return; }
    const base = editable ? "/profile" : location;
    if (editable && t === "saved") navigate("/saved");
    else navigate(t === "posts" ? base : `${base}?tab=${t}`);
  };
  const linkedPost = mode === "preview" ? null : new URLSearchParams(search).get("post");
  // Saved/notification deep link: open Posts and scroll once the post is rendered.
  useEffect(() => {
    if (!linkedPost) return;
    let tries = 0; let raf = 0;
    const seek = () => {
      const el = document.getElementById(`post-${linkedPost}`);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.focus?.({ preventScroll: true }); return; }
      if (++tries < 60) raf = requestAnimationFrame(seek);
    };
    raf = requestAnimationFrame(seek);
    return () => cancelAnimationFrame(raf);
  }, [linkedPost, showcase.posts.length]);
  const isSelf = !!showcase.publicId && user?.publicProfileSettings?.publicId === showcase.publicId;
  const canShare = showcase.isPublic && !!showcase.publicId;
  const since = monthYear(showcase.createdAt);
  const interests = showcase.visibleInterests;
  const meta = [showcase.location, ...interests].filter(Boolean);

  useEffect(() => {
    document.title = `${showcase.displayName} · Root ProjX`;
  }, [showcase.displayName]);

  async function share() {
    if (!canShare) return;
    const url = `${window.location.origin}/supporters/${showcase.publicId}`;
    try {
      if (navigator.share) { await navigator.share({ title: showcase.displayName, url }); return; }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: url });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      toast({ title: "Couldn’t share the link", description: url, variant: "destructive" });
    }
  }

  function openPost(id: string) {
    setTab("posts");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(`post-${id}`);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); history.replaceState(null, "", `#post-${id}`); }
    }));
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] overflow-x-clip px-4 sm:px-6 py-6 sm:py-10 pb-28 md:pb-12" data-testid={`page-supporter-profile-${mode}`}>
      {mode === "preview" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-[#17100F] text-[#FBF8F2] px-4 py-3" role="status" data-testid="status-preview-banner">
          <span className="text-[14px] inline-flex items-center gap-2"><Eye className="w-4 h-4 text-[#F3BF2C]" />Preview: this is what visitors see.</span>
          <button type="button" className="rp-btn rp-btn-yellow !min-h-9 !text-[14px]" onClick={onExitPreview} data-testid="button-exit-preview">Exit preview</button>
        </div>
      )}
      {editable && !showcase.isPublic && (
        <div className="mb-6 border border-[#17100F] bg-[#F3BF2C]/25 px-4 py-3 text-[14px] flex flex-wrap items-center gap-2" data-testid="status-profile-hidden">
          <Lock className="w-4 h-4" /> Your profile is hidden. Only you can see this page.
          <Link href="/account" className="rp-link-u ml-auto" data-testid="link-make-public">Change in account</Link>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_280px] gap-10 lg:gap-14">
        <div className="min-w-0">
          <header className="rp-rise flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-7">
            <ProfileAvatar showcase={showcase} />
            <div className="min-w-0 flex-1">
              <h1 className="rp-display text-[clamp(30px,8.5vw,40px)] sm:text-[clamp(34px,4.4vw,52px)] [overflow-wrap:break-word] [word-break:normal] hyphens-none max-w-full" data-testid="text-display-name">{showcase.displayName}</h1>
              <div className="flex flex-wrap gap-2 mt-3 min-w-0">
                {editable && <>
                  <Link href="/account" className="rp-btn rp-btn-ghost !min-h-10 !text-[14px] !px-4" data-testid="link-edit-profile">Edit profile</Link>
                  <button type="button" className="rp-btn rp-btn-ghost !min-h-10 !text-[14px] !px-4" onClick={onPreview} data-testid="button-preview-profile">Preview</button>
                </>}
                {mode === "visitor" && showcase.publicId && !isSelf && (
                  <StartMessageButton recipient={{ kind: "supporter", id: showcase.publicId }} recipientName={showcase.displayName}
                    className="rp-btn rp-btn-yellow !min-h-10 !text-[14px] !px-4" testId="button-message-supporter" />
                )}
                {mode === "preview" && (
                  <button type="button" className="rp-btn rp-btn-yellow !min-h-10 !text-[14px] !px-4" disabled title="Visitors can message you from here" data-testid="button-message-supporter"><MessageSquare className="w-4 h-4" aria-hidden /> Message</button>
                )}
                {canShare && (
                  <button type="button" className="rp-btn rp-btn-ghost !min-h-10 !w-12 !px-0" onClick={share} disabled={mode === "preview"} aria-label="Share profile" data-testid="button-share-profile"><Send className="w-4 h-4" /></button>
                )}
              </div>
              <dl className="flex flex-wrap gap-x-5 gap-y-1 mt-4" data-testid="stats-profile">
                {([["posts", "Posts"], ["following", "Following"], ["organisations", "Organisations"]] as const).map(([k, l]) => (
                  <div key={k} className="flex items-baseline gap-1.5">
                    <dt className="sr-only">{l}</dt>
                    <dd className="rp-display text-[26px]" data-testid={`text-count-${k}`}>{showcase.counts[k]}</dd>
                    <span aria-hidden className="rp-label !text-[11px]">{l}</span>
                  </div>
                ))}
              </dl>
            </div>
          </header>

          {meta.length > 0 && <p className="rp-label !text-[11px] text-[#17100F]/65 mt-5 leading-relaxed [overflow-wrap:anywhere]" data-testid="text-profile-meta">{meta.join(" · ")}</p>}
          {showcase.bio && <p className="text-[17px] leading-relaxed mt-2 max-w-xl whitespace-pre-wrap [overflow-wrap:anywhere]" data-testid="text-bio">{showcase.bio}</p>}

          <nav className="mt-8 border-b border-[#17100F] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Profile sections">
            <div className="flex sm:justify-center min-w-max">
              {tabs.map(t => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  className={`relative rp-label !text-[11px] px-3 sm:px-6 min-h-12 inline-flex items-center gap-1.5 ${tab === t ? "text-[#17100F] font-bold" : "text-[#17100F]/55 hover:text-[#17100F]"}`}
                  data-testid={`tab-${t}`}>
                  {t === "saved" && <Lock className="w-3 h-3" />}{t}
                  {tab === t && <span className="absolute left-2 right-2 -bottom-px h-[3px] bg-[#17100F]" />}
                </button>
              ))}
            </div>
          </nav>

          <div className="mt-5" role="tabpanel" key={tab}>
            {tab === "posts" && <PostsTab posts={showcase.posts} editable={editable} />}
            {tab === "media" && <MediaTab posts={showcase.posts} />}
            {tab === "involvement" && <InvolvementTab showcase={showcase} editable={editable} token={token} onOpenPost={openPost} />}
            {tab === "saved" && editable && <SavedTab />}
          </div>
        </div>

        <aside className="order-first lg:order-none hidden lg:block text-[13px]" aria-label="About" data-testid="section-about">
          <h2 className="rp-label !text-[11px] !font-medium pb-2 border-b border-[#17100F]" style={{ fontFamily: "var(--app-font-mono)" }}>About</h2>
          {showcase.bio && <p className="py-4 border-b border-[#17100F]/15 leading-relaxed">{showcase.bio}</p>}
          <dl className="grid grid-cols-2 gap-4 py-4 border-b border-[#17100F]/15">
            {showcase.location && <div><dt className="text-[#17100F]/60 text-[11px]">Based in</dt><dd className="font-semibold" data-testid="text-based-in">{showcase.location}</dd></div>}
            {since && <div><dt className="text-[#17100F]/60 text-[11px]">Member since</dt><dd className="font-semibold" data-testid="text-member-since">{since}</dd></div>}
          </dl>
          {interests.length > 0 && (
            <div className="py-4"><p className="text-[#17100F]/60 text-[11px]">Interested in</p><p className="font-semibold" data-testid="text-interests">{interests.join(", ")}</p></div>
          )}
          {editable && (
            <p className="mt-2 text-[12px] text-[#17100F]/60 flex gap-1.5">{showcase.isPublic ? <Eye className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <EyeOff className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              {showcase.isPublic ? "Public. Email, phone and donation amounts are never shown." : "Hidden. Nobody else can open this profile."}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
