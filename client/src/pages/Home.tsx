import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Plus, Settings, LogOut, Cpu, Globe, PanelLeftClose, PanelLeft, Sparkles, ChevronDown, ChevronUp, MoreHorizontal, Pencil, Trash2, RotateCcw, Terminal } from "lucide-react";
import { AssistantMessage } from "@/components/AssistantMessage";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" ? true : window.innerWidth >= 768);
  const [viewMode, setViewMode] = useState<"chat" | "settings">("chat");
  const [promptInput, setPromptInput] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [managementTaskId, setManagementTaskId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const tasksQuery = trpc.agent.listTasks.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 2500
  });

  const taskDetailsQuery = trpc.agent.getTaskDetails.useQuery(
    { taskId: selectedTaskId! },
    { enabled: !!selectedTaskId && isAuthenticated, refetchInterval: 1500 }
  );

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

  useEffect(() => {
    if (tasksQuery.data && tasksQuery.data.length > 0 && !selectedTaskId) {
      setSelectedTaskId(tasksQuery.data[0].id);
    }
  }, [tasksQuery.data, selectedTaskId]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border p-8 rounded-2xl shadow-xl text-center space-y-6">
          <div className="inline-flex p-3 bg-secondary rounded-full text-foreground">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Open Agent Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with Manus OAuth to access autonomous chat sessions, multi-step agent planning, and Playwright browser telemetry.
            </p>
          </div>
          <Button 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-6 rounded-xl shadow-sm"
            onClick={() => startLogin()}
          >
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
      {/* ChatGPT-style collapsible sidebar */}
      <aside
        className={`${sidebarOpen ? "translate-x-0 md:translate-x-0" : "-translate-x-full md:-ml-64 md:translate-x-0"} fixed inset-y-0 left-0 z-40 w-72 md:relative md:inset-auto md:z-20 md:w-64 transition-transform md:transition-[transform,margin] duration-300 ease-out bg-muted/50 border-r border-border flex flex-col justify-between flex-shrink-0`}
      >
        <div className="p-3 flex flex-col h-full space-y-3 overflow-hidden">
          {/* New Chat & Close Sidebar */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              className="flex-1 justify-start gap-2 bg-card hover:bg-accent border-border rounded-xl text-xs font-medium py-5 shadow-xs"
              onClick={() => {
                setSelectedTaskId(null);
                setViewMode("chat");
              }}
            >
              <Plus className="w-4 h-4 text-primary" />
              <span>New chat</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-accent text-muted-foreground h-10 w-10 flex-shrink-0"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>

          {/* Chat History List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
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

          {/* Bottom user profile & settings */}
          <div className="relative pt-2 border-t border-border space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-xs rounded-xl py-2.5 text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => setViewMode("settings")}
            >
              <Settings className="w-4 h-4" />
              <span>Settings & Telemetry</span>
            </Button>
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-card border border-border">
              <div className="truncate pr-2">
                <div className="text-xs font-medium text-foreground truncate">{user?.name || "Operator"}</div>
                <div className="text-[10px] text-muted-foreground truncate">{user?.email || "Manus User"}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => logout()} className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg flex-shrink-0" title="Sign out">
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile scrim keeps the conversation context visible while the history drawer is open. */}
      {sidebarOpen && <button aria-label="Close conversation sidebar" className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[1px] md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main ChatGPT Workspace */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden bg-background relative">
        {/* Top Header bar */}
        <header className="h-14 min-h-14 border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2 bg-background/80 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl hover:bg-accent text-muted-foreground h-9 w-9"
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
            )}
            {/* Model Selector dropdown style */}
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground px-3 py-1.5 rounded-xl hover:bg-accent/50 cursor-pointer transition">
              <span className="truncate max-w-[150px] sm:max-w-none">Open Agent Assistant</span>
              <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] font-normal px-1.5 py-0.5 rounded-md ml-1">GPT-4o + Playwright</Badge>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
            </div>
          </div>

          {/* Agent Phase Badges indicator */}
          <div className="flex items-center gap-1.5 max-w-[60vw] overflow-x-auto whitespace-nowrap scrollbar-none">
            <span className="text-xs text-muted-foreground hidden sm:inline">Phase:</span>
            {(["planning", "executing", "reviewing", "done"] as const).map((p) => {
              const active = currentTask?.phase === p;
              return (
                <Badge
                  key={p}
                  variant={active ? "default" : "outline"}
                  className={`${!active ? "hidden sm:inline-flex" : "inline-flex"} text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md ${
                    active 
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs animate-pulse" 
                      : "text-muted-foreground border-border bg-transparent"
                  }`}
                >
                  {p}
                </Badge>
              );
            })}
          </div>
        </header>

        {viewMode === "settings" ? (
          <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto w-full space-y-6">
            <div className="border-b border-border pb-4">
              <h1 className="text-xl font-semibold text-foreground">Settings & Telemetry</h1>
              <p className="text-xs text-muted-foreground">Manage your agent assistant preferences, Playwright browser engine, and OAuth security scope.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-border bg-card rounded-2xl shadow-xs">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-primary" />
                    <span>Active LLM & Tool Engine</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs text-muted-foreground">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Model Architecture</label>
                    <Input disabled value="Built-in Forge LLM with Structured ReAct" className="bg-muted text-xs rounded-xl" />
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">Browser Automation</label>
                    <Input disabled value="Playwright Headless Chromium (Active)" className="bg-muted text-xs rounded-xl" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card rounded-2xl shadow-xs">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <span>Authentication & Security</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs text-muted-foreground">
                  <div>
                    <label className="font-medium text-foreground block mb-1">Provider</label>
                    <Input disabled value="Manus OAuth 2.0 Secure Session" className="bg-muted text-xs rounded-xl" />
                  </div>
                  <div>
                    <label className="font-medium text-foreground block mb-1">User OpenID</label>
                    <Input disabled value={user?.openId || "N/A"} className="bg-muted text-xs rounded-xl" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
            {/* Multi-step Planner Timeline / Agent Inspector */}
            {subtasks.length > 0 && (
              <div className="border-b border-border bg-muted/30 px-6 py-3 flex-shrink-0">
                <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                  <span>Autonomous Execution Plan ({subtasks.filter(s => s.status === 'completed').length}/{subtasks.length} completed)</span>
                  <span className="text-[10px] text-primary">Playwright & ReAct Active</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {subtasks.map((sub, idx) => (
                    <div key={sub.id} className="p-2.5 rounded-xl border border-border bg-card text-xs space-y-1 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[10px] text-primary">Step {idx + 1}</span>
                        <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0">
                          {sub.status}
                        </Badge>
                      </div>
                      <div className="truncate text-foreground font-medium">{sub.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Messages Area (ChatGPT style centered stream) */}
            <ScrollArea className="flex-1 min-h-0 px-3 py-4 sm:px-4 sm:py-6">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 max-w-lg mx-auto py-24">
                  <div className="p-4 bg-secondary rounded-2xl text-foreground shadow-sm">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">What can I help with today?</h2>
                  <p className="text-xs text-muted-foreground">
                    Ask me to research complex topics, browse live webpages with Playwright, or execute multi-step programming tasks.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-4">
                    <button
                      onClick={() => setPromptInput("Browse https://github.com and summarize trending repositories")}
                      className="p-3 rounded-xl border border-border bg-card hover:bg-accent text-left text-xs font-medium transition"
                    >
                      Browse GitHub trending & summarize →
                    </button>
                    <button
                      onClick={() => setPromptInput("Research quantum computing breakthroughs in 2026")}
                      className="p-3 rounded-xl border border-border bg-card hover:bg-accent text-left text-xs font-medium transition"
                    >
                      Research quantum computing breakthroughs →
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
                    <span className="font-medium text-foreground">Tool execution logs</span>
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
                    placeholder="Message Open Agent Assistant..."
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
                  Open Agent Assistant can make mistakes. Built with Manus OAuth & Playwright automation.
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
