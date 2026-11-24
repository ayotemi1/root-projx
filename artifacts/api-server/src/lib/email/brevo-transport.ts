import { EmailTransportError, type EmailTransport } from "./delivery.ts";
import { brevoSendRecordedEmail } from "../brevo.ts";

export const brevoEmailTransport: EmailTransport = {
  async send({ to, message }) {
    try {
      return await brevoSendRecordedEmail({
        to: [{ email: to }], subject: message.subject,
        htmlContent: message.htmlContent, textContent: message.textContent,
      });
    } catch (error) {
      // Only an explicit rate-limit rejection is automatically retried.
      // Neither HTTP 5xx nor network failures establish that no send happened.
      const status = error && typeof error === "object" && "brevoStatus" in error
        ? (error as { brevoStatus: number }).brevoStatus : null;
      throw new EmailTransportError(status === 429 ? "retryable"
        : status !== null && status >= 400 && status < 500 ? "rejected" : "uncertain", status);
    }
  },
};
