import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, longtext } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  prompt: longtext("prompt").notNull(),
  phase: mysqlEnum("phase", ["planning", "executing", "reviewing", "done"]).default("planning").notNull(),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  summary: longtext("summary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

export const subtasks = mysqlTable("subtasks", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "failed"]).default("pending").notNull(),
  orderIndex: int("orderIndex").default(0).notNull(),
  result: longtext("result"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Subtask = typeof subtasks.$inferSelect;
export type InsertSubtask = typeof subtasks.$inferInsert;

export const toolLogs = mysqlTable("tool_logs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  toolName: varchar("toolName", { length: 100 }).notNull(),
  inputArgs: longtext("inputArgs"),
  outputResult: longtext("outputResult"),
  status: mysqlEnum("status", ["running", "success", "error"]).default("running").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ToolLog = typeof toolLogs.$inferSelect;
export type InsertToolLog = typeof toolLogs.$inferInsert;

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system", "tool"]).notNull(),
  content: longtext("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export const agentAutomations = mysqlTable("agent_automations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  prompt: longtext("prompt").notNull(),
  cronSchedule: varchar("cronSchedule", { length: 64 }),
  enabled: int("enabled").default(1).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

export type AgentAutomation = typeof agentAutomations.$inferSelect;
export type InsertAgentAutomation = typeof agentAutomations.$inferInsert;

export const agentMemories = mysqlTable("agent_memories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  key: varchar("key", { length: 255 }).notNull(),
  value: longtext("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

export type AgentMemory = typeof agentMemories.$inferSelect;
export type InsertAgentMemory = typeof agentMemories.$inferInsert;

export const agentApprovals = mysqlTable("agent_approvals", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  actionDescription: longtext("actionDescription").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

export type AgentApproval = typeof agentApprovals.$inferSelect;
export type InsertAgentApproval = typeof agentApprovals.$inferInsert;
