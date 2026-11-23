import { useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import AccountPage from "@/pages/account";
import { fetchMyShowcase, myShowcaseKey } from "@/lib/supporter-showcase";
import { SupporterShowcaseView } from "@/components/supporter/profile/SupporterShowcaseView";
import { HiddenProfile, ShowcaseError, ShowcaseSkeleton } from "@/components/supporter/profile/ShowcaseStates";
import { VisitorShowcase } from "@/pages/supporter-profile";
import { SavedTab } from "@/components/supporter/profile/ProfileTabs";

function OwnerShowcase({ token }: { token: string }) {
  const [preview, setPreview] = useState(false);
  const q = useQuery({ queryKey: myShowcaseKey(token), queryFn: () => fetchMyShowcase(token), staleTime: 0 });
  if (q.isLoading) return <ShowcaseSkeleton />;
  if (q.isError || !q.data) return <ShowcaseError what="your profile" onRetry={() => q.refetch()} />;
  const exit = () => { setPreview(false); window.scrollTo({ top: 0 }); };
  if (preview) {
    // Preview uses the anonymous public endpoint; a hidden profile shows the real hidden screen.
    return q.data.publicId && q.data.isPublic
      ? <VisitorShowcase publicId={q.data.publicId} preview onExitPreview={exit} />
      : <HiddenProfile preview onExitPreview={exit} />;
  }
  return <SupporterShowcaseView showcase={q.data} mode="owner" token={token} onPreview={() => { setPreview(true); window.scrollTo({ top: 0 }); }} />;
}

export default function MyProfilePage() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading, token, user } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated || !token) return <Redirect to="/login" />;
  if (user?.accountType === "organisation") return location === "/saved"
    ? <section className="rp-page-shell py-10" data-testid="page-organisation-saved"><h1 className="rp-display text-[42px] mb-6">Saved</h1><SavedTab /></section>
    : <AccountPage />;
  return <OwnerShowcase token={token} />;
}
