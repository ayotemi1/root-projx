import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const organisationsTable = pgTable("organisations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  orgName: text("org_name").notNull(),
  mission: text("mission"),
  location: text("location"),
  country: text("country").notNull().default("Jamaica"),
  causeCategory: text("cause_category"),
  goalAmount: numeric("goal_amount", { precision: 12, scale: 2 }).default("0"),
  raisedAmount: numeric("raised_amount", { precision: 12, scale: 2 }).default("0"),
  distributedAmount: numeric("distributed_amount", { precision: 12, scale: 2 }).default("0"),
  donorCount: integer("donor_count").default(0),
  followerCount: integer("follower_count").default(0),
  verified: boolean("verified").default(false),
  helpOptedIn: boolean("help_opted_in").default(false),
  helpServices: text("help_services").array(),
  responseCommitment: text("response_commitment"),
  whatsappNumber: text("whatsapp_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrganisationSchema = createInsertSchema(organisationsTable).omit({
  id: true,
  createdAt: true,
});

export const selectOrganisationSchema = createSelectSchema(organisationsTable);

export type InsertOrganisation = z.infer<typeof insertOrganisationSchema>;
export type Organisation = typeof organisationsTable.$inferSelect;
