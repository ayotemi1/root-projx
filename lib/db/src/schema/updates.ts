import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organisationsTable } from "./organisations";

export const updateTagEnum = pgEnum("update_tag", [
  "Before",
  "During",
  "After",
]);

export const updatesTable = pgTable("updates", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organisationsTable.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  tag: updateTagEnum("tag").notNull().default("During"),
  mediaUrls: text("media_urls").array(),
  sentToCount: integer("sent_to_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUpdateSchema = createInsertSchema(updatesTable).omit({
  id: true,
  createdAt: true,
});

export const selectUpdateSchema = createSelectSchema(updatesTable);

export type InsertUpdate = z.infer<typeof insertUpdateSchema>;
export type Update = typeof updatesTable.$inferSelect;
