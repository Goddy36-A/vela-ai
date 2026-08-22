import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Send, Plus, Settings, PanelLeftClose, PanelLeft,
  ChevronDown, MoreHorizontal, Pencil, Trash2, RotateCcw,
  Terminal, Zap, Database, ShieldCheck, BrainCircuit,
  Cpu, CheckCircle2, WifiOff,
} from "lucide-react";
import { AssistantMessage } from "@/components/AssistantMessage";
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Platform user — authentication removed ──────────────────────────────
const PLATFORM_USER = {
  name: "Godfrey Atwijukire",
  email: "admin@velaai.platform",
};

// ── Design tokens ───────────────────────────────────────────────────────
const C = {
  navy:     "#0F172A",
  navyMid:  "#1E293B",
  navyLt:   "#334155",
  blue:     "#1D4ED8",
  blueDk:   "#1E40AF",
  bluePale: "#EFF6FF",
  s50:      "#F8FAFC",
  s100:     "#F1F5F9",
  s200:     "#E2E8F0",
  s300:     "#CBD5E1",
  s400:     "#94A3B8",
  s500:     "#64748B",
  s700:     "#334155",
  white:    "#FFFFFF",
  green50:  "#ECFDF5",
  green700: "#047857",
  amber50:  "#FFFBEB",
  amber200: "#FCD34D",
  amber800: "#92400E",
  red50:    "#FEF2F2",
  red400:   "#F87171",
  red600:   "#DC2626",
};

// ── Helpers ─────────────────────────────────────────────────────────────
function phaseStyle(phase: string, active: boolean) {
  if (!active) return { bg: "transparent", text: C.s400, border: "transparent" };
  const map: Record<string, { bg: string; text: string; border: string }> = {
    planning:  { bg: "#FFFBEB", text: "#B45309", border: "#FCD34D" },
    executing: { bg: C.bluePale, text: C.blue,   border: "#BFDBFE" },
    reviewing: { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" },
    done:      { bg: C.green50, text: C.green700, border: "#6EE7B7" },
  };
  return map[phase] ?? { bg: C.s100, text: C.s500, border: C.s200 };
}

function Pill({ label, color }: { label: string; color: "green" | "blue" | "amber" }) {
  const s = { green: { bg: C.green50, text: C.green700 }, blue: { bg: C.bluePale, text: C.blue }, amber: { bg: "#FFFBEB", text: "#B45309" } }[color];
  return <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ background: s.bg, color: s.text }}>{label}</span>;
}

// Error helper — tells user what went wrong clearly
function errMsg(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? "Unknown error";
  if (msg.includes("UNAUTHORIZED") || msg.includes("Unauthorized") || msg.includes("401"))
    return "Server session required. Make sure the backend is running and you are signed in.";
  if (msg.includes("INTERNAL_SERVER_ERROR") || msg.includes("500"))
    return "Server error — check the backend logs.";
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed to fetch"))
    return "Cannot reach the server. Is the backend running?";
  return msg;
}

