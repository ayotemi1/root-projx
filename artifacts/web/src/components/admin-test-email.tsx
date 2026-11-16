import { appFetch as fetch, userErrorMessage } from "@/lib/error-feedback";
import { useState } from "react";

export function AdminTestEmail({ token, onUnauthorized }: {
  token: string;
  onUnauthorized: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function send() {
    if (sending) return;
    setSending(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/admin/email/test`, {
        method: "POST", headers: { "x-admin-token": token },
      });
      const data = await response.json();
      if (response.status === 401) { onUnauthorized(); return; }
      if (!response.ok) throw new Error(data.error || "The test email could not be sent.");
      if (data.accepted !== true) throw new Error("The server did not confirm email acceptance.");
      setNotice(`Brevo accepted the test for ${data.recipient} from the ${data.environment} server. Check the inbox, spam folder and Brevo Transactional Logs; acceptance is not proof of inbox delivery.`);
    } catch (err) {
      setError(userErrorMessage(err, "confirm this email was sent") + " Check Brevo delivery logs before sending another test.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-label="Email delivery test" className="mb-6 rounded-xl border border-[#E0D8CC] bg-[#F9F6F0] p-4">
      <h2 className="font-bold text-lg">Email delivery test</h2>
      <p className="text-sm my-2">Send one labelled email to the Root ProjX team address. No donation or charge is created. Use this on rootprojx.com to check the live server; preview tests the development server.</p>
      <button type="button" onClick={send} disabled={sending}
        className="rounded-md bg-[#B50000] px-4 py-2 text-white font-bold disabled:opacity-50">
        {sending ? "Sending test email…" : "Send test email"}
      </button>
      <p className="text-sm mt-2">Limited to one attempt per minute per server instance.</p>
      {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-[#B50000]">{error}</p>}
    </section>
  );
}
