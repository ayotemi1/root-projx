import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organisationsTable } from "./organisations";

export const contactChannelEnum = pgEnum("contact_channel", [
  "whatsapp",
  "email",
]);

export const contactEventsTable = pgTable("contact_events", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id"),
  orgId: integer("org_id").references(() => organisationsTable.id),
  needCategory: text("need_category"),
  channel: contactChannelEnum("channel").notNull().default("whatsapp"),
  reviewLeft: boolean("review_left").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactEventSchema = createInsertSchema(contactEventsTable).omit({
  id: true,
  createdAt: true,
});

export const selectContactEventSchema = createSelectSchema(contactEventsTable);

export type InsertContactEvent = z.infer<typeof insertContactEventSchema>;
export type ContactEvent = typeof contactEventsTable.$inferSelect;
