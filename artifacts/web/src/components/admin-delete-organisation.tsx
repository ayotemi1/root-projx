import { appFetch as fetch, userErrorMessage } from "@/lib/error-feedback";
import { useState } from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription,
  AlertDialogHeader, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OrganisationDeletionInput, OrganisationDeletionResult } from "@workspace/api-client-react";
import { organisationDeletionConfirmation } from "../../../api-server/src/lib/organisation-deletion-confirmation";

export function AdminDeleteOrganisation({ org, token, onDeleted, onUnauthorized }: {
  org: { _id: string; name?: string | null } | null;
  token: string;
  onDeleted: (id: string) => void;
  onUnauthorized: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Each organisation row owns its dialog, so reopening never keeps a previous
  // confirmation or failure. A request in progress cannot be dismissed.
  if (!org) return null;
  const organisation = org;
  const name = typeof organisation.name === "string" ? organisation.name.trim() : "";
  const displayName = name || "Unnamed organisation";
  const expectedConfirmation = organisationDeletionConfirmation();
  function changeOpen(value: boolean) {
    if (busy) return;
    setOpen(value);
    setConfirmation("");
    setError("");
  }
  async function remove() {
    if (busy || confirmation !== expectedConfirmation) return;
    setBusy(true);
    setError("");
    try {
      const body: OrganisationDeletionInput = { confirmationName: confirmation };
      const response = await fetch(`${import.meta.env.BASE_URL}api/admin/organisations/${encodeURIComponent(organisation._id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify(body),
      });
      if (response.status === 401) { onUnauthorized(); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete the organisation.");
      const deleted = result as OrganisationDeletionResult;
      if (!deleted.deleted || deleted.orgId !== organisation._id) throw new Error("Deletion was not confirmed. Please refresh and try again.");
      onDeleted(organisation._id);
    } catch (err) {
      setError(userErrorMessage(err, "delete this organisation"));
    } finally {
      setBusy(false);
    }
  }
  return <>
    <button type="button" onClick={() => changeOpen(true)} className="mt-3 text-sm font-bold text-primary underline"
      aria-label={`Delete ${displayName}`}>Delete organisation</button>
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {displayName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the organisation, its campaigns and posts from public view and blocks organisation access and new donations.
            Donation and payout records are kept for accounting. Recurring donations must be canceled first; payment-provider accounts are not closed.
            There is no restore button in the admin panel.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!name && <p className="text-sm break-all">Organisation ID: {organisation._id}</p>}
        <label htmlFor={`delete-name-${organisation._id}`} className="text-sm">
          To confirm deletion, type: <strong>“{expectedConfirmation}”</strong>
        </label>
        <Input id={`delete-name-${organisation._id}`} value={confirmation} disabled={busy} autoComplete="off"
          placeholder={expectedConfirmation}
          onChange={(event) => setConfirmation(event.target.value)} />
        {error && <p role="alert" className="text-sm text-primary">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button type="button" disabled={busy || confirmation !== expectedConfirmation} onClick={remove}>
            {busy ? "Deleting…" : "Delete organisation"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
