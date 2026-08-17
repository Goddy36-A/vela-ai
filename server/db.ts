import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, tasks, subtasks, toolLogs, messages, Task, Subtask, ToolLog, Message, InsertTask, InsertSubtask, InsertToolLog, InsertMessage } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Task Helpers
export async function createTask(data: InsertTask): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [res] = await db.insert(tasks).values(data);
  return res.insertId;
}

export async function getTaskById(id: number): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return task;
}

export async function getTasksByUserId(userId: number): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt));
}

export async function updateTaskPhase(id: number, phase: "planning" | "executing" | "reviewing" | "done", summary?: string) {
  const db = await getDb();
  if (!db) return;
  const updateData: Partial<Task> = { phase, updatedAt: new Date() };
  if (summary !== undefined) updateData.summary = summary;
  if (phase === 'done') updateData.status = 'completed';
  await db.update(tasks).set(updateData).where(eq(tasks.id, id));
}

// Subtask Helpers
export async function createSubtasks(items: InsertSubtask[]) {
  const db = await getDb();
  if (!db || items.length === 0) return;
  await db.insert(subtasks).values(items);
}

export async function getSubtasksByTaskId(taskId: number): Promise<Subtask[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(subtasks).where(eq(subtasks.taskId, taskId)).orderBy(subtasks.orderIndex);
}

export async function updateSubtaskStatus(id: number, status: "pending" | "in_progress" | "completed" | "failed", result?: string) {
  const db = await getDb();
  if (!db) return;
  const data: Partial<Subtask> = { status };
  if (result !== undefined) data.result = result;
  await db.update(subtasks).set(data).where(eq(subtasks.id, id));
}

// Tool Log Helpers
export async function createToolLog(data: InsertToolLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [res] = await db.insert(toolLogs).values(data);
  return res.insertId;
}

export async function updateToolLog(id: number, outputResult: string, status: "success" | "error") {
  const db = await getDb();
  if (!db) return;
  await db.update(toolLogs).set({ outputResult, status }).where(eq(toolLogs.id, id));
}

export async function getToolLogsByTaskId(taskId: number): Promise<ToolLog[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(toolLogs).where(eq(toolLogs.taskId, taskId)).orderBy(toolLogs.createdAt);
}

// Message Helpers
export async function createMessage(data: InsertMessage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [res] = await db.insert(messages).values(data);
  return res.insertId;
}

export async function getMessagesByTaskId(taskId: number): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(messages).where(eq(messages.taskId, taskId)).orderBy(messages.createdAt);
}

export async function renameTask(id: number, title: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set({ title, updatedAt: new Date() }).where(eq(tasks.id, id));
}

export async function deleteTaskById(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(messages).where(eq(messages.taskId, id));
  await db.delete(subtasks).where(eq(subtasks.taskId, id));
  await db.delete(toolLogs).where(eq(toolLogs.taskId, id));
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function deleteAllTasksByUserId(userId: number) {
  const ownedTasks = await getTasksByUserId(userId);
  for (const task of ownedTasks) {
    await deleteTaskById(task.id);
  }
}

export async function clearMessagesByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(messages).where(eq(messages.taskId, taskId));
}

import { agentAutomations, agentMemories, agentApprovals, type InsertAgentAutomation, type InsertAgentMemory, type InsertAgentApproval } from "../drizzle/schema";

export async function createAutomation(data: InsertAgentAutomation) {
  const db = await getDb();
  if (!db) return null;
  const [res] = await db.insert(agentAutomations).values(data);
  return res.insertId;
}

export async function listAutomations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentAutomations).where(eq(agentAutomations.userId, userId));
}

export async function deleteAutomation(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(agentAutomations).where(and(eq(agentAutomations.id, id), eq(agentAutomations.userId, userId)));
}

export async function setMemory(data: InsertAgentMemory) {
  const db = await getDb();
  if (!db) return;
  await db.insert(agentMemories).values(data).onDuplicateKeyUpdate({ set: { value: data.value } });
}

export async function listMemories(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentMemories).where(eq(agentMemories.userId, userId));
}

export async function createApproval(data: InsertAgentApproval) {
  const db = await getDb();
  if (!db) return null;
  const [res] = await db.insert(agentApprovals).values(data);
  return res.insertId;
}

export async function getApprovalsByTask(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentApprovals).where(eq(agentApprovals.taskId, taskId));
}

export async function updateApprovalStatus(id: number, status: "approved" | "rejected") {
  const db = await getDb();
  if (!db) return;
  await db.update(agentApprovals).set({ status }).where(eq(agentApprovals.id, id));
}
