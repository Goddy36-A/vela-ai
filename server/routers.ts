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

        // Add initial user message
        await db.createMessage({
          taskId,
          role: "user",
          content: input.prompt
        });

        // Trigger agent background execution asynchronously
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

        return {
          task,
          subtasks,
          toolLogs,
          messages
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
    })
  })
});

export type AppRouter = typeof appRouter;
