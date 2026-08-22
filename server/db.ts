import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  tasks,    Task,    InsertTask,
  subtasks, Subtask, InsertSubtask,
  toolLogs, ToolLog, InsertToolLog,
  messages, Message, InsertMessage,
  agentAutomations, agentMemories, agentApprovals,
  type InsertAgentAutomation, type InsertAgentMemory, type InsertAgentApproval,
} from "../drizzle/schema";
import { ENV } from './_core/env';

// ── MySQL connection (optional) ──────────────────────────────────────────
let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (err) {
      console.warn("[Database] Failed to connect:", err);
      _db = null;
    }
  }
  return _db;
}

// ── In-memory store ──────────────────────────────────────────────────────
// Activates automatically when DATABASE_URL is not configured.
// Data lives for the lifetime of the server process (resets on redeploy).
let _mid = 10; // start IDs high so they don't conflict with future DB rows
const nid = () => ++_mid;
const now = () => new Date();

type MemAuto   = { id: number; userId: number; name: string; prompt: string; cronSchedule: string; enabled: number; createdAt: Date };
type MemMemory = { id: number; userId: number; category: string; key: string; value: string; createdAt: Date };
type MemApproval = { id: number; taskId: number; actionDescription: string; status: "pending"|"approved"|"rejected"; createdAt: Date };

const mem = {
  tasks:       [] as Task[],
  messages:    [] as Message[],
  subtasks:    [] as Subtask[],
  toolLogs:    [] as ToolLog[],
  automations: [] as MemAuto[],
  memories:    [] as MemMemory[],
  approvals:   [] as MemApproval[],
};

// ── User helpers ─────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) { console.warn("[DB] upsertUser skipped — no database"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(f => {
    const v = user[f];
    if (v === undefined) return;
    values[f] = v ?? null;
    updateSet[f] = v ?? null;
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ── Task helpers ─────────────────────────────────────────────────────────
export async function createTask(data: InsertTask): Promise<number> {
  const db = await getDb();
  if (db) { const [r] = await db.insert(tasks).values(data); return r.insertId; }
  const id = nid();
  mem.tasks.push({ id, userId: data.userId, title: data.title, prompt: data.prompt,
    phase: data.phase ?? "planning", status: data.status ?? "active",
    summary: null, createdAt: now(), updatedAt: now() });
  return id;
}

export async function getTaskById(id: number): Promise<Task | undefined> {
  const db = await getDb();
  if (db) { const [t] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1); return t; }
  return mem.tasks.find(t => t.id === id);
}

export async function getTasksByUserId(userId: number): Promise<Task[]> {
  const db = await getDb();
  if (db) return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt));
  return [...mem.tasks].filter(t => t.userId === userId).sort((a,b) => b.createdAt.getTime()-a.createdAt.getTime());
}

export async function updateTaskPhase(id: number, phase: "planning"|"executing"|"reviewing"|"done", summary?: string) {
  const db = await getDb();
  if (db) {
    const data: Partial<Task> = { phase, updatedAt: now() };
    if (summary !== undefined) data.summary = summary;
    if (phase === 'done') data.status = 'completed';
    await db.update(tasks).set(data).where(eq(tasks.id, id));
    return;
  }
  const t = mem.tasks.find(t => t.id === id);
  if (t) { t.phase = phase; t.updatedAt = now(); if (summary !== undefined) t.summary = summary; if (phase==='done') t.status='completed'; }
}

export async function renameTask(id: number, title: string) {
  const db = await getDb();
  if (db) { await db.update(tasks).set({ title, updatedAt: now() }).where(eq(tasks.id, id)); return; }
  const t = mem.tasks.find(t => t.id === id);
  if (t) { t.title = title; t.updatedAt = now(); }
}

export async function deleteTaskById(id: number) {
  const db = await getDb();
  if (db) {
    await db.delete(messages).where(eq(messages.taskId, id));
    await db.delete(subtasks).where(eq(subtasks.taskId, id));
    await db.delete(toolLogs).where(eq(toolLogs.taskId, id));
    await db.delete(tasks).where(eq(tasks.id, id));
    return;
  }
  mem.messages  = mem.messages.filter(m => m.taskId !== id);
  mem.subtasks  = mem.subtasks.filter(s => s.taskId !== id);
  mem.toolLogs  = mem.toolLogs.filter(l => l.taskId !== id);
  mem.tasks     = mem.tasks.filter(t => t.id !== id);
}

export async function deleteAllTasksByUserId(userId: number) {
  const ownedTasks = await getTasksByUserId(userId);
  for (const t of ownedTasks) await deleteTaskById(t.id);
}

export async function clearMessagesByTaskId(taskId: number) {
  const db = await getDb();
  if (db) { await db.delete(messages).where(eq(messages.taskId, taskId)); return; }
  mem.messages = mem.messages.filter(m => m.taskId !== taskId);
}

// ── Subtask helpers ───────────────────────────────────────────────────────
export async function createSubtasks(items: InsertSubtask[]) {
  const db = await getDb();
  if (db) { if (items.length) await db.insert(subtasks).values(items); return; }
  items.forEach(s => mem.subtasks.push({ id: nid(), taskId: s.taskId, title: s.title,
    status: s.status ?? "pending", orderIndex: s.orderIndex ?? 0, result: null, createdAt: now() }));
}

