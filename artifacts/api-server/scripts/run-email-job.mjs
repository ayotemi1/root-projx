// Run in a SEPARATE scheduled caller, not instead of the main website.
// Store the owner-generated, email-only job key in that caller's Secrets.
const key = process.env.ROOTPROJX_EMAIL_JOB_KEY;
if (!key || !/^[A-Za-z0-9_-]{43}$/.test(key)) throw new Error("Configure the email-only scheduled-job key.");
const response = await fetch("https://rootprojx.com/api/email/jobs/run", {
  method: "POST", headers: { "x-email-job-key": key },
  signal: AbortSignal.timeout(240_000),
});
if (!response.ok) {
  await response.body?.cancel();
  throw new Error(`Scheduled email work failed (${response.status}); inspect the private dashboard.`);
}
const result = await response.json();
console.log(JSON.stringify({ processed: result.processed, failed: result.failed }));
if (result.failed) process.exitCode = 1;
