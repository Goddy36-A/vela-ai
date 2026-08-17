import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { runAgentTask } from "./agent";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  agent: router({
    createTask: protectedProcedure
      .input(z.object({ prompt: z.string().min(1, "Prompt cannot be empty") }))
      .mutation(async ({ ctx, input }) => {
        const title = input.prompt.length > 50 ? input.prompt.slice(0, 47) + "..." : input.prompt;
        const taskId = await db.createTask({
          userId: ctx.user.id,
          title,
          prompt: input.prompt,
          phase: "planning",
          status: "active"
        });

        await db.createMessage({
          taskId,
          role: "user",
          content: input.prompt
        });

        runAgentTask(taskId, input.prompt).catch(err => {
          console.error("Background agent execution error:", err);
        });

        return { taskId };
      }),

    listTasks: protectedProcedure.query(async ({ ctx }) => {
      return await db.getTasksByUserId(ctx.user.id);
    }),

    getTaskDetails: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId);
        if (!task || task.userId !== ctx.user.id) {
          throw new Error("Task not found or unauthorized");
        }
        const subtasks = await db.getSubtasksByTaskId(input.taskId);
        const toolLogs = await db.getToolLogsByTaskId(input.taskId);
        const messages = await db.getMessagesByTaskId(input.taskId);
        const approvals = await db.getApprovalsByTask(input.taskId);

        return {
          task,
          subtasks,
          toolLogs,
          messages,
          approvals
        };
      }),

    renameTask: protectedProcedure
      .input(z.object({ taskId: z.number(), title: z.string().trim().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId);
        if (!task || task.userId !== ctx.user.id) throw new Error("Task not found or unauthorized");
        await db.renameTask(input.taskId, input.title);
        return { success: true as const };
      }),

    deleteTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId);
        if (!task || task.userId !== ctx.user.id) throw new Error("Task not found or unauthorized");
        await db.deleteTaskById(input.taskId);
        return { success: true as const };
      }),

    clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
      await db.deleteAllTasksByUserId(ctx.user.id);
      return { success: true as const };
    }),

    // 2050 Automation, Memory, & Approvals Routers
    listAutomations: protectedProcedure.query(async ({ ctx }) => {
      return await db.listAutomations(ctx.user.id);
    }),

    createAutomation: protectedProcedure
      .input(z.object({ name: z.string().min(1), prompt: z.string().min(1), cronSchedule: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createAutomation({
          userId: ctx.user.id,
          name: input.name,
          prompt: input.prompt,
          cronSchedule: input.cronSchedule || "0 */12 * * *",
          enabled: 1
        });
        return { id };
      }),

    deleteAutomation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteAutomation(input.id, ctx.user.id);
        return { success: true as const };
      }),

    listMemories: protectedProcedure.query(async ({ ctx }) => {
      return await db.listMemories(ctx.user.id);
    }),

    setMemory: protectedProcedure
      .input(z.object({ category: z.string(), key: z.string(), value: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.setMemory({
          userId: ctx.user.id,
          category: input.category,
          key: input.key,
          value: input.value
        });
        return { success: true as const };
      }),

    resolveApproval: protectedProcedure
      .input(z.object({ approvalId: z.number(), status: z.enum(["approved", "rejected"]) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateApprovalStatus(input.approvalId, input.status);
        return { success: true as const };
      })
  })
});

export type AppRouter = typeof appRouter;
