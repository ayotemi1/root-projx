import {
  pgTable,
  serial,
  integer,
  numeric,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { organisationsTable } from "./organisations";

export const donationTypeEnum = pgEnum("donation_type", [
  "one-time",
  "recurring",
]);

export const donationProcessorEnum = pgEnum("donation_processor", [
  "stripe",
  "paypal",
]);

export const donationStatusEnum = pgEnum("donation_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const donationsTable = pgTable("donations", {
  id: serial("id").primaryKey(),
  supporterId: integer("supporter_id").references(() => usersTable.id),
  orgId: integer("org_id").references(() => organisationsTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("GBP"),
  type: donationTypeEnum("type").notNull().default("one-time"),
  processor: donationProcessorEnum("processor").notNull().default("stripe"),
  platformFee: numeric("platform_fee", { precision: 10, scale: 2 }),
  status: donationStatusEnum("status").notNull().default("pending"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDonationSchema = createInsertSchema(donationsTable).omit({
  id: true,
  createdAt: true,
});

export const selectDonationSchema = createSelectSchema(donationsTable);

export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type Donation = typeof donationsTable.$inferSelect;
