import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// Defence in depth for structured logs, even if a caller logs a request body.
// Strings interpolated into log messages cannot be field-redacted: never do so.
export const BANK_LOG_FIELDS = [
  "accountNumber", "iban", "routingCode", "swiftBic", "accountHolder", "bankName",
  "beneficiaryAddress", "bankAddress", "branchName",
];
export const LOG_REDACTION_PATHS = [
  "req.headers.authorization", "req.headers.cookie", "req.headers['x-admin-token']",
  "req.headers['x-admin-secret']", "res.headers['set-cookie']",
  ...BANK_LOG_FIELDS.flatMap(field => [
    field, `*.${field}`, `*.*.${field}`, `*.*.*.${field}`, `*.*.*.*.${field}`,
  ]),
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: LOG_REDACTION_PATHS,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
