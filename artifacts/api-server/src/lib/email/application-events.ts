import { fsGet, getServerToken } from "../firebase-rest.ts";
import { EMAIL_SITE_URL } from "./templates.ts";
import { emailConfiguration, emailDate, firstName, submitTemplateEmail } from "./service.ts";
import { recordAndFulfilEmail } from "./obligations.ts";

export async function deliverApplicationEmails(id: string, app: Record<string, unknown>, transition: "received" | "approved" | "declined" | "waiting") {
  if (typeof app.email !== "string") throw new Error("Application has no delivery identity.");
  const common = { first_name: firstName(app.contactName), org_name: String(app.orgName) };
  const event = `application:${id}:${transition}:${String(app.emailDecisionId ?? "initial")}`;
  if (transition === "received") {
    await submitTemplateEmail(event, "07-org-application-received", app.email, { ...common, signin_url: `${EMAIL_SITE_URL}/login` });
    const { adminRecipient } = await emailConfiguration();
    await submitTemplateEmail(event, "16-admin-new-application", adminRecipient, {
      org_name: String(app.orgName), contact_name: String(app.contactName), contact_email: app.email,
      country: String(app.country ?? "Not supplied"), sectors: Array.isArray(app.sectors) ? app.sectors.join(", ") : "",
      website: typeof app.website === "string" && app.website ? app.website : "Not supplied",
      submitted_date: emailDate(String(app.createdAt)), admin_application_url: `${EMAIL_SITE_URL}/admin`,
    });
  } else if (transition === "approved") {
    await submitTemplateEmail(event, "08-org-application-approved", app.email,
      { ...common, dashboard_url: `${EMAIL_SITE_URL}/dashboard` });
  } else if (transition === "declined") {
    await submitTemplateEmail(event, "09-org-application-declined", app.email,
      { ...common, decline_reason: String(app.reason), reapply_date: emailDate(String(app.reapplyDate)) });
  } else {
    await submitTemplateEmail(event, "10-org-application-more-info", app.email,
      { ...common, info_request: String(app.infoRequest), application_url: `${EMAIL_SITE_URL}/application` });
  }
}
export async function applicationEmails(id: string, app: Record<string, unknown>, transition: "received" | "approved" | "declined" | "waiting", defer = true) {
  await recordAndFulfilEmail(`${id}:${transition}:${String(app.emailDecisionId ?? "initial")}`,
    transition === "received" ? "application-received" : "application-decision", { id, app, transition }, defer);
  const { fsPatch } = await import("../firebase-rest.ts");
  await fsPatch("org_applications", id,
    transition === "received" ? { emailReceivedPending: false } : { emailDecisionPending: false }, await getServerToken());
}
export async function currentOwnApplication(userId: string) {
  const { fsQuery } = await import("../firebase-rest.ts");
  const rows = await fsQuery("org_applications", [{ field: "uid", op: "EQUAL", value: userId }], await getServerToken());
  const row = rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  return row ?? null;
}
export function applicationView(row: Record<string, unknown>) {
  return { id: String(row._id), orgName: String(row.orgName), status: String(row.status),
    infoRequest: typeof row.infoRequest === "string" ? row.infoRequest : "",
    response: typeof row.response === "string" ? row.response : "" };
}
