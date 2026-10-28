export function GuestDonorWallChoice({ optedIn, name, onOptIn, onName }: {
  optedIn: boolean; name: string; onOptIn: (value: boolean) => void; onName: (value: string) => void;
}) {
  return (
    <div className="mb-4 space-y-2 text-sm">
      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={optedIn} onChange={e => onOptIn(e.target.checked)}
          className="mt-1" data-testid="checkbox-guest-donor-wall" />
        <span>Show my first name and last initial on the donor wall.</span>
      </label>
      {optedIn && <label className="block">
        <span className="text-xs font-semibold">Your name</span>
        <input value={name} onChange={e => onName(e.target.value)} maxLength={80}
          autoComplete="name" placeholder="e.g. Alex Taylor"
          className="mt-1 w-full rounded-lg border border-border px-3 py-2" data-testid="input-guest-donor-name" />
      </label>}
      <p className="text-xs text-muted-foreground">Optional. Leave unchecked to appear as Anonymous. Your email is never shown.</p>
    </div>
  );
}
