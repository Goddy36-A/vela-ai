import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Send, Plus, Settings, PanelLeftClose, PanelLeft,
  ChevronDown, MoreHorizontal, Pencil, Trash2, RotateCcw,
  Terminal, Zap, Database, ShieldCheck, BrainCircuit,
  Cpu, CheckCircle2,
} from "lucide-react";
import { AssistantMessage } from "@/components/AssistantMessage";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

// ── Platform user — authentication removed ───────────────────────────────
const PLATFORM_USER = {
  name: "Godfrey Atwijukire",
  email: "admin@velaai.platform",
};

// ── Colour tokens (inline for surgical overrides) ───────────────────────
const C = {
  navy:       "#0F172A",
  navyMid:    "#1E293B",
  navyLight:  "#334155",
  blue:       "#1D4ED8",
  blueDark:   "#1E40AF",
  bluePale:   "#EFF6FF",
  slate50:    "#F8FAFC",
  slate100:   "#F1F5F9",
  slate200:   "#E2E8F0",
  slate300:   "#CBD5E1",
  slate400:   "#94A3B8",
  slate500:   "#64748B",
  slate700:   "#334155",
  slate900:   "#0F172A",
  white:      "#FFFFFF",
  green50:    "#ECFDF5",
  green700:   "#047857",
  amber50:    "#FFFBEB",
  amber200:   "#FCD34D",
  amber800:   "#92400E",
  red50:      "#FEF2F2",
  red400:     "#F87171",
  red600:     "#DC2626",
};