// ════════════════════════════════════════════════════════════════════════
export default function Home() {
  const user = PLATFORM_USER;

  // Start with sidebar closed on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );
  const [viewMode, setViewMode] = useState<"chat" | "automations" | "memories" | "settings">("chat");
  const [promptInput, setPromptInput]   = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [logsOpen, setLogsOpen]         = useState(false);
  const [mgmtId, setMgmtId]             = useState<number | null>(null);
  const [autoName, setAutoName]         = useState("");
  const [autoPrompt, setAutoPrompt]     = useState("");
  const [memCategory, setMemCategory]   = useState("preference");
  const [memKey, setMemKey]             = useState("");
  const [memValue, setMemValue]         = useState("");

  const chatScrollRef  = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const utils          = trpc.useUtils();

  // ── Auto-resize textarea ─────────────────────────────────────────────
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, []);

  useEffect(() => { resizeTextarea(); }, [promptInput, resizeTextarea]);

  // ── Queries ──────────────────────────────────────────────────────────
  const tasksQuery = trpc.agent.listTasks.useQuery(undefined, {
    retry: false,
    refetchInterval: 2000,
    onError: (err) => {
      // Only surface once — don't spam toasts on every refetch
      if (err.message?.includes("UNAUTHORIZED")) return; // silent — expected without session
      console.error("[listTasks]", err);
    },
  } as Parameters<typeof trpc.agent.listTasks.useQuery>[1]);

  const taskDetailsQuery = trpc.agent.getTaskDetails.useQuery(
    { taskId: selectedTaskId! },
    {
      enabled: !!selectedTaskId,
      retry: false,
      refetchInterval: 1500,
    }
  );

  const automationsQuery = trpc.agent.listAutomations.useQuery(undefined, { retry: false });
  const memoriesQuery    = trpc.agent.listMemories.useQuery(undefined, { retry: false });

  // ── Mutations ────────────────────────────────────────────────────────
  const createTask = trpc.agent.createTask.useMutation({
    onSuccess: (d) => {
      setSelectedTaskId(d.taskId);
      setPromptInput("");
      setLogsOpen(false);
      utils.agent.listTasks.invalidate();
    },
    onError: (err) => {
      toast.error("Message not sent", {
        description: errMsg(err),
        duration: 6000,
      });
    },
  });

  const renameTask = trpc.agent.renameTask.useMutation({
    onSuccess: () => {
      setMgmtId(null);
      utils.agent.listTasks.invalidate();
      if (selectedTaskId) utils.agent.getTaskDetails.invalidate({ taskId: selectedTaskId });
    },
    onError: (err) => toast.error("Rename failed", { description: errMsg(err) }),
  });

  const deleteTask = trpc.agent.deleteTask.useMutation({
    onSuccess: (_, v) => {
      if (selectedTaskId === v.taskId) setSelectedTaskId(null);
      setMgmtId(null);
      utils.agent.listTasks.invalidate();
    },
    onError: (err) => toast.error("Delete failed", { description: errMsg(err) }),
  });

  const clearHistory = trpc.agent.clearHistory.useMutation({
    onSuccess: () => { setSelectedTaskId(null); setMgmtId(null); utils.agent.listTasks.invalidate(); },
    onError: (err) => toast.error("Clear failed", { description: errMsg(err) }),
  });

  const createAuto = trpc.agent.createAutomation.useMutation({
    onSuccess: () => { setAutoName(""); setAutoPrompt(""); utils.agent.listAutomations.invalidate(); },
    onError: (err) => toast.error("Failed to create automation", { description: errMsg(err) }),
  });

  const deleteAuto = trpc.agent.deleteAutomation.useMutation({
    onSuccess: () => utils.agent.listAutomations.invalidate(),
    onError: (err) => toast.error("Delete failed", { description: errMsg(err) }),
  });

  const setMemory = trpc.agent.setMemory.useMutation({
    onSuccess: () => { setMemKey(""); setMemValue(""); utils.agent.listMemories.invalidate(); },
    onError: (err) => toast.error("Save failed", { description: errMsg(err) }),
  });

  const resolveApproval = trpc.agent.resolveApproval.useMutation({
    onSuccess: () => { if (selectedTaskId) utils.agent.getTaskDetails.invalidate({ taskId: selectedTaskId }); },
    onError: (err) => toast.error("Approval action failed", { description: errMsg(err) }),
  });

  // ── Effects ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (tasksQuery.data?.length && !selectedTaskId) setSelectedTaskId(tasksQuery.data[0].id);
  }, [tasksQuery.data, selectedTaskId]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [taskDetailsQuery.data?.messages]);

  // Close context menu on outside click
  useEffect(() => {
    if (!mgmtId) return;
    const handler = () => setMgmtId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [mgmtId]);

  // ── Data ─────────────────────────────────────────────────────────────
  const currentTask      = taskDetailsQuery.data?.task;
  const subtasks         = taskDetailsQuery.data?.subtasks  ?? [];
  const toolLogs         = taskDetailsQuery.data?.toolLogs  ?? [];
  const messages         = taskDetailsQuery.data?.messages  ?? [];
  const pendingApprovals = (taskDetailsQuery.data?.approvals ?? []).filter(a => a.status === "pending");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (promptInput.trim()) createTask.mutate({ prompt: promptInput });
  };

  const closeSidebarOnMobile = () => { if (window.innerWidth < 768) setSidebarOpen(false); };

  // ── NAV ──────────────────────────────────────────────────────────────
  const bottomNav = [
    { id: "automations" as const, icon: Zap,      label: "Automations"  },
    { id: "memories"    as const, icon: Database,  label: "Memory Store" },
    { id: "settings"    as const, icon: Settings,  label: "Settings"     },
  ];

  const headerTitle = {
    chat:        currentTask?.title ?? "AI Agent",
    automations: "Scheduled Automations",
    memories:    "Memory Store",
    settings:    "Platform Settings",
  }[viewMode];

  // ════════════════════════════════════════════════════════════════════
  // Use 100svh — "small" viewport height that always excludes the
  // mobile browser chrome (address bar / tab bar).
  // Fallback: 100vh for browsers that don't support svh yet.
  // ════════════════════════════════════════════════════════════════════
  return (
    <div
      className="flex overflow-hidden"
      style={{ height: "100svh", background: C.s50 }}
    >
      {/* Mobile scrim */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <aside
        className={`fixed md:static z-50 h-full flex flex-col flex-shrink-0 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:hidden"
        }`}
        style={{ width: 256, background: C.navy }}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: `1px solid ${C.navyMid}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.blue }}>
              <Cpu className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-white tracking-tight">Vela AI</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: C.navyMid, color: C.s400 }}>
              Enterprise
            </span>
          </div>
          <button className="md:hidden p-1.5 rounded" style={{ color: C.s500 }} onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* New task */}
        <div className="px-3 pt-3 pb-1">
          <button
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded text-xs font-medium border transition-colors"
            style={{ color: C.s300, borderColor: C.navyMid, background: "transparent" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.navyMid}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            onClick={() => { setSelectedTaskId(null); setViewMode("chat"); closeSidebarOnMobile(); }}
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest px-2 py-2" style={{ color: C.navyLt }}>
            Recent Tasks
          </p>
          {tasksQuery.isError && (
            <div className="mx-2 my-1 flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded" style={{ background: "#1A0A00", color: C.red400 }}>
              <WifiOff className="w-3 h-3 flex-shrink-0" /> Backend unreachable
            </div>
          )}
          {tasksQuery.data?.map(t => {
            const active = selectedTaskId === t.id && viewMode === "chat";
            return (
              <div
                key={t.id}
                className="relative group flex items-center rounded"
                style={{ background: active ? C.blueDk : "transparent", borderLeft: `2px solid ${active ? "#3B82F6" : "transparent"}` }}
              >
                <button
                  className="min-w-0 flex-1 text-left px-2 py-2 text-xs truncate"
                  style={{ color: active ? C.white : C.s400 }}
                  onClick={() => { setSelectedTaskId(t.id); setViewMode("chat"); setMgmtId(null); closeSidebarOnMobile(); }}
                >
                  <span className="block truncate">{t.title}</span>
                  <span className="block mt-0.5 text-[10px] uppercase tracking-wide" style={{ color: active ? "#BFDBFE" : C.navyLt }}>{t.phase}</span>
                </button>
                <button
                  className="mr-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: C.s500 }}
                  onClick={(e) => { e.stopPropagation(); setMgmtId(mgmtId === t.id ? null : t.id); }}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
                {mgmtId === t.id && (
                  <div
                    className="absolute right-1 top-9 z-50 w-36 rounded shadow-xl overflow-hidden"
                    style={{ background: C.navyMid, border: `1px solid ${C.navyLt}` }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
                      style={{ color: C.s300 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.navyLt}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      onClick={() => { const title = window.prompt("Rename task", t.title)?.trim(); if (title && title !== t.title) renameTask.mutate({ taskId: t.id, title }); }}
                    >
                      <Pencil className="h-3 w-3" /> Rename
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
                      style={{ color: C.red400 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#450A0A"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      onClick={() => { if (window.confirm("Delete task? This cannot be undone.")) deleteTask.mutate({ taskId: t.id }); }}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {!tasksQuery.data?.length && !tasksQuery.isError && (
            <p className="px-2 py-3 text-xs" style={{ color: C.navyLt }}>No tasks yet.</p>
          )}
          {!!tasksQuery.data?.length && (
            <button
              className="mt-2 w-full flex items-center gap-2 px-2 py-2 text-xs rounded transition-colors"
              style={{ color: C.navyLt }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = C.red400}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = C.navyLt}
              onClick={() => { if (window.confirm("Clear all task history?")) clearHistory.mutate(); }}
            >
              <RotateCcw className="h-3 w-3" /> Clear history
            </button>
          )}
        </div>

        {/* Bottom nav + user */}
        <div className="flex-shrink-0 px-3 space-y-0.5" style={{ borderTop: `1px solid ${C.navyMid}`, paddingTop: 12, paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          {bottomNav.map(item => (
            <button
              key={item.id}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded text-xs transition-colors"
              style={{ background: viewMode === item.id ? C.blueDk : "transparent", color: viewMode === item.id ? C.white : C.s400 }}
              onClick={() => { setViewMode(item.id); closeSidebarOnMobile(); }}
            >
              <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
              {item.label}
            </button>
          ))}
          <div className="pt-3 mt-1 flex items-center gap-2.5 px-1" style={{ borderTop: `1px solid ${C.navyMid}` }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0" style={{ background: C.blue }}>
              {user.name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: "#F1F5F9" }}>{user.name}</p>
              <p className="text-[10px] truncate" style={{ color: C.navyLt }}>{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header
          className="h-14 flex items-center justify-between px-4 flex-shrink-0 bg-white"
          style={{ borderBottom: `1px solid ${C.s200}` }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button className="p-1.5 rounded transition-colors" style={{ color: C.s500 }} onClick={() => setSidebarOpen(o => !o)}>
              <PanelLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate" style={{ color: C.navy }}>{headerTitle}</h1>
              {viewMode === "chat" && currentTask && (
                <p className="text-[11px] hidden sm:block" style={{ color: C.s400 }}>Task #{selectedTaskId}</p>
              )}
            </div>
          </div>
          {viewMode === "chat" && currentTask && (
            <div className="hidden md:flex items-center gap-1 flex-shrink-0">
              {(["planning", "executing", "reviewing", "done"] as const).map(p => {
                const s = phaseStyle(p, currentTask.phase === p);
                return (
                  <span key={p} className="text-[10px] uppercase font-medium px-2 py-0.5 rounded border"
                    style={{ background: s.bg, color: s.text, borderColor: s.border }}>
                    {p}
                  </span>
                );
              })}
            </div>
          )}
        </header>

        {/* ── AUTOMATIONS ─────────────────────────────────────────── */}
        {viewMode === "automations" && (
          <ScrollArea className="flex-1 p-4 sm:p-6">
            <div className="max-w-2xl mx-auto space-y-5">
              <div>
                <h2 className="text-base font-semibold" style={{ color: C.navy }}>Scheduled Automations</h2>
                <p className="text-xs mt-0.5" style={{ color: C.s500 }}>Configure recurring agent tasks and cron-based background workflows.</p>
              </div>
              <div className="bg-white rounded-lg p-5 space-y-4" style={{ border: `1px solid ${C.s200}` }}>
                <h3 className="text-sm font-semibold" style={{ color: C.navy }}>Create Automation</h3>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>Name</label>
                  <input type="text" value={autoName} onChange={e => setAutoName(e.target.value)}
                    placeholder="e.g. Daily Security Audit"
                    className="w-full rounded border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: C.s200, background: C.s50, color: C.navy }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>Agent Prompt</label>
                  <textarea value={autoPrompt} onChange={e => setAutoPrompt(e.target.value)}
                    placeholder="Describe what the agent should execute on schedule..."
                    className="w-full rounded border px-3 py-2.5 text-sm focus:outline-none resize-none h-20"
                    style={{ borderColor: C.s200, background: C.s50, color: C.navy }} />
                </div>
                <button
                  onClick={() => { if (autoName && autoPrompt) createAuto.mutate({ name: autoName, prompt: autoPrompt }); }}
                  disabled={createAuto.isPending || !autoName || !autoPrompt}
                  className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: C.blue }}
                >
                  {createAuto.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Schedule Automation
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.s500 }}>
                  Active ({automationsQuery.data?.length ?? 0})
                </p>
                {automationsQuery.data?.length ? automationsQuery.data.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-white rounded-lg p-4" style={{ border: `1px solid ${C.s200}` }}>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold" style={{ color: C.navy }}>{a.name}</h4>
                      <p className="text-xs mt-0.5 truncate" style={{ color: C.s500 }}>{a.prompt}</p>
                      <span className="inline-block mt-1.5 font-mono text-[10px] px-2 py-0.5 rounded" style={{ background: C.bluePale, color: C.blue }}>
                        {a.cronSchedule ?? "0 */12 * * *"}
                      </span>
                    </div>
                    <button className="ml-4 p-1.5 rounded" style={{ color: C.red400 }} onClick={() => deleteAuto.mutate({ id: a.id })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )) : (
                  <div className="text-center py-12 bg-white rounded-lg" style={{ border: `1px solid ${C.s200}` }}>
                    <Zap className="w-8 h-8 mx-auto mb-2" style={{ color: C.s300 }} />
                    <p className="text-xs" style={{ color: C.s400 }}>No automations configured.</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}

        {/* ── MEMORIES ────────────────────────────────────────────── */}
        {viewMode === "memories" && (
          <ScrollArea className="flex-1 p-4 sm:p-6">
            <div className="max-w-2xl mx-auto space-y-5">
              <div>
                <h2 className="text-base font-semibold" style={{ color: C.navy }}>Memory Store</h2>
                <p className="text-xs mt-0.5" style={{ color: C.s500 }}>Persistent agent memory for preferences, coding standards, and API endpoints.</p>
              </div>
              <div className="bg-white rounded-lg p-5 space-y-4" style={{ border: `1px solid ${C.s200}` }}>
                <h3 className="text-sm font-semibold" style={{ color: C.navy }}>Add Memory Item</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>Category</label>
                    <select value={memCategory} onChange={e => setMemCategory(e.target.value)}
                      className="w-full rounded border px-3 py-2.5 text-sm focus:outline-none"
                      style={{ borderColor: C.s200, background: C.s50, color: C.navy }}>
                      <option value="preference">Preference</option>
                      <option value="coding_style">Coding Style</option>
                      <option value="endpoint">Endpoint / Config</option>
                      <option value="goal">Goal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>Key</label>
                    <input type="text" value={memKey} onChange={e => setMemKey(e.target.value)}
                      placeholder="e.g. preferred_language"
                      className="w-full rounded border px-3 py-2.5 text-sm focus:outline-none"
                      style={{ borderColor: C.s200, background: C.s50, color: C.navy }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>Value</label>
                  <textarea value={memValue} onChange={e => setMemValue(e.target.value)}
                    placeholder="e.g. TypeScript 5.9, strict null checks, Tailwind v4."
                    className="w-full rounded border px-3 py-2.5 text-sm focus:outline-none resize-none h-20"
                    style={{ borderColor: C.s200, background: C.s50, color: C.navy }} />
                </div>
                <button
                  onClick={() => { if (memKey && memValue) setMemory.mutate({ category: memCategory, key: memKey, value: memValue }); }}
                  disabled={setMemory.isPending || !memKey || !memValue}
                  className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: C.blue }}
                >
                  {setMemory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  Save Memory
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.s500 }}>
                  Stored ({memoriesQuery.data?.length ?? 0})
                </p>
                {memoriesQuery.data?.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {memoriesQuery.data.map(m => (
                      <div key={m.id} className="p-3.5 rounded-lg bg-white" style={{ border: `1px solid ${C.s200}` }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-[11px] font-semibold" style={{ color: C.blue }}>{m.key}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: C.bluePale, color: C.blue }}>{m.category}</span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: C.s500 }}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white rounded-lg" style={{ border: `1px solid ${C.s200}` }}>
                    <Database className="w-8 h-8 mx-auto mb-2" style={{ color: C.s300 }} />
                    <p className="text-xs" style={{ color: C.s400 }}>No memory items stored.</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}

        {/* ── SETTINGS ────────────────────────────────────────────── */}
        {viewMode === "settings" && (
          <ScrollArea className="flex-1 p-4 sm:p-6">
            <div className="max-w-xl mx-auto space-y-5">
              <div>
                <h2 className="text-base font-semibold" style={{ color: C.navy }}>Platform Settings</h2>
                <p className="text-xs mt-0.5" style={{ color: C.s500 }}>Platform configuration and integration status.</p>
              </div>
              <div className="bg-white rounded-lg" style={{ border: `1px solid ${C.s200}` }}>
                {[
                  { title: "Platform Session",  sub: `Active as ${user.email}`,                    status: "Active",   color: "green" as const },
                  { title: "AI Agent Engine",    sub: "Autonomous task planning and execution",     status: "Ready",    color: "blue"  as const },
                  { title: "GitHub Integration", sub: "Repository access and code generation",      status: "Verified", color: "green" as const },
                  { title: "Browser Automation", sub: "Playwright-powered web task execution",      status: "Enabled",  color: "green" as const },
                  { title: "Cron Scheduler",     sub: "Background automation and job runner",       status: "Active",   color: "green" as const },
                ].map((row, i, arr) => (
                  <div key={row.title} className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${C.s100}` : "none" }}>
                    <div>
                      <h3 className="text-sm font-medium" style={{ color: C.navy }}>{row.title}</h3>
                      <p className="text-xs mt-0.5" style={{ color: C.s500 }}>{row.sub}</p>
                    </div>
                    <Pill label={row.status} color={row.color} />
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}

        {/* ── CHAT ─────────────────────────────────────────────────── */}
        {viewMode === "chat" && (
          <div className="flex-1 flex flex-col min-h-0">

            {/* Messages */}
            <ScrollArea ref={chatScrollRef} className="flex-1 px-3 sm:px-6 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-5 py-12">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: C.bluePale }}>
                    <BrainCircuit className="w-6 h-6" style={{ color: C.blue }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold" style={{ color: C.navy }}>What would you like to automate?</h2>
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: C.s500 }}>
                      Vela AI can generate code, analyse repositories, run browser tasks, and schedule recurring workflows.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-1">
                    {[
                      "Generate an async REST API in TypeScript with tests",
                      "Analyse Goddy36-A/vela-ai for architectural improvements",
                      "Create a Python data pipeline with error handling",
                      "Set up a CI/CD workflow for a Node.js project",
                    ].map(p => (
                      <button
                        key={p}
                        onClick={() => { setPromptInput(p); textareaRef.current?.focus(); }}
                        className="p-3 rounded border text-left text-xs bg-white transition-colors active:bg-slate-100"
                        style={{ borderColor: C.s200, color: "#374151" }}
                      >{p}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-3xl mx-auto pb-4">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role !== "user" && (
                        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white mt-0.5" style={{ background: C.blue }}>AI</div>
                      )}
                      <div
                        className="max-w-[85%] sm:max-w-[78%] rounded-lg px-4 py-3 text-sm"
                        style={{
                          background:  msg.role === "user" ? C.blue  : C.white,
                          color:       msg.role === "user" ? C.white : C.navy,
                          border:      msg.role === "user" ? "none"  : `1px solid ${C.s200}`,
                        }}
                      >
                        <div className="assistant-markdown text-sm leading-relaxed">
                          <AssistantMessage content={msg.content} />
                        </div>
                      </div>
                      {msg.role === "user" && (
                        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white mt-0.5" style={{ background: C.s700 }}>
                          {user.name[0]}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Execution plan */}
                  {subtasks.length > 0 && (
                    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.s200}` }}>
                      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: C.s100, borderBottom: `1px solid ${C.s200}` }}>
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.s500 }}>Execution Plan</span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: C.bluePale, color: C.blue }}>
                          {subtasks.filter(s => s.status === "completed").length}/{subtasks.length} steps
                        </span>
                      </div>
                      <div className="bg-white">
                        {subtasks.map((sub, i) => {
                          const done = sub.status === "completed";
                          const running = sub.status === "in_progress";
                          return (
                            <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5 text-xs" style={{ borderBottom: i < subtasks.length - 1 ? `1px solid ${C.s100}` : "none" }}>
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                                style={{ background: done ? C.green50 : C.s100, color: done ? C.green700 : C.s500 }}>
                                {done ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                              </span>
                              <span className="flex-1 font-medium" style={{ color: C.navy }}>{sub.title}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded font-medium"
                                style={{ background: done ? C.green50 : running ? C.bluePale : C.s100, color: done ? C.green700 : running ? C.blue : C.s500 }}>
                                {sub.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Approvals */}
                  {pendingApprovals.length > 0 && (
                    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.amber200}` }}>
                      <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: C.amber50, borderBottom: `1px solid ${C.amber200}` }}>
                        <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#B45309" }} />
                        <span className="text-xs font-semibold" style={{ color: C.amber800 }}>Action Approval Required</span>
                      </div>
                      <div className="bg-white">
                        {pendingApprovals.map((app, i) => (
                          <div key={app.id} className="flex items-center justify-between px-4 py-3 gap-3 text-xs" style={{ color: "#374151", borderTop: i > 0 ? `1px solid ${C.s100}` : "none" }}>
                            <span className="flex-1">{app.actionDescription}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button className="px-3 py-1.5 rounded text-white text-xs font-medium" style={{ background: C.blue }}
                                onClick={() => resolveApproval.mutate({ approvalId: app.id, status: "approved" })}>Approve</button>
                              <button className="px-3 py-1.5 rounded text-xs font-medium border" style={{ borderColor: C.s200, color: C.red600 }}
                                onClick={() => resolveApproval.mutate({ approvalId: app.id, status: "rejected" })}>Reject</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Tool logs */}
            {toolLogs.length > 0 && (
              <section className="flex-shrink-0" style={{ borderTop: `1px solid ${C.s200}`, background: C.s50 }}>
                <button type="button" onClick={() => setLogsOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2 text-xs transition-colors hover:bg-slate-100">
                  <span className="flex items-center gap-2">
                    <Terminal className="h-3 w-3" style={{ color: C.blue }} />
                    <span className="font-medium" style={{ color: C.navy }}>Execution Logs</span>
                    <span className="font-mono truncate max-w-[140px] sm:max-w-[200px]" style={{ color: C.s400 }}>
                      [{toolLogs[toolLogs.length - 1]?.toolName}]
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: C.bluePale, color: C.blue }}>{toolLogs.length}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${logsOpen ? "rotate-180" : ""}`} style={{ color: C.s400 }} />
                  </span>
                </button>
                {logsOpen && (
                  <div className="max-h-48 overflow-y-auto border-t px-3 py-2 space-y-2 bg-white" style={{ borderColor: C.s200 }}>
                    {toolLogs.map(log => (
                      <div key={log.id} className="rounded border px-3 py-2 text-xs" style={{ borderColor: C.s200 }}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-[11px] font-semibold" style={{ color: C.blue }}>{log.toolName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: log.status === "success" ? C.green50 : C.red50, color: log.status === "success" ? C.green700 : C.red600 }}>
                            {log.status}
                          </span>
                        </div>
                        {log.inputArgs && <div className="text-[11px] mb-1" style={{ color: C.s500 }}><span className="font-medium" style={{ color: C.navy }}>Input:</span> {log.inputArgs}</div>}
                        {log.outputResult && <div className="assistant-markdown text-[12px]"><AssistantMessage content={log.outputResult} /></div>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Composer ─────────────────────────────────────────── */}
            {/* paddingBottom uses safe-area-inset-bottom for notch devices */}
            <div
              className="flex-shrink-0 px-3 sm:px-4 pt-3 bg-white"
              style={{ borderTop: `1px solid ${C.s200}`, paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
                <div
                  className="flex items-end gap-2 rounded-lg border transition-shadow focus-within:shadow-md"
                  style={{ borderColor: createTask.isError ? C.red400 : C.s300, background: C.white, padding: "8px 8px 8px 12px" }}
                >
                  <textarea
                    ref={textareaRef}
                    value={promptInput}
                    onChange={e => { setPromptInput(e.target.value); }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                    placeholder="Send a message to Vela AI…"
                    className="flex-1 bg-transparent text-sm focus:outline-none resize-none leading-6"
                    style={{
                      color: C.navy,
                      minHeight: 36,
                      maxHeight: 140,
                      overflowY: "auto",
                    }}
                    rows={1}
                    disabled={createTask.isPending}
                  />
                  <button
                    type="submit"
                    disabled={createTask.isPending || !promptInput.trim()}
                    className="p-2 rounded transition-opacity disabled:opacity-40 flex-shrink-0 self-end"
                    style={{ background: createTask.isError ? C.red600 : C.blue }}
                  >
                    {createTask.isPending
                      ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                      : <Send className="w-4 h-4 text-white" />
                    }
                  </button>
                </div>
                {createTask.isError && (
                  <p className="text-[11px] mt-1.5 px-1" style={{ color: C.red600 }}>
                    {errMsg(createTask.error)}
                  </p>
                )}
                {!createTask.isError && (
                  <p className="text-[11px] text-center mt-1.5" style={{ color: C.s300 }}>
                    Vela AI · Code generation, GitHub, browser automation &amp; cron
                  </p>
                )}
              </form>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
