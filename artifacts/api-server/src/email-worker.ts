import { runScheduledEmailWork } from "./lib/email/scheduled-job.js";

// One finite durable work pass for an independently scheduled worker. This is
// not started by the web process and does not rely on an in-memory timer.
try {
  const result = await runScheduledEmailWork();
  console.log(JSON.stringify({ emailWork: result }));
  if (result.failed) process.exitCode = 1;
} catch {
  console.error("Scheduled email work failed; durable records were retained.");
  process.exitCode = 1;
}
