import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { userErrorMessage } from "@/lib/error-feedback";
import { fetchMyShowcase, myShowcaseKey, refreshShowcase, saveShowcaseDetails } from "@/lib/supporter-showcase";

/** Location and which interests appear on the profile. Interests are private unless ticked here. */
export function ShowcaseDetailsCard({ token }: { token: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery({ queryKey: myShowcaseKey(token), queryFn: () => fetchMyShowcase(token) });
  const [location, setLocation] = useState("");
  const [shown, setShown] = useState<string[]>([]);
  const [error, setError] = useState("");
  const init = useRef(false);
  useEffect(() => {
    if (q.data && !init.current) {
      init.current = true;
      setLocation(q.data.location);
      setShown(q.data.visibleInterests.filter(i => q.data!.availableInterests.includes(i)));
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => saveShowcaseDetails({ location: location.trim(), visibleInterests: shown }, token),
    onSuccess: () => { setError(""); refreshShowcase(qc); toast({ title: "Profile details saved" }); },
    onError: e => setError(userErrorMessage(e, "save your profile details")),
  });

  const d = q.data;
  const dirty = !!d && (location.trim() !== d.location || [...shown].sort().join("|") !== [...d.visibleInterests].sort().join("|"));

  return (
    <Card className="border-border shadow-sm" data-testid="card-showcase-details">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />Profile details</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? <Skeleton className="h-24 w-full" /> : q.isError || !d ? (
          <div role="alert" className="text-sm"><p>Couldn’t load your profile details.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => q.refetch()} data-testid="button-retry-showcase-details">Try again</Button></div>
        ) : <>
          <p className="text-sm text-muted-foreground">
            {d.isPublic ? "Shown on your public profile." : "Your profile is hidden, so these are only visible to you for now."}{" "}
            <Link href="/profile" className="underline underline-offset-2" data-testid="link-view-profile">View profile</Link>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="showcase-location">Based in</Label>
            <Input id="showcase-location" value={location} maxLength={120} placeholder="e.g. London" onChange={e => setLocation(e.target.value)} data-testid="input-showcase-location" />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Interests to show</legend>
            <p className="text-xs text-muted-foreground">Your interests stay private unless you tick them here.</p>
            {d.availableInterests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No interests chosen yet. <Link href="/settings/interests" className="underline">Choose interests</Link></p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {d.availableInterests.map(i => {
                  const on = shown.includes(i);
                  return (
                    <button key={i} type="button" aria-pressed={on} onClick={() => setShown(s => on ? s.filter(x => x !== i) : [...s, i])}
                      className={`min-h-9 px-3 rounded-full border text-[13px] ${on ? "bg-[#17100F] text-[#FBF8F2] border-[#17100F]" : "border-[#17100F]/25"}`}
                      data-testid={`toggle-interest-${i.replace(/\W+/g, "-").toLowerCase()}`}>{i}</button>
                  );
                })}
              </div>
            )}
          </fieldset>
          {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2" role="alert">{error}</div>}
          {dirty && <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-showcase-details">{save.isPending ? "Saving…" : "Save details"}</Button></div>}
        </>}
      </CardContent>
    </Card>
  );
}
