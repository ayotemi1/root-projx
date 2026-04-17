import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organisationsTable } from "./organisations";

export const resourcesTable = pgTable("resources", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organisationsTable.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertResourceSchema = createInsertSchema(resourcesTable).omit({
  id: true,
  createdAt: true,
});

export const selectResourceSchema = createSelectSchema(resourcesTable);

export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Resource = typeof resourcesTable.$inferSelect;
