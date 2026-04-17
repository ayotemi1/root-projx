import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organisationsTable } from "./organisations";

export const helpReviewsTable = pgTable("help_reviews", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organisationsTable.id),
  reviewerSession: text("reviewer_session"),
  reviewerName: text("reviewer_name"),
  rating: integer("rating").notNull(),
  body: text("body"),
  verifiedRecipient: boolean("verified_recipient").default(false),
  flagged: boolean("flagged").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHelpReviewSchema = createInsertSchema(helpReviewsTable).omit({
  id: true,
  createdAt: true,
});

export const selectHelpReviewSchema = createSelectSchema(helpReviewsTable);

export type InsertHelpReview = z.infer<typeof insertHelpReviewSchema>;
export type HelpReview = typeof helpReviewsTable.$inferSelect;
