import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { organisationsTable } from "./organisations";

export const followsTable = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    supporterId: integer("supporter_id").references(() => usersTable.id),
    orgId: integer("org_id").references(() => organisationsTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("unique_follow").on(t.supporterId, t.orgId)],
);

export const insertFollowSchema = createInsertSchema(followsTable).omit({
  id: true,
  createdAt: true,
});

export const selectFollowSchema = createSelectSchema(followsTable);

export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof followsTable.$inferSelect;
