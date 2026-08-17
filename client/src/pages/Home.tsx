import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Plus, Settings, LogOut, Cpu, Globe, PanelLeftClose, PanelLeft, Sparkles, ChevronDown, ChevronUp, MoreHorizontal, Pencil, Trash2, RotateCcw, Terminal, Zap, Database, ShieldCheck, CheckCircle2 } from "lucide-react";
import { AssistantMessage } from "@/components/AssistantMessage";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" ? true : window.innerWidth >= 768);
  const [viewMode, setViewMode] = useState<"chat" | "automations" | "memories" | "settings">("chat");
  const [promptInput, setPromptInput] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [managementTaskId, setManagementTaskId] = useState<number | null>(null);

  // Automation / Memory form states
  const [autoName, setAutoName] = useState("");
  const [autoPrompt, setAutoPrompt] = useState("");
  const [memCategory, setMemCategory] = useState("preference");
  const [memKey, setMemKey] = useState("");
  const [memValue, setMemValue] = useState("");

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const tasksQuery = trpc.agent.listTasks.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 2000
  });

  const taskDetailsQuery = trpc.agent.getTaskDetails.useQuery(
    { taskId: selectedTaskId! },
    { enabled: !!selectedTaskId && isAuthenticated, refetchInterval: 1500 }
  );

  const automationsQuery = trpc.agent.listAutomations.useQuery(undefined, { enabled: isAuthenticated });
  const memoriesQuery = trpc.agent.listMemories.useQuery(undefined, { enabled: isAuthenticated });

  const createTaskMutation = trpc.agent.createTask.useMutation({
    onSuccess: (data) => {
      setSelectedTaskId(data.taskId);
      setPromptInput("");
      setLogsOpen(false);
      utils.agent.listTasks.invalidate();
    }
  });

  const renameTaskMutation = trpc.agent.renameTask.useMutation({
    onSuccess: () => {
      setManagementTaskId(null);
      utils.agent.listTasks.invalidate();
      if (selectedTaskId) utils.agent.getTaskDetails.invalidate({ taskId: selectedTaskId });
    }
  });

  const deleteTaskMutation = trpc.agent.deleteTask.useMutation({
    onSuccess: (_data, variables) => {
      if (selectedTaskId === variables.taskId) setSelectedTaskId(null);
      setManagementTaskId(null);
      utils.agent.listTasks.invalidate();
    }
  });

  const clearHistoryMutation = trpc.agent.clearHistory.useMutation({
    onSuccess: () => {
      setSelectedTaskId(null);
      setManagementTaskId(null);
      utils.agent.listTasks.invalidate();
    }
  });

  const createAutomationMutation = trpc.agent.createAutomation.useMutation({
    onSuccess: () => {
      setAutoName("");
      setAutoPrompt("");
      utils.agent.listAutomations.invalidate();
    }
  });

  const deleteAutomationMutation = trpc.agent.deleteAutomation.useMutation({
    onSuccess: () => {
      utils.agent.listAutomations.invalidate();
    }
  });

  const setMemoryMutation = trpc.agent.setMemory.useMutation({
    onSuccess: () => {
      setMemKey("");
      setMemValue("");
      utils.agent.listMemories.invalidate();
    }
  });

  const resolveApprovalMutation = trpc.agent.resolveApproval.useMutation({
    onSuccess: () => {
      if (selectedTaskId) utils.agent.getTaskDetails.invalidate({ taskId: selectedTaskId });
    }
  });

  useEffect(() => {
    if (tasksQuery.data && tasksQuery.data.length > 0 && !selectedTaskId) {
      setSelectedTaskId(tasksQuery.data[0].id);
    }
  }, [tasksQuery.data, selectedTaskId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [taskDetailsQuery.data?.messages]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-xl text-center space-y-6">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight">Open Agent Assistant (2050 AI)</h1>
            <p className="text-xs text-muted-foreground">
              Sign in with Manus OAuth to access autonomous task planning, multi-language code generation, Playwright browser telemetry, scheduled automation, and long-term memory.
            </p>
          </div>
          <Button onClick={() => { window.location.href = "/api/oauth/callback"; }} className="w-full h-11 rounded-xl font-medium shadow-sm">
            Continue with Manus OAuth
          </Button>
        </div>
      </div>
    );
  }

  const currentTask = taskDetailsQuery.data?.task;
  const subtasks = taskDetailsQuery.data?.subtasks || [];
  const toolLogs = taskDetailsQuery.data?.toolLogs || [];
  const messages = taskDetailsQuery.data?.messages || [];
  const approvals = taskDetailsQuery.data?.approvals || [];

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    createTaskMutation.mutate({ prompt: promptInput });
  };

  const handleRenameTask = (taskId: number, currentTitle: string) => {
    const title = window.prompt("Rename chat", currentTitle)?.trim();
    if (title && title !== currentTitle) renameTaskMutation.mutate({ taskId, title });
  };

  const handleDeleteTask = (taskId: number) => {
    if (window.confirm("Delete this chat and its task history? This cannot be undone.")) {
      deleteTaskMutation.mutate({ taskId });
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Clear every chat and its task history? This cannot be undone.")) {
      clearHistoryMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen flex h-screen bg-background text-foreground overflow-hidden">
      {/* Mobile Sidebar Overlay Scrim */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-xs md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ChatGPT-style Collapsible Sidebar */}
      <aside
        className={`fixed md:relative z-50 h-full w-72 flex-shrink-0 bg-secondary/50 border-r border-border flex flex-col transition-transform duration-200 ease-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:hidden"
        }`}
      >
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <Button
            onClick={() => {
              setSelectedTaskId(null);
              setViewMode("chat");
              if (window.innerWidth < 768) setSidebarOpen(false);
            }}
            variant="outline"
            className="flex-1 justify-start gap-2 h-10 rounded-xl bg-card border-border hover:bg-accent text-xs font-medium shadow-2xs"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>New chat</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto space-y-1 p-2">
          <div className="text-[11px] font-medium text-muted-foreground px-3 py-1.5 uppercase tracking-wider">Recent chats</div>
          {tasksQuery.data?.map((t) => (
            <div
              key={t.id}
              className={`relative group flex items-center gap-1 rounded-xl transition ${
                selectedTaskId === t.id && viewMode === "chat"
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              <button
                onClick={() => {
                  setSelectedTaskId(t.id);
                  setViewMode("chat");
                  setManagementTaskId(null);
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className="min-w-0 flex-1 text-left px-3 py-2.5 rounded-xl text-xs truncate"
              >
                <span className="block truncate">{t.title}</span>
                <span className="block mt-0.5 text-[10px] text-muted-foreground uppercase opacity-70">{t.phase}</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="mr-1 h-8 w-8 flex-shrink-0 rounded-lg opacity-60 hover:opacity-100"
                onClick={() => setManagementTaskId(managementTaskId === t.id ? null : t.id)}
                aria-label={`Manage ${t.title}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {managementTaskId === t.id && (
                <div className="absolute right-1 top-11 z-50 w-36 rounded-xl border border-border bg-popover p-1 shadow-xl">
                  <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent" onClick={() => handleRenameTask(t.id, t.title)}>
                    <Pencil className="h-3.5 w-3.5" /> Rename
                  </button>
                  <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTask(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete chat
                  </button>
                </div>
              )}
            </div>
          ))}
          {tasksQuery.data?.length ? (
            <button onClick={handleClearHistory} className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <RotateCcw className="h-3.5 w-3.5" /> Clear all chat history
            </button>
          ) : (
            <div className="px-3 py-4 text-xs text-muted-foreground">No saved chats yet.</div>
          )}
        </div>

        {/* Bottom user profile & 2050 Automation Hub */}
        <div className="relative pt-2 border-t border-border space-y-1 p-2">
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2 text-xs rounded-xl py-2.5 ${viewMode === "automations" ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
            onClick={() => { setViewMode("automations"); if (window.innerWidth < 768) setSidebarOpen(false); }}
          >
            <Zap className="h-4 w-4 text-primary" /> 2050 Automations & Cron
          </Button>
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2 text-xs rounded-xl py-2.5 ${viewMode === "memories" ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
            onClick={() => { setViewMode("memories"); if (window.innerWidth < 768) setSidebarOpen(false); }}
          >
            <Database className="h-4 w-4 text-primary" /> Long-Term Memory
          </Button>
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2 text-xs rounded-xl py-2.5 ${viewMode === "settings" ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
            onClick={() => { setViewMode("settings"); if (window.innerWidth < 768) setSidebarOpen(false); }}
          >
            <Settings className="h-4 w-4" /> Settings & Telemetry
          </Button>
          <div className="pt-2 mt-1 border-t border-border flex items-center justify-between px-2 py-2">
            <div className="min-w-0 flex items-center gap-2 truncate">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {user?.name?.[0] || "U"}
              </div>
              <div className="min-w-0 truncate text-xs">
                <p className="font-medium truncate text-foreground">{user?.name || "User"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email || "Connected"}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {/* ChatGPT Top Navigation Bar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 flex-shrink-0 bg-background/95 backdrop-blur-xs z-30">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                aria-label="Open sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground px-3 py-1.5 rounded-xl hover:bg-accent/50 cursor-pointer transition">
              <span className="truncate max-w-[150px] sm:max-w-none">Open Agent Assistant</span>
              <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] font-normal px-1.5 py-0.5 rounded-md ml-1">2050 Autonomous Engine</Badge>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
            </div>
          </div>

          {/* Phase Status Indicator */}
          {viewMode === "chat" && currentTask && (
            <div className="hidden md:flex items-center gap-2 text-xs font-medium bg-muted/40 border border-border px-3 py-1.5 rounded-full">
              <span className="text-muted-foreground">Phase:</span>
              {(["planning", "executing", "reviewing", "done"] as const).map((p) => {
                const active = currentTask.phase === p;
                return (
                  <span
                    key={p}
                    className={`uppercase text-[10px] px-2 py-0.5 rounded-md transition ${
                      active
                        ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                        : "text-muted-foreground opacity-60"
                    }`}
                  >
                    {p}
                  </span>
                );
              })}
            </div>
          )}
        </header>

        {/* View Mode Router */}
        {viewMode === "automations" ? (
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">2050 Autonomous Automations & Cron</h2>
                  <p className="text-xs text-muted-foreground mt-1">Schedule background agent jobs, recurring web research, and autonomous repository maintenance.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-semibold">Create New Scheduled Automation</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Automation Name</label>
                    <input
                      type="text"
                      value={autoName}
                      onChange={(e) => setAutoName(e.target.value)}
                      placeholder="e.g. Daily GitHub Security Audit"
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Agent Task Prompt</label>
                    <textarea
                      value={autoPrompt}
                      onChange={(e) => setAutoPrompt(e.target.value)}
                      placeholder="Describe what the agent should investigate or execute on schedule..."
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-hidden resize-none h-20"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      if (!autoName || !autoPrompt) return;
                      createAutomationMutation.mutate({ name: autoName, prompt: autoPrompt });
                    }}
                    disabled={createAutomationMutation.isPending || !autoName || !autoPrompt}
                    className="rounded-xl text-xs font-medium"
                  >
                    {createAutomationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2 text-primary" />}
                    Schedule 2050 Automation
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Active Automations ({automationsQuery.data?.length || 0})</h3>
                {automationsQuery.data?.length ? (
                  automationsQuery.data.map(auto => (
                    <div key={auto.id} className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card shadow-2xs">
                      <div>
                        <h4 className="text-sm font-medium">{auto.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{auto.prompt}</p>
                        <span className="inline-block mt-2 font-mono text-[10px] bg-muted px-2 py-0.5 rounded text-primary">Cron: {auto.cronSchedule || "0 */12 * * *"}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => deleteAutomationMutation.mutate({ id: auto.id })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No active scheduled automations found.</p>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : viewMode === "memories" ? (
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Long-Term Agent Memory</h2>
                <p className="text-xs text-muted-foreground mt-1">Persistent semantic memory store for user preferences, code standards, and API endpoints.</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-semibold">Store New Memory</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <select
                      value={memCategory}
                      onChange={(e) => setMemCategory(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                    >
                      <option value="preference">Preference</option>
                      <option value="coding_style">Coding Style</option>
                      <option value="endpoint">Endpoint / Config</option>
                      <option value="goal">Goal</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Key / Title</label>
                    <input
                      type="text"
                      value={memKey}
                      onChange={(e) => setMemKey(e.target.value)}
                      placeholder="e.g. preferred_language"
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Memory Value</label>
                  <textarea
                    value={memValue}
                    onChange={(e) => setMemValue(e.target.value)}
                    placeholder="e.g. TypeScript 5.9, strict null checks, Tailwind 4 styling."
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs resize-none h-20"
                  />
                </div>
                <Button
                  onClick={() => {
                    if (!memKey || !memValue) return;
                    setMemoryMutation.mutate({ category: memCategory, key: memKey, value: memValue });
                  }}
                  disabled={setMemoryMutation.isPending || !memKey || !memValue}
                  className="rounded-xl text-xs font-medium"
                >
                  {setMemoryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2 text-primary" />}
                  Save Memory Item
                </Button>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Stored Memories ({memoriesQuery.data?.length || 0})</h3>
                {memoriesQuery.data?.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {memoriesQuery.data.map(m => (
                      <div key={m.id} className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-semibold text-primary">{m.key}</span>
                          <Badge variant="outline" className="text-[10px]">{m.category}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{m.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No memories recorded yet.</p>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : viewMode === "settings" ? (
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Settings & Telemetry</h2>
                <p className="text-xs text-muted-foreground mt-1">Configure your 2050 autonomous agent platform parameters.</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Manus OAuth Authentication</h3>
                    <p className="text-xs text-muted-foreground">Authenticated as {user?.email}</p>
                  </div>
                  <Badge variant="secondary">Connected</Badge>
                </div>
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">GitHub Copilot Integration</h3>
                    <p className="text-xs text-muted-foreground">Active GITHUB_PAT registered and verified.</p>
                  </div>
                  <Badge variant="secondary">Verified</Badge>
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          /* Chat Stream View */
          <div className="flex-1 flex flex-col min-h-0 relative">
            <ScrollArea ref={chatScrollRef} className="flex-1 p-4 sm:p-6">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-4 my-20">
                  <div className="p-4 bg-secondary rounded-2xl text-foreground shadow-sm">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">What can I help automate today?</h2>
                  <p className="text-xs text-muted-foreground">
                    Ask me to run multi-language code generation, browse repositories with Playwright, or schedule 2050 autonomous cron workflows.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-4">
                    <button
                      onClick={() => setPromptInput("Generate an async REST server in Rust and Python with automated tests")}
                      className="p-3 rounded-xl border border-border bg-card hover:bg-accent text-left text-xs font-medium transition"
                    >
                      Generate Rust & Python servers →
                    </button>
                    <button
                      onClick={() => setPromptInput("Analyze Goddy36-A/vela-ai and suggest architectural optimizations")}
                      className="p-3 rounded-xl border border-border bg-card hover:bg-accent text-left text-xs font-medium transition"
                    >
                      Review GitHub repo vela-ai →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 max-w-3xl mx-auto pb-10">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role !== "user" && (
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 text-xs font-semibold shadow-xs">
                          AI
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm ${
                          msg.role === "user"
                            ? "bg-secondary text-secondary-foreground rounded-br-xs"
                            : "bg-card border border-border text-card-foreground rounded-bl-xs shadow-xs"
                        }`}
                      >
                        <div className="prose dark:prose-invert text-sm max-w-none leading-relaxed">
                          <AssistantMessage content={msg.content} />
                        </div>
                      </div>
                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center flex-shrink-0 text-xs font-semibold shadow-xs">
                          {user?.name?.[0] || "U"}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Active Subtasks Planner Timeline */}
                  {subtasks.length > 0 && (
                    <div className="my-6 p-4 rounded-2xl border border-border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">2050 Autonomous Plan</span>
                        <Badge variant="outline" className="text-[10px]">
                          {subtasks.filter(s => s.status === 'completed').length} / {subtasks.length} steps completed
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {subtasks.map((sub, idx) => (
                          <div key={sub.id} className="flex items-center gap-3 text-xs p-2.5 rounded-xl border border-border bg-card shadow-2xs">
                            <span className="w-5 h-5 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                              {idx + 1}
                            </span>
                            <span className="flex-1 font-medium truncate">{sub.title}</span>
                            <Badge
                              variant={sub.status === 'completed' ? 'secondary' : sub.status === 'in_progress' ? 'default' : 'outline'}
                              className="text-[10px]"
                            >
                              {sub.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Human-in-the-loop Approvals Widget */}
                  {approvals.filter(a => a.status === 'pending').length > 0 && (
                    <div className="my-6 p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 space-y-3">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4" /> Approval Required for High-Risk Action
                      </div>
                      {approvals.filter(a => a.status === 'pending').map(app => (
                        <div key={app.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border text-xs">
                          <span>{app.actionDescription}</span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-primary text-primary-foreground"
                              onClick={() => resolveApprovalMutation.mutate({ approvalId: app.id, status: 'approved' })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => resolveApprovalMutation.mutate({ approvalId: app.id, status: 'rejected' })}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Collapsible tool telemetry inspector */}
            {toolLogs.length > 0 && (
              <section className="border-t border-border bg-muted/20 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setLogsOpen(open => !open)}
                  aria-expanded={logsOpen}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2 text-xs hover:bg-accent/40 transition"
                >
                  <span className="min-w-0 flex items-center gap-2 text-muted-foreground truncate">
                    <Terminal className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="font-medium text-foreground">2050 Tool & Copilot Execution Logs</span>
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      Latest: [{toolLogs[toolLogs.length - 1]?.toolName}] {toolLogs[toolLogs.length - 1]?.outputResult?.replace(/[#*`]/g, "").slice(0, 70)}...
                    </span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-[10px]">{toolLogs.length} calls</Badge>
                    {logsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </span>
                </button>
                {logsOpen && (
                  <div className="max-h-64 overflow-y-auto border-t border-border px-3 py-2 space-y-2 bg-background/70">
                    {toolLogs.map(log => (
                      <div key={log.id} className="rounded-xl border border-border bg-card px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-[11px] font-semibold text-primary">{log.toolName}</span>
                          <Badge variant={log.status === "success" ? "secondary" : "destructive"} className="text-[10px]">{log.status}</Badge>
                        </div>
                        {log.inputArgs && <div className="text-[11px] text-muted-foreground break-all mb-1"><span className="font-medium text-foreground">Input:</span> {log.inputArgs}</div>}
                        {log.outputResult && <div className="assistant-markdown text-[12px]"><AssistantMessage content={log.outputResult} /></div>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ChatGPT-style Floating Composer Bar */}
            <div className="p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4 bg-background border-t border-border flex-shrink-0">
              <form onSubmit={handleCreateTask} className="max-w-3xl mx-auto relative">
                <div className="relative flex items-center bg-card border border-border rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition">
                  <textarea
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleCreateTask(e);
                      }
                    }}
                    placeholder="Message 2050 Open Agent Assistant (Code generation, Playwright, GitHub, Cron)..."
                    className="w-full bg-transparent px-4 py-3.5 pr-14 text-base md:text-sm focus:outline-hidden resize-none max-h-36 min-h-[52px] leading-6"
                    rows={1}
                    disabled={createTaskMutation.isPending}
                  />
                  <div className="absolute right-2.5 bottom-2.5">
                    <Button
                      type="submit"
                      size="icon"
                      disabled={createTaskMutation.isPending || !promptInput.trim()}
                      className="h-9 w-9 rounded-xl bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 transition"
                    >
                      {createTaskMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="text-[11px] text-center text-muted-foreground mt-2">
                  Open Agent Assistant 2050. Multi-language code gen, GitHub Copilot collaboration, and automated cron active.
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
