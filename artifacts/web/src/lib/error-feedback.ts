/** Public error copy: never display raw browser, infrastructure or credential errors.
 * Network failures cannot tell us whether an operation reached the server.
 * Do not automatically retry writes, payments or payouts here.
 */
export function userErrorMessage(error: unknown, action = "complete this request"): string {
  const e = error as { message?: unknown; status?: number; name?: string } | null;
  const raw = typeof e?.message === "string" ? e.message.trim() : "";
  const status = e?.status;
  const uncertain = /donat|checkout|payment|payout|transfer|sent/i.test(action)
    ? " Check your receipt or payment history before trying again to avoid a duplicate."
    : " Keep this page open so you don’t lose unsaved work.";
  if (e?.name === "AbortError" || /timed? out|timeout/i.test(raw))
    return `We couldn’t confirm whether we could ${action} because the request timed out.${uncertain} Check your connection and try again when it is stable.`;
  if (/^failed to fetch$|^load failed$|networkerror|network request failed|network error|^fetch failed$|connection.*interrupt/i.test(raw))
    return `We couldn’t connect to the service to ${action}. Your connection may have dropped, or the service may be unavailable.${uncertain} Check your internet connection and try again. If it continues, contact Root ProjX with the action and time of the error.`;
  if (status === 401 && /sign in|sign into/.test(action)) return /admin/.test(action)
    ? "The admin password wasn’t accepted. Check it and try again. If it still fails, ask the Root ProjX administrator to check the configured password."
    : "The sign-in details weren’t accepted. Check your email and password, or use Forgot password to request a new reset link.";
  if (status === 401) return "Your sign-in session is no longer valid. Sign in again, then return here and retry. Keep a copy of any unsaved text first.";
  if (status === 403) return "This account doesn’t have permission for this action. Check that you’re signed into the correct organisation or admin account. If it is correct, contact Root ProjX.";
  if (status === 413) return "The upload is too large for this request. Videos can be up to 500 MB; images up to 20 MB. Choose a smaller file, or use the video uploader for a video.";
  if (status === 415) return "This file format isn’t supported. Choose MP4, MOV or WebM for video, or JPEG, PNG, WebP or GIF for an image.";
  if (status === 429) return "Too many requests were made in a short time. Wait a minute, then try again. Repeated clicks won’t speed this up.";
  if (status === 404) return "We couldn’t find this page or record. It may have been removed or the link may be out of date. Return to the dashboard and open it again.";
  if (/Please review the responsibilities of managing losses for connected accounts/i.test(raw))
    return `${raw} Contact Root ProjX to review the Stripe Connect account setup. Retrying won’t finish onboarding until that setup is corrected.`;
  // Preserve specific validation and business instructions; replace infrastructure
  // details and opaque generic messages with safe, actionable copy.
  if (/firebase|firestore|permission.denied|stack trace|ECONN|ENOTFOUND|SQLSTATE|Bearer |AIza|sk_live_|https?:\/\/\S*[?&](?:token|signature|key)=/i.test(raw))
    return `The service couldn’t ${action}.${uncertain} Please contact Root ProjX with the action and time of the error so we can investigate.`;
  if (!raw || /^(?:request|upload|operation|update|login|registration|save|publish|delete|fetch)?\s*failed(?: to [\w ]+)?[.!]?(?: \(\d+\))?$|^something went wrong[.!]?$/i.test(raw) || /^(?:internal server error|unexpected token|unexpected end of json)/i.test(raw))
    return `We couldn’t ${action}.${uncertain} Try again shortly. If it keeps happening, contact Root ProjX with the action and time of the error.`;
  if ((status ?? 0) >= 500) return `The service couldn’t ${action}.${uncertain} Try again shortly. If it continues, contact Root ProjX with the action and time of the error.`;
  // Already actionable messages remain unchanged. Short server validation without
  // an instruction receives a next step rather than an unexplained error.
  return /\b(try|choose|check|contact|sign in|wait|enter|select|use|must|please|remove|add|reset|keep|cannot|can’t|minimum|maximum)\b/i.test(raw)
    ? raw : `${raw} Check the details and try again. If it continues, contact Root ProjX.`;
}

export async function appFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try { return await fetch(input, init); }
  catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    const path = String(input);
    const action = /donations|checkout/.test(path) ? "start checkout"
      : /payout/.test(path) ? "confirm this payout action"
      : /uploads/.test(path) ? "upload this file" : "complete this request";
    throw new Error(userErrorMessage(error, action));
  }
}

export async function responseError(response: Response, action: string): Promise<Error & { status: number }> {
  const body = await response.json().catch(() => null);
  const error = { message: typeof body?.error === "string" ? body.error : "", status: response.status };
  return Object.assign(new Error(userErrorMessage(error, action)), { status: response.status });
}