export async function getSubtasksByTaskId(taskId: number): Promise<Subtask[]> {
  const db = await getDb();
  if (db) return db.select().from(subtasks).where(eq(subtasks.taskId, taskId)).orderBy(subtasks.orderIndex);
  return mem.subtasks.filter(s => s.taskId === taskId).sort((a,b) => a.orderIndex-b.orderIndex);
}

export async function updateSubtaskStatus(id: number, status: "pending"|"in_progress"|"completed"|"failed", result?: string) {
  const db = await getDb();
  if (db) {
    const data: Partial<Subtask> = { status };
    if (result !== undefined) data.result = result;
    await db.update(subtasks).set(data).where(eq(subtasks.id, id));
    return;
  }
  const s = mem.subtasks.find(s => s.id === id);
  if (s) { s.status = status; if (result !== undefined) s.result = result; }
}

// ── Tool log helpers ──────────────────────────────────────────────────────
export async function createToolLog(data: InsertToolLog): Promise<number> {
  const db = await getDb();
  if (db) { const [r] = await db.insert(toolLogs).values(data); return r.insertId; }
  const id = nid();
  mem.toolLogs.push({ id, taskId: data.taskId, toolName: data.toolName,
    inputArgs: data.inputArgs ?? null, outputResult: null,
    status: data.status ?? "running", createdAt: now() });
  return id;
}

export async function updateToolLog(id: number, outputResult: string, status: "success"|"error") {
  const db = await getDb();
  if (db) { await db.update(toolLogs).set({ outputResult, status }).where(eq(toolLogs.id, id)); return; }
  const l = mem.toolLogs.find(l => l.id === id);
  if (l) { l.outputResult = outputResult; l.status = status; }
}

export async function getToolLogsByTaskId(taskId: number): Promise<ToolLog[]> {
  const db = await getDb();
  if (db) return db.select().from(toolLogs).where(eq(toolLogs.taskId, taskId)).orderBy(toolLogs.createdAt);
  return mem.toolLogs.filter(l => l.taskId === taskId);
}

// ── Message helpers ───────────────────────────────────────────────────────
export async function createMessage(data: InsertMessage): Promise<number> {
  const db = await getDb();
  if (db) { const [r] = await db.insert(messages).values(data); return r.insertId; }
  const id = nid();
  mem.messages.push({ id, taskId: data.taskId, role: data.role,
    content: data.content, createdAt: now() });
  return id;
}

export async function getMessagesByTaskId(taskId: number): Promise<Message[]> {
  const db = await getDb();
  if (db) return db.select().from(messages).where(eq(messages.taskId, taskId)).orderBy(messages.createdAt);
  return mem.messages.filter(m => m.taskId === taskId);
}

// ── Automation helpers ────────────────────────────────────────────────────
export async function createAutomation(data: InsertAgentAutomation) {
  const db = await getDb();
  if (db) { const [r] = await db.insert(agentAutomations).values(data); return r.insertId; }
  const id = nid();
  mem.automations.push({ id, userId: data.userId, name: data.name, prompt: data.prompt,
    cronSchedule: data.cronSchedule ?? "0 */12 * * *", enabled: data.enabled ?? 1, createdAt: now() });
  return id;
}

export async function listAutomations(userId: number) {
  const db = await getDb();
  if (db) return db.select().from(agentAutomations).where(eq(agentAutomations.userId, userId));
  return mem.automations.filter(a => a.userId === userId);
}

export async function deleteAutomation(id: number, userId: number) {
  const db = await getDb();
  if (db) { await db.delete(agentAutomations).where(and(eq(agentAutomations.id, id), eq(agentAutomations.userId, userId))); return; }
  mem.automations = mem.automations.filter(a => !(a.id === id && a.userId === userId));
}

// ── Memory helpers ────────────────────────────────────────────────────────
export async function setMemory(data: InsertAgentMemory) {
  const db = await getDb();
  if (db) { await db.insert(agentMemories).values(data).onDuplicateKeyUpdate({ set: { value: data.value } }); return; }
  const existing = mem.memories.find(m => m.userId === data.userId && m.key === data.key);
  if (existing) { existing.value = data.value; }
  else { mem.memories.push({ id: nid(), userId: data.userId, category: data.category ?? "preference",
    key: data.key, value: data.value, createdAt: now() }); }
}

export async function listMemories(userId: number) {
  const db = await getDb();
  if (db) return db.select().from(agentMemories).where(eq(agentMemories.userId, userId));
  return mem.memories.filter(m => m.userId === userId);
}

// ── Approval helpers ──────────────────────────────────────────────────────
export async function createApproval(data: InsertAgentApproval) {
  const db = await getDb();
  if (db) { const [r] = await db.insert(agentApprovals).values(data); return r.insertId; }
  const id = nid();
  mem.approvals.push({ id, taskId: data.taskId, actionDescription: data.actionDescription ?? "",
    status: "pending", createdAt: now() });
  return id;
}

export async function getApprovalsByTask(taskId: number) {
  const db = await getDb();
  if (db) return db.select().from(agentApprovals).where(eq(agentApprovals.taskId, taskId));
  return mem.approvals.filter(a => a.taskId === taskId);
}

export async function updateApprovalStatus(id: number, status: "approved"|"rejected") {
  const db = await getDb();
  if (db) { await db.update(agentApprovals).set({ status }).where(eq(agentApprovals.id, id)); return; }
  const a = mem.approvals.find(a => a.id === id);
  if (a) a.status = status;
}
