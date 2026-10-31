import type { ReactNode } from "react";

/** A full-card editor button, separate from preview and destructive controls. */
export function CampaignEditorCard({ id, name, onEdit, disabled, children }: {
  id: string; name: string; onEdit?: () => void; disabled?: boolean; children: ReactNode;
}) {
  return (
    <div className="relative border border-border rounded-xl overflow-hidden bg-card flex flex-col sm:flex-row min-w-0" data-testid={`card-campaign-${id}`}>
      {onEdit && (
        <button type="button" onClick={onEdit} disabled={disabled}
          aria-label={`Continue editing ${name || "Untitled draft"}`}
          data-testid={`button-open-draft-${id}`}
          className="absolute inset-0 z-[1] rounded-xl cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-wait" />
      )}
      {children}
    </div>
  );
}