// ── Helpers ─────────────────────────────────────────────────────────────
function phaseChip(phase: string, isActive: boolean) {
  if (!isActive) return { bg: "transparent", text: C.slate400, border: "transparent" };
  switch (phase) {
    case "planning":  return { bg: "#FFFBEB", text: "#B45309", border: "#FCD34D" };
    case "executing": return { bg: C.bluePale, text: C.blue,   border: "#BFDBFE" };
    case "reviewing": return { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" };
    case "done":      return { bg: C.green50,  text: C.green700, border: "#6EE7B7" };
    default:          return { bg: C.slate100, text: C.slate500, border: C.slate200 };
  }
}

function StatusPill({ label, variant }: { label: string; variant: "green" | "blue" | "amber" }) {
  const styles = {
    green: { bg: C.green50,  text: C.green700 },
    blue:  { bg: C.bluePale, text: C.blue },
    amber: { bg: "#FFFBEB",  text: "#B45309" },
  }[variant];
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded font-medium"
      style={{ background: styles.bg, color: styles.text }}
    >
      {label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════
export default function Home() {
  const user = PLATFORM_USER;

  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === "undefined" ? true : window.innerWidth >= 768
  );
  const [viewMode, setViewMode] = useState<"chat" | "automations" | "memories" | "settings">("chat");
  const [promptInput, setPromptInput]   = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [logsOpen, setLogsOpen]         = useState(false);
  const [managementId, setManagementId] = useState<number | null>(null);
  const [autoName, setAutoName]         = useState("");
  const [autoPrompt, setAutoPrompt]     = useState("");
  const [memCategory, setMemCategory]   = useState("preference");
  const [memKey, setMemKey]             = useState("");
  const [memValue, setMemValue]         = useState("");

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const tasksQuery      = trpc.agent.listTasks.useQuery(undefined, { retry: false, refetchInterval: 2000 });
  const taskDetailsQuery= trpc.agent.getTaskDetails.useQuery(
    { taskId: selectedTaskId! },
    { enabled: !!selectedTaskId, refetchInterval: 1500 }
  );
  const automationsQuery = trpc.agent.listAutomations.useQuery(undefined, { retry: false });
  const memoriesQuery    = trpc.agent.listMemories.useQuery(undefined, { retry: false });

  const createTask      = trpc.agent.createTask.useMutation({
    onSuccess: (d) => { setSelectedTaskId(d.taskId); setPromptInput(""); setLogsOpen(false); utils.agent.listTasks.invalidate(); }
  });
  const renameTask      = trpc.agent.renameTask.useMutation({
    onSuccess: () => { setManagementId(null); utils.agent.listTasks.invalidate(); if (selectedTaskId) utils.agent.getTaskDetails.invalidate({ taskId: selectedTaskId }); }
  });
  const deleteTask      = trpc.agent.deleteTask.useMutation({
    onSuccess: (_, v) => { if (selectedTaskId === v.taskId) setSelectedTaskId(null); setManagementId(null); utils.agent.listTasks.invalidate(); }
  });
  const clearHistory    = trpc.agent.clearHistory.useMutation({
    onSuccess: () => { setSelectedTaskId(null); setManagementId(null); utils.agent.listTasks.invalidate(); }
  });
  const createAuto      = trpc.agent.createAutomation.useMutation({
    onSuccess: () => { setAutoName(""); setAutoPrompt(""); utils.agent.listAutomations.invalidate(); }
  });
  const deleteAuto      = trpc.agent.deleteAutomation.useMutation({ onSuccess: () => utils.agent.listAutomations.invalidate() });
  const setMemory       = trpc.agent.setMemory.useMutation({
    onSuccess: () => { setMemKey(""); setMemValue(""); utils.agent.listMemories.invalidate(); }
  });
  const resolveApproval = trpc.agent.resolveApproval.useMutation({
    onSuccess: () => { if (selectedTaskId) utils.agent.getTaskDetails.invalidate({ taskId: selectedTaskId }); }
  });

  useEffect(() => {
    if (tasksQuery.data?.length && !selectedTaskId) setSelectedTaskId(tasksQuery.data[0].id);
  }, [tasksQuery.data, selectedTaskId]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [taskDetailsQuery.data?.messages]);

  const currentTask = taskDetailsQuery.data?.task;
  const subtasks    = taskDetailsQuery.data?.subtasks  ?? [];
  const toolLogs    = taskDetailsQuery.data?.toolLogs  ?? [];
  const messages    = taskDetailsQuery.data?.messages  ?? [];
  const approvals   = taskDetailsQuery.data?.approvals ?? [];
  const pendingApprovals = approvals.filter(a => a.status === "pending");

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (promptInput.trim()) createTask.mutate({ prompt: promptInput }); };

  // ── NAV ITEMS ────────────────────────────────────────────────────────
  const bottomNav = [
    { id: "automations" as const, icon: Zap,      label: "Automations"  },
    { id: "memories"    as const, icon: Database,  label: "Memory Store" },
    { id: "settings"    as const, icon: Settings,  label: "Settings"     },
  ];

  // ── HEADER TITLE ────────────────────────────────────────────────────
  const headerTitle = {
    chat:        currentTask?.title ?? "AI Agent",
    automations: "Scheduled Automations",
    memories:    "Memory Store",
    settings:    "Platform Settings",
  }[viewMode];

  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.slate50 }}>

      {/* Mobile scrim */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ───────────────────────────────────────────────── */}
      <aside
        className={`fixed md:relative z-50 h-full flex-col flex-shrink-0 transition-all duration-200 ${
          sidebarOpen ? "w-64 flex translate-x-0" : "w-0 -translate-x-full md:hidden"
        }`}
        style={{ background: C.navy }}
      >
        {/* Logo row */}
        <div
          className="h-14 flex items-center justify-between px-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${C.navyMid}` }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.blue }}>
              <Cpu className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-white tracking-tight">Vela AI</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: C.navyMid, color: C.slate400 }}
            >Enterprise</span>
          </div>
          <button
            className="md:hidden p-1 rounded transition-colors"
            style={{ color: C.slate500 }}
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* New task */}
        <div className="px-3 pt-3 pb-1">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors border"
            style={{ color: C.slate300, borderColor: C.navyMid, background: "transparent" }}
            onClick={() => { setSelectedTaskId(null); setViewMode("chat"); if (window.innerWidth < 768) setSidebarOpen(false); }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.navyMid; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest px-2 py-2" style={{ color: C.navyLight }}>
            Recent Tasks
          </p>
          {tasksQuery.data?.map(t => {
            const isActive = selectedTaskId === t.id && viewMode === "chat";
            return (
              <div
                key={t.id}
                className="relative group flex items-center rounded"
                style={{
                  background: isActive ? C.blueDark : "transparent",
                  borderLeft: `2px solid ${isActive ? "#3B82F6" : "transparent"}`,
                }}
              >
                <button
                  className="min-w-0 flex-1 text-left px-2 py-2 text-xs truncate"
                  style={{ color: isActive ? C.white : C.slate400 }}
                  onClick={() => { setSelectedTaskId(t.id); setViewMode("chat"); setManagementId(null); if (window.innerWidth < 768) setSidebarOpen(false); }}
                >
                  <span className="block truncate">{t.title}</span>
                  <span className="block mt-0.5 text-[10px] uppercase tracking-wide" style={{ color: isActive ? "#BFDBFE" : C.navyLight }}>
                    {t.phase}
                  </span>
                </button>
                <button
                  className="mr-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: C.slate500 }}
                  onClick={() => setManagementId(managementId === t.id ? null : t.id)}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
                {managementId === t.id && (
                  <div
                    className="absolute right-1 top-9 z-50 w-36 rounded overflow-hidden shadow-xl"
                    style={{ background: C.navyMid, border: `1px solid ${C.navyLight}` }}
                  >
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors text-left"
                      style={{ color: C.slate300 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.navyLight}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      onClick={() => {
                        const title = window.prompt("Rename task", t.title)?.trim();
                        if (title && title !== t.title) renameTask.mutate({ taskId: t.id, title });
                      }}
                    >
                      <Pencil className="h-3 w-3" /> Rename
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors text-left"
                      style={{ color: C.red400 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#450A0A"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      onClick={() => {
                        if (window.confirm("Delete this task and all history? This cannot be undone."))
                          deleteTask.mutate({ taskId: t.id });
                      }}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {!tasksQuery.data?.length && (
            <p className="px-2 py-3 text-xs" style={{ color: C.navyLight }}>No tasks yet.</p>
          )}
          {!!tasksQuery.data?.length && (
            <button
              className="mt-2 w-full flex items-center gap-2 px-2 py-2 text-xs rounded transition-colors"
              style={{ color: C.navyLight }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = C.red400}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = C.navyLight}
              onClick={() => { if (window.confirm("Clear all task history?")) clearHistory.mutate(); }}
            >
              <RotateCcw className="h-3 w-3" /> Clear history
            </button>
          )}
        </div>

        {/* Bottom navigation */}
        <div className="flex-shrink-0 px-3 pb-3 space-y-0.5" style={{ borderTop: `1px solid ${C.navyMid}`, paddingTop: "12px" }}>
          {bottomNav.map(item => (
            <button
              key={item.id}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded text-xs transition-colors"
              style={{
                background: viewMode === item.id ? C.blueDark : "transparent",
                color: viewMode === item.id ? C.white : C.slate400,
              }}
              onClick={() => { setViewMode(item.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
            >
              <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
              {item.label}
            </button>
          ))}

          {/* User */}
          <div
            className="mt-3 pt-3 flex items-center gap-2.5 px-1"
            style={{ borderTop: `1px solid ${C.navyMid}` }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
              style={{ background: C.blue }}
            >
              {user.name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: "#F1F5F9" }}>{user.name}</p>
              <p className="text-[10px] truncate" style={{ color: C.navyLight }}>{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header
          className="h-14 flex items-center justify-between px-5 flex-shrink-0 bg-white"
          style={{ borderBottom: `1px solid ${C.slate200}` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {!sidebarOpen && (
              <button
                className="p-1.5 rounded transition-colors"
                style={{ color: C.slate500 }}
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate" style={{ color: C.navy }}>{headerTitle}</h1>
              {viewMode === "chat" && currentTask && (
                <p className="text-[11px]" style={{ color: C.slate400 }}>Task #{selectedTaskId}</p>
              )}
            </div>
          </div>

          {/* Phase tracker (chat only) */}
          {viewMode === "chat" && currentTask && (
            <div className="hidden md:flex items-center gap-1">
              {(["planning", "executing", "reviewing", "done"] as const).map(p => {
                const { bg, text, border } = phaseChip(p, currentTask.phase === p);
                return (
                  <span
                    key={p}
                    className="text-[10px] uppercase font-medium px-2 py-0.5 rounded border transition-colors"
                    style={{ background: bg, color: text, borderColor: border }}
                  >
                    {p}
                  </span>
                );
              })}
            </div>
          )}
        </header>

        {/* ── AUTOMATIONS ──────────────────────────────────────────── */}
        {viewMode === "automations" && (
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-2xl mx-auto space-y-5">
              <div>
                <h2 className="text-base font-semibold" style={{ color: C.navy }}>Scheduled Automations</h2>
                <p className="text-xs mt-0.5" style={{ color: C.slate500 }}>
                  Configure recurring agent tasks and cron-based background workflows.
                </p>
              </div>

              {/* Create form */}
              <div className="bg-white rounded-lg p-5 space-y-4" style={{ border: `1px solid ${C.slate200}` }}>
                <h3 className="text-sm font-semibold" style={{ color: C.navy }}>Create Automation</h3>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>Name</label>
                  <input
                    type="text" value={autoName} onChange={e => setAutoName(e.target.value)}
                    placeholder="e.g. Daily Security Audit"
                    className="w-full rounded border px-3 py-2 text-xs focus:outline-none focus:ring-2"
                    style={{ borderColor: C.slate200, background: C.slate50, color: C.navy }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>Agent Prompt</label>
                  <textarea
                    value={autoPrompt} onChange={e => setAutoPrompt(e.target.value)}
                    placeholder="Describe what the agent should execute on schedule..."
                    className="w-full rounded border px-3 py-2 text-xs focus:outline-none resize-none h-20"
                    style={{ borderColor: C.slate200, background: C.slate50, color: C.navy }}
                  />
                </div>
                <button
                  onClick={() => { if (autoName && autoPrompt) createAuto.mutate({ name: autoName, prompt: autoPrompt }); }}
                  disabled={createAuto.isPending || !autoName || !autoPrompt}
                  className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium text-white disabled:opacity-50 transition-opacity"
                  style={{ background: C.blue }}
                >
                  {createAuto.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Schedule Automation
                </button>
              </div>

              {/* List */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.slate500 }}>
                  Active ({automationsQuery.data?.length ?? 0})
                </p>
                {automationsQuery.data?.length ? automationsQuery.data.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-white rounded-lg p-4" style={{ border: `1px solid ${C.slate200}` }}>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold" style={{ color: C.navy }}>{a.name}</h4>
                      <p className="text-xs mt-0.5 truncate" style={{ color: C.slate500 }}>{a.prompt}</p>
                      <span className="inline-block mt-1.5 font-mono text-[10px] px-2 py-0.5 rounded" style={{ background: C.bluePale, color: C.blue }}>
                        {a.cronSchedule ?? "0 */12 * * *"}
                      </span>
                    </div>
                    <button className="ml-4 p-1.5 rounded transition-colors" style={{ color: C.red400 }}
                      onClick={() => deleteAuto.mutate({ id: a.id })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )) : (
                  <div className="text-center py-12 bg-white rounded-lg" style={{ border: `1px solid ${C.slate200}` }}>
                    <Zap className="w-8 h-8 mx-auto mb-2" style={{ color: C.slate300 }} />
                    <p className="text-xs" style={{ color: C.slate400 }}>No automations configured.</p>
                    <p className="text-xs mt-1" style={{ color: C.slate300 }}>Create one above to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}

        {/* ── MEMORIES ─────────────────────────────────────────────── */}
        {viewMode === "memories" && (
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-2xl mx-auto space-y-5">
              <div>
                <h2 className="text-base font-semibold" style={{ color: C.navy }}>Memory Store</h2>
                <p className="text-xs mt-0.5" style={{ color: C.slate500 }}>
                  Persistent agent memory for preferences, coding standards, and API endpoints.
                </p>
              </div>

              <div className="bg-white rounded-lg p-5 space-y-4" style={{ border: `1px solid ${C.slate200}` }}>
                <h3 className="text-sm font-semibold" style={{ color: C.navy }}>Add Memory Item</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>Category</label>
                    <select value={memCategory} onChange={e => setMemCategory(e.target.value)}
                      className="w-full rounded border px-3 py-2 text-xs focus:outline-none"
                      style={{ borderColor: C.slate200, background: C.slate50, color: C.navy }}>
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
                      className="w-full rounded border px-3 py-2 text-xs focus:outline-none"
                      style={{ borderColor: C.slate200, background: C.slate50, color: C.navy }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#374151" }}>Value</label>
                  <textarea value={memValue} onChange={e => setMemValue(e.target.value)}
                    placeholder="e.g. TypeScript 5.9, strict null checks, Tailwind v4."
                    className="w-full rounded border px-3 py-2 text-xs focus:outline-none resize-none h-20"
                    style={{ borderColor: C.slate200, background: C.slate50, color: C.navy }}
                  />
                </div>
                <button
                  onClick={() => { if (memKey && memValue) setMemory.mutate({ category: memCategory, key: memKey, value: memValue }); }}
                  disabled={setMemory.isPending || !memKey || !memValue}
                  className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium text-white disabled:opacity-50 transition-opacity"
                  style={{ background: C.blue }}
                >
                  {setMemory.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                  Save Memory
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.slate500 }}>
                  Stored ({memoriesQuery.data?.length ?? 0})
                </p>
                {memoriesQuery.data?.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {memoriesQuery.data.map(m => (
                      <div key={m.id} className="p-3.5 rounded-lg bg-white" style={{ border: `1px solid ${C.slate200}` }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-[11px] font-semibold" style={{ color: C.blue }}>{m.key}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: C.bluePale, color: C.blue }}>{m.category}</span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: C.slate500 }}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white rounded-lg" style={{ border: `1px solid ${C.slate200}` }}>
                    <Database className="w-8 h-8 mx-auto mb-2" style={{ color: C.slate300 }} />
                    <p className="text-xs" style={{ color: C.slate400 }}>No memory items stored.</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}

        {/* ── SETTINGS ─────────────────────────────────────────────── */}
        {viewMode === "settings" && (
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-xl mx-auto space-y-5">
              <div>
                <h2 className="text-base font-semibold" style={{ color: C.navy }}>Platform Settings</h2>
                <p className="text-xs mt-0.5" style={{ color: C.slate500 }}>
                  Platform configuration and integration status.
                </p>
              </div>
              <div className="bg-white rounded-lg divide-y" style={{ border: `1px solid ${C.slate200}`, divideColor: C.slate100 }}>
                {[
                  { title: "Platform Session",       sub: `Active as ${user.email}`,                    status: "Active",   variant: "green" as const },
                  { title: "AI Agent Engine",         sub: "Autonomous task planning and execution",     status: "Ready",    variant: "blue"  as const },
                  { title: "GitHub Integration",      sub: "Repository access and code generation",      status: "Verified", variant: "green" as const },
                  { title: "Browser Automation",      sub: "Playwright-powered web task execution",      status: "Enabled",  variant: "green" as const },
                  { title: "Cron Scheduler",          sub: "Background automation and job runner",       status: "Active",   variant: "green" as const },
                ].map(row => (
                  <div key={row.title} className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium" style={{ color: C.navy }}>{row.title}</h3>
                      <p className="text-xs mt-0.5" style={{ color: C.slate500 }}>{row.sub}</p>
                    </div>
                    <StatusPill label={row.status} variant={row.variant} />
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}

        {/* ── CHAT ─────────────────────────────────────────────────── */}
        {viewMode === "chat" && (
          <div className="flex-1 flex flex-col min-h-0">

            {/* Messages area */}
            <ScrollArea ref={chatScrollRef} className="flex-1 px-4 sm:px-6 py-5">
              {messages.length === 0 ? (
                /* Welcome screen */
                <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-5 py-20">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: C.bluePale }}
                  >
                    <BrainCircuit className="w-6 h-6" style={{ color: C.blue }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold" style={{ color: C.navy }}>What would you like to automate?</h2>
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: C.slate500 }}>
                      Vela AI can generate code, analyse repositories, run browser tasks, and schedule recurring workflows.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-2">
                    {[
                      "Generate an async REST API in TypeScript with tests",
                      "Analyse Goddy36-A/vela-ai for architectural improvements",
                      "Create a Python data pipeline with error handling",
                      "Set up a CI/CD workflow for a Node.js project",
                    ].map(p => (
                      <button
                        key={p}
                        onClick={() => setPromptInput(p)}
                        className="p-3 rounded border text-left text-xs bg-white transition-colors hover:bg-slate-50"
                        style={{ borderColor: C.slate200, color: "#374151" }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5 max-w-3xl mx-auto pb-10">
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role !== "user" && (
                        <div
                          className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white"
                          style={{ background: C.blue }}
                        >AI</div>
                      )}
                      <div
                        className="max-w-[80%] rounded-lg px-4 py-3 text-sm"
                        style={{
                          background:   msg.role === "user" ? C.blue  : C.white,
                          color:        msg.role === "user" ? C.white : C.navy,
                          border:       msg.role === "user" ? "none"  : `1px solid ${C.slate200}`,
                        }}
                      >
                        <div className="assistant-markdown text-sm leading-relaxed">
                          <AssistantMessage content={msg.content} />
                        </div>
                      </div>
                      {msg.role === "user" && (
                        <div
                          className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white"
                          style={{ background: C.slate700 }}
                        >{user.name[0]}</div>
                      )}
                    </div>
                  ))}

                  {/* Execution Plan */}
                  {subtasks.length > 0 && (
                    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.slate200}` }}>
                      <div
                        className="px-4 py-2.5 flex items-center justify-between"
                        style={{ background: C.slate100, borderBottom: `1px solid ${C.slate200}` }}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.slate500 }}>
                          Execution Plan
                        </span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded font-medium"
                          style={{ background: C.bluePale, color: C.blue }}
                        >
                          {subtasks.filter(s => s.status === "completed").length}/{subtasks.length} steps
                        </span>
                      </div>
                      <div className="bg-white divide-y" style={{ borderColor: C.slate100 }}>
                        {subtasks.map((sub, i) => {
                          const done = sub.status === "completed";
                          const active = sub.status === "in_progress";
                          return (
                            <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                                style={{ background: done ? C.green50 : C.slate100, color: done ? C.green700 : C.slate500 }}
                              >
                                {done ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                              </span>
                              <span className="flex-1 font-medium" style={{ color: C.navy }}>{sub.title}</span>
                              <span
                                className="text-[10px] px-2 py-0.5 rounded font-medium"
                                style={{
                                  background: done ? C.green50 : active ? C.bluePale : C.slate100,
                                  color:      done ? C.green700 : active ? C.blue    : C.slate500,
                                }}
                              >{sub.status}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Approval widget */}
                  {pendingApprovals.length > 0 && (
                    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.amber200}` }}>
                      <div
                        className="px-4 py-2.5 flex items-center gap-2"
                        style={{ background: C.amber50, borderBottom: `1px solid ${C.amber200}` }}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#B45309" }} />
                        <span className="text-xs font-semibold" style={{ color: C.amber800 }}>
                          Action Approval Required
                        </span>
                      </div>
                      <div className="bg-white divide-y" style={{ borderColor: "#FEF3C7" }}>
                        {pendingApprovals.map(app => (
                          <div key={app.id} className="flex items-center justify-between px-4 py-3 gap-3 text-xs" style={{ color: "#374151" }}>
                            <span className="flex-1">{app.actionDescription}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                className="px-3 py-1 rounded text-white text-xs font-medium"
                                style={{ background: C.blue }}
                                onClick={() => resolveApproval.mutate({ approvalId: app.id, status: "approved" })}
                              >Approve</button>
                              <button
                                className="px-3 py-1 rounded text-xs font-medium border"
                                style={{ borderColor: C.slate200, color: C.red600 }}
                                onClick={() => resolveApproval.mutate({ approvalId: app.id, status: "rejected" })}
                              >Reject</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Tool Logs bar */}
            {toolLogs.length > 0 && (
              <section className="flex-shrink-0" style={{ borderTop: `1px solid ${C.slate200}`, background: C.slate50 }}>
                <button
                  type="button"
                  onClick={() => setLogsOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2 text-xs transition-colors hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <Terminal className="h-3 w-3" style={{ color: C.blue }} />
                    <span className="font-medium" style={{ color: C.navy }}>Execution Logs</span>
                    <span className="font-mono truncate max-w-[180px]" style={{ color: C.slate400 }}>
                      [{toolLogs[toolLogs.length - 1]?.toolName}]
                    </span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: C.bluePale, color: C.blue }}>
                      {toolLogs.length} calls
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${logsOpen ? "rotate-180" : ""}`} style={{ color: C.slate400 }} />
                  </span>
                </button>
                {logsOpen && (
                  <div className="max-h-52 overflow-y-auto border-t px-3 py-2 space-y-2 bg-white" style={{ borderColor: C.slate200 }}>
                    {toolLogs.map(log => (
                      <div key={log.id} className="rounded border px-3 py-2 text-xs" style={{ borderColor: C.slate200 }}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-[11px] font-semibold" style={{ color: C.blue }}>{log.toolName}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                              background: log.status === "success" ? C.green50  : C.red50,
                              color:      log.status === "success" ? C.green700 : C.red600,
                            }}
                          >{log.status}</span>
                        </div>
                        {log.inputArgs && (
                          <div className="text-[11px] mb-1" style={{ color: C.slate500 }}>
                            <span className="font-medium" style={{ color: C.navy }}>Input:</span> {log.inputArgs}
                          </div>
                        )}
                        {log.outputResult && (
                          <div className="assistant-markdown text-[12px]">
                            <AssistantMessage content={log.outputResult} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Composer */}
            <div
              className="flex-shrink-0 px-4 py-3 bg-white"
              style={{ borderTop: `1px solid ${C.slate200}`, paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
            >
              <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
                <div
                  className="flex items-end gap-2 rounded-lg border p-2 transition-shadow focus-within:shadow-md"
                  style={{ borderColor: C.slate300, background: C.white }}
                >
                  <textarea
                    value={promptInput}
                    onChange={e => setPromptInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                    placeholder="Send a message to Vela AI…"
                    className="flex-1 bg-transparent px-2 py-1.5 text-sm focus:outline-none resize-none max-h-36 min-h-[36px] leading-6"
                    style={{ color: C.navy }}
                    rows={1}
                    disabled={createTask.isPending}
                  />
                  <button
                    type="submit"
                    disabled={createTask.isPending || !promptInput.trim()}
                    className="p-2 rounded transition-opacity disabled:opacity-40 flex-shrink-0"
                    style={{ background: C.blue }}
                  >
                    {createTask.isPending
                      ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                      : <Send className="w-4 h-4 text-white" />
                    }
                  </button>
                </div>
                <p className="text-[11px] text-center mt-1.5" style={{ color: C.slate300 }}>
                  Vela AI Platform · Code generation, GitHub, browser automation &amp; cron
                </p>
              </form>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
