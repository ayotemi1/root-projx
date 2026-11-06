import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Clock, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { myPayoutsKey } from "@/lib/payouts-api";

export interface BankDetailsStatus {
  hasDetails: boolean;
  revision: string | null;
  submittedAt: string | null;
  approved: boolean;
}

type Field =
  | "accountHolder" | "bankName" | "bankCountry" | "currency" | "accountNumber" | "iban"
  | "routingCode" | "swiftBic" | "branchName" | "bankAddress" | "beneficiaryAddress";
type FormState = Record<Field, string>;

const EMPTY: FormState = {
  accountHolder: "", bankName: "", bankCountry: "", currency: "", accountNumber: "", iban: "",
  routingCode: "", swiftBic: "", branchName: "", bankAddress: "", beneficiaryAddress: "",
};

const MAX: Record<Field, number> = {
  accountHolder: 150, bankName: 150, branchName: 150, bankAddress: 300, beneficiaryAddress: 300,
  accountNumber: 34, iban: 34, routingCode: 30, swiftBic: 11, bankCountry: 2, currency: 3,
};

export const bankDetailsStatusKey = (orgId: string) => ["bank-details-status", orgId] as const;

export async function fetchBankDetailsStatus(token: string): Promise<BankDetailsStatus> {
  const res = await fetch("/api/payout/bank-details", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const body = await res.json().catch(() => ({})) as BankDetailsStatus & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return { hasDetails: !!body.hasDetails, revision: body.revision ?? null, submittedAt: body.submittedAt ?? null, approved: !!body.approved };
}

function validate(f: FormState): Partial<Record<Field | "account", string>> {
  const e: Partial<Record<Field | "account", string>> = {};
  const t = (k: Field) => f[k].trim();
  if (!t("accountHolder")) e.accountHolder = "Enter the name on the account.";
  if (!t("bankName")) e.bankName = "Enter the bank name.";
  if (!/^[A-Za-z]{2}$/.test(t("bankCountry"))) e.bankCountry = "Use the 2-letter country code, for example JM, GB or US.";
  if (!/^[A-Za-z]{3}$/.test(t("currency"))) e.currency = "Use the 3-letter currency code, for example JMD, GBP or USD.";
  const country = t("bankCountry").toUpperCase();
  const iban = t("iban").replace(/\s/g, "");
  const acct = t("accountNumber");
  const routing = t("routingCode").replace(/[\s-]/g, "");
  if (!acct && !iban) e.account = "Enter an account number or an IBAN.";
  if (iban && !/^[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}$/.test(iban)) e.iban = "This IBAN doesn't look right. Check it against your bank statement.";
  if (country === "GB" && !iban && !/^\d{6}$/.test(routing)) e.routingCode = "UK accounts without an IBAN need a 6-digit sort code.";
  if (country === "US" && !/^\d{9}$/.test(routing)) e.routingCode = "US accounts need a 9-digit routing number.";
  if (t("swiftBic") && !/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/.test(t("swiftBic"))) e.swiftBic = "SWIFT/BIC is 8 or 11 letters and numbers.";
  (Object.keys(MAX) as Field[]).forEach((k) => { if ((k === "iban" ? iban : f[k].trim()).length > MAX[k]) e[k] = `Keep this under ${MAX[k] + 1} characters.`; });
  return e;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function BankDetailsOwner({ orgId, token }: { orgId: string; token: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field | "account", string>>>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const statusQ = useQuery({
    queryKey: bankDetailsStatusKey(orgId),
    queryFn: () => fetchBankDetailsStatus(token),
    enabled: !!token,
    staleTime: 0,
  });

  // Raw details only live in this component's memory; wipe on unmount.
  useEffect(() => () => { setForm(EMPTY); }, []);

  const status = statusQ.data;
  const busy = saving || statusQ.isFetching;

  function set(k: Field, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined, ...(k === "accountNumber" || k === "iban" ? { account: undefined } : {}) }));
    setSaveError("");
  }

  function cancel() {
    setForm(EMPTY); setEditing(false); setConfirmed(false); setErrors({}); setSaveError("");
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving) return;
    const found = validate(form);
    if (Object.values(found).some(Boolean)) { setErrors(found); return; }
    if (!confirmed) { setSaveError("Tick the confirmation box before saving."); return; }
    setSaving(true); setSaveError("");
    const body: Record<string, string> = {};
    (Object.keys(form) as Field[]).forEach((k) => {
      let v = form[k].trim();
      if (k === "bankCountry" || k === "currency" || k === "swiftBic") v = v.toUpperCase();
      if (k === "iban") v = v.replace(/\s/g, "").toUpperCase();
      if (v) body[k] = v;
    });
    try {
      const res = await fetch("/api/payout/bank-details", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({})) as BankDetailsStatus & { error?: string };
      if (!res.ok) { setSaveError(data.error ?? `Could not save bank details (${res.status}).`); return; }
      setForm(EMPTY); setEditing(false); setConfirmed(false); setErrors({});
      queryClient.setQueryData(bankDetailsStatusKey(orgId), {
        hasDetails: true, revision: data.revision ?? null, submittedAt: data.submittedAt ?? new Date().toISOString(), approved: false,
      });
      queryClient.invalidateQueries({ queryKey: bankDetailsStatusKey(orgId) });
      queryClient.invalidateQueries({ queryKey: ["payout-setup", orgId] });
      queryClient.invalidateQueries({ queryKey: myPayoutsKey(orgId) });
      setNotice("Saved. Root ProjX will check these details with you before approving them.");
    } catch {
      setSaveError("Network error. Your entries are still here. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (statusQ.isLoading) return <Skeleton className="h-20 w-full rounded-lg" />;
  if (statusQ.isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-2" data-testid="error-bank-status">
        <p className="flex items-start gap-1.5"><AlertCircle className="w-4 h-4 flex-shrink-0" /> Couldn't load your bank details status.</p>
        <Button size="sm" variant="outline" className="h-7" onClick={() => statusQ.refetch()}>Retry</Button>
      </div>
    );
  }

  const field = (k: Field, label: string, opts: { hint?: string; placeholder?: string; required?: boolean; mono?: boolean; autoComplete?: string } = {}) => {
    const err = errors[k];
    const id = `bank-${k}`;
    return (
      <div className="space-y-1">
        <Label htmlFor={id} className="text-xs font-semibold">
          {label}{opts.required ? <span className="text-destructive" aria-hidden="true"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
        </Label>
        {opts.hint && <p id={`${id}-hint`} className="text-[11px] text-muted-foreground leading-snug">{opts.hint}</p>}
        <Input
          id={id} value={form[k]} maxLength={k === "iban" ? 42 : MAX[k]} disabled={busy} placeholder={opts.placeholder}
          autoComplete={opts.autoComplete ?? "off"} spellCheck={false}
          aria-invalid={!!err} aria-required={opts.required}
          aria-describedby={[opts.hint ? `${id}-hint` : "", err ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined}
          className={opts.mono ? "font-mono" : undefined}
          onChange={(e) => set(k, e.target.value)} data-testid={`input-${id}`}
        />
        {err && <p id={`${id}-err`} role="alert" className="text-[11px] text-destructive">{err}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-3" data-testid="section-bank-details">
      {status?.hasDetails ? (
        status.approved ? (
          <p className="text-sm font-semibold text-green-700 flex items-start gap-1.5" data-testid="text-bank-details-approved">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> Bank details verified by Root ProjX.
          </p>
        ) : (
          <p className="text-sm font-semibold text-amber-700 flex items-start gap-1.5" data-testid="text-bank-details-awaiting">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" /> Saved {formatDate(status.submittedAt)}. Awaiting review by Root ProjX.
          </p>
        )
      ) : (
        <p className="text-sm font-semibold text-amber-700 flex items-start gap-1.5" data-testid="text-bank-details-missing">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> Add bank details so Root ProjX can pay you.
        </p>
      )}
      {notice && !editing && <p role="status" className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-md px-2.5 py-2">{notice}</p>}

      {!editing ? (
        <>
          {status?.hasDetails && (
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> For your security, saved details are never shown again here. To change them, re-enter them in full.
            </p>
          )}
          <Button size="sm" variant={status?.hasDetails ? "outline" : "default"} className="w-full font-semibold whitespace-normal h-auto py-2"
            disabled={busy} onClick={() => { setNotice(""); setEditing(true); }} data-testid="button-bank-details-edit">
            {status?.hasDetails ? "Replace bank details" : "Add bank details"}
          </Button>
        </>
      ) : (
        <form onSubmit={save} noValidate className="space-y-3 rounded-lg border border-border bg-background p-3" data-testid="form-bank-details">
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" /> Sent securely and stored encrypted. Only Root ProjX payout staff can view them.
          </p>
          {status?.hasDetails && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
              Saving new details replaces your current ones{status.approved ? " and withdraws the current approval until Root ProjX reviews them again" : ""}.
            </p>
          )}
          {field("accountHolder", "Account holder name", { required: true, hint: "Exactly as your bank shows it." })}
          {field("bankName", "Bank name", { required: true, placeholder: "e.g. National Commercial Bank" })}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field("bankCountry", "Bank country", { required: true, mono: true, placeholder: "JM", hint: "2-letter code: JM Jamaica, GB United Kingdom, US United States." })}
            {field("currency", "Account currency", { required: true, mono: true, placeholder: "JMD", hint: "3-letter code: JMD, GBP, USD." })}
          </div>
          <fieldset className="space-y-3 rounded-md border border-dashed border-border p-2.5">
            <legend className="px-1 text-[11px] font-semibold">Account number or IBAN (at least one)</legend>
            {field("accountNumber", "Account number", { mono: true })}
            {field("iban", "IBAN", { mono: true, placeholder: "GB29 NWBK 6016 1331 9268 19" })}
            {errors.account && <p role="alert" className="text-[11px] text-destructive">{errors.account}</p>}
          </fieldset>
          {field("routingCode", "Sort code / routing number", { mono: true, hint: "UK: 6-digit sort code if no IBAN. US: 9-digit routing number." })}
          {field("swiftBic", "SWIFT / BIC", { mono: true, placeholder: "8 or 11 characters" })}
          {field("branchName", "Branch name")}
          {field("bankAddress", "Bank address")}
          {field("beneficiaryAddress", "Your organisation's address", { hint: "Some international transfers require it." })}

          <label className="flex items-start gap-2 text-xs leading-snug cursor-pointer">
            <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={confirmed} disabled={busy}
              onChange={(e) => { setConfirmed(e.target.checked); setSaveError(""); }} data-testid="checkbox-bank-details-confirm" />
            <span>I confirm these details are accurate. I understand changing them withdraws any approval until Root ProjX reviews them again.</span>
          </label>
          {saveError && <p role="alert" className="text-xs text-destructive bg-destructive/10 px-2.5 py-2 rounded-md" data-testid="error-bank-details-save">{saveError}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1 font-bold" disabled={busy || !confirmed} data-testid="button-bank-details-save">
              {saving ? "Saving…" : "Save bank details"}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={cancel} data-testid="button-bank-details-cancel">Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
