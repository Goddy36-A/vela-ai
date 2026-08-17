import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Terminal, Settings, Plus, History, LogOut, Cpu, ShieldCheck, Activity, Layers, CheckCircle2 } from "lucide-react";
import { Streamdown } from "streamdown";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<"new" | "history" | "settings">("new");
  const [promptInput, setPromptInput] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

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
      <div className="min-h-screen blueprint-grid flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-card/95 backdrop-blur border border-cyan-500/40 p-8 rounded-lg shadow-2xl text-center space-y-6">
          <div className="inline-flex p-4 bg-cyan-500/10 rounded-full border border-cyan-500/30 text-cyan-600">
            <Cpu className="w-10 h-10 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight uppercase font-mono-tech">Open Agent Assistant</h1>
            <p className="text-xs text-muted-foreground font-mono-tech">
              Autonomous multi-agent orchestration console inspired by technical blueprints and algebraic precision.
            </p>
          </div>
          <div className="p-4 bg-muted/60 rounded border border-border text-xs text-left space-y-1 font-mono-tech">
            <div className="text-cyan-600 font-semibold">// SYSTEM SECURITY GATEWAY</div>
            <div>• Manus OAuth 2.0 Secure Handshake</div>
            <div>• Isolated Per-User Task Scoping</div>
          </div>
          <Button 
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono-tech tracking-wider uppercase py-6 shadow-lg shadow-cyan-500/20"
            onClick={() => startLogin()}
          >
            Authenticate via Manus OAuth
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row blueprint-grid font-mono-tech">
      {/* Sidebar */}
      <aside className="w-full md:w-80 border-r border-cyan-500/25 bg-card/90 backdrop-blur flex flex-col justify-between p-4 space-y-4">
        <div className="space-y-6">
          <div className="flex items-center space-x-3 px-2 py-3 border-b border-cyan-500/20">
            <div className="p-2 bg-cyan-500/10 rounded border border-cyan-500/30 text-cyan-600">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wide text-foreground uppercase">Agent Console</h2>
              <p className="text-[10px] text-cyan-600 font-semibold">// SECURE MULTI-AGENT</p>
            </div>
          </div>

          <nav className="space-y-1">
            <Button
              variant={activeSection === "new" ? "secondary" : "ghost"}
              className="w-full justify-start space-x-2 text-xs uppercase font-bold tracking-wider"
              onClick={() => setActiveSection("new")}
            >
              <Plus className="w-4 h-4 text-cyan-600" />
              <span>New Task Session</span>
            </Button>
            <Button
              variant={activeSection === "history" ? "secondary" : "ghost"}
              className="w-full justify-start space-x-2 text-xs uppercase font-bold tracking-wider"
              onClick={() => setActiveSection("history")}
            >
              <History className="w-4 h-4 text-cyan-600" />
              <span>Task History</span>
            </Button>
            <Button
              variant={activeSection === "settings" ? "secondary" : "ghost"}
              className="w-full justify-start space-x-2 text-xs uppercase font-bold tracking-wider"
              onClick={() => setActiveSection("settings")}
            >
              <Settings className="w-4 h-4 text-cyan-600" />
              <span>Settings & Telemetry</span>
            </Button>
          </nav>

          {activeSection === "history" && (
            <div className="space-y-2 pt-2">
              <div className="text-[11px] uppercase text-muted-foreground px-2 font-bold tracking-wider">Previous Executions</div>
              <ScrollArea className="h-[calc(100vh-22rem)] pr-2">
                <div className="space-y-1">
                  {tasksQuery.data?.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTaskId(t.id);
                        setActiveSection("new");
                      }}
                      className={`w-full text-left p-2 rounded text-xs transition border ${
                        selectedTaskId === t.id 
                          ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-700 dark:text-cyan-300 font-bold shadow-sm" 
                          : "hover:bg-muted/50 border-transparent text-muted-foreground"
                      }`}
                    >
                      <div className="truncate">{t.title}</div>
                      <div className="flex items-center justify-between mt-1 text-[10px] opacity-75">
                        <span className="uppercase text-cyan-600 font-semibold">{t.phase}</span>
                        <span>{new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* User profile footer */}
        <div className="pt-4 border-t border-cyan-500/20 flex items-center justify-between bg-muted/30 p-2 rounded">
          <div className="truncate">
            <div className="text-xs font-bold text-foreground truncate">{user?.name || "Operator"}</div>
            <div className="text-[10px] text-muted-foreground truncate">{user?.email || "Authenticated"}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => logout()} title="Logout">
            <LogOut className="w-4 h-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
        {activeSection === "settings" ? (
          <div className="flex-1 p-8 overflow-y-auto space-y-6">
            <div className="border-b border-cyan-500/25 pb-4">
              <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">Console Settings & Telemetry</h1>
              <p className="text-xs text-muted-foreground">Inspect active model configurations, system status, and security scopes.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
              <Card className="border-cyan-500/30 bg-card/70 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wider flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-cyan-600" />
                    <span>LLM Engine & Reasoning</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs text-muted-foreground">
                  <div>
                    <label className="font-bold text-foreground block mb-1">Active Model Engine</label>
                    <Input disabled value="Built-in Forge LLM (High Precision)" className="font-mono-tech text-xs bg-muted" />
                  </div>
                  <div>
                    <label className="font-bold text-foreground block mb-1">Execution Mode</label>
                    <Input disabled value="Multi-Step Autonomous ReAct Loop" className="font-mono-tech text-xs bg-muted" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-cyan-500/30 bg-card/70 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wider flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-pink-600" />
                    <span>Authentication & Sandbox Security</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs text-muted-foreground">
                  <div>
                    <label className="font-bold text-foreground block mb-1">Auth Protocol</label>
                    <Input disabled value="Manus OAuth 2.0 (Verified)" className="font-mono-tech text-xs bg-muted" />
                  </div>
                  <div>
                    <label className="font-bold text-foreground block mb-1">Operator OpenID</label>
                    <Input disabled value={user?.openId || "N/A"} className="font-mono-tech text-xs bg-muted" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Top Bar / Task Header */}
            <header className="border-b border-cyan-500/25 px-6 py-4 bg-card/60 backdrop-blur flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="text-[11px] uppercase text-cyan-600 font-bold tracking-wider">Active Task:</div>
                <div className="text-xs font-bold text-foreground truncate max-w-md bg-muted/40 px-3 py-1 rounded border border-border">
                  {currentTask ? currentTask.title : "No task selected — create one below"}
                </div>
              </div>

              {/* Agent Status Indicator with exact phases: planning, executing, reviewing, done */}
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Phase:</span>
                {(["planning", "executing", "reviewing", "done"] as const).map((p) => {
                  const active = currentTask?.phase === p;
                  return (
                    <Badge
                      key={p}
                      variant={active ? "default" : "outline"}
                      className={`text-[10px] uppercase tracking-wider ${
                        active 
                          ? "bg-cyan-600 text-slate-950 font-bold border-cyan-500 shadow-md animate-pulse" 
                          : "text-muted-foreground border-border"
                      }`}
                    >
                      {p}
                    </Badge>
                  );
                })}
              </div>
            </header>

            {/* Content split: Left = Chat & Timeline, Right = Tool Logs */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
              {/* Left 2 Cols: Chat & Planner Timeline */}
              <div className="lg:col-span-2 flex flex-col border-r border-cyan-500/25 overflow-hidden">
                {/* Multi-step Planner Timeline Widget */}
                {subtasks.length > 0 && (
                  <div className="border-b border-cyan-500/25 p-4 bg-muted/20">
                    <div className="text-[11px] uppercase font-bold text-cyan-600 tracking-wider mb-2 flex items-center space-x-2">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Execution Planner & Subtasks Progress</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {subtasks.map((sub, idx) => (
                        <div key={sub.id} className="p-2.5 rounded border border-cyan-500/30 bg-card/80 text-xs space-y-1 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[10px] text-cyan-600">STEP {idx + 1}</span>
                            <Badge variant="outline" className="text-[9px] uppercase">
                              {sub.status}
                            </Badge>
                          </div>
                          <div className="truncate text-foreground font-semibold">{sub.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chat Messages Stream */}
                <ScrollArea className="flex-1 p-6 space-y-4">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-24 text-muted-foreground">
                      <div className="p-4 bg-cyan-500/10 rounded-full border border-cyan-500/30 text-cyan-600">
                        <Activity className="w-10 h-10 animate-pulse" />
                      </div>
                      <div className="text-sm font-bold uppercase tracking-wider text-foreground">Submit a natural language task below</div>
                      <p className="text-xs max-w-md">
                        The autonomous agent will plan multi-step workflows, execute tools, review outputs, and synthesize professional research reports with algebraic precision.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-w-3xl mx-auto">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-4 rounded-lg border shadow-xs ${
                            msg.role === "user"
                              ? "bg-cyan-500/10 border-cyan-500/35 ml-8"
                              : "bg-card/90 border-border mr-8"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600">
                              {msg.role}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="prose dark:prose-invert text-xs max-w-none">
                            <Streamdown>{msg.content}</Streamdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Prompt Submission Bar */}
                <div className="p-4 border-t border-cyan-500/25 bg-card/60 backdrop-blur">
                  <form onSubmit={handleCreateTask} className="flex gap-2 max-w-3xl mx-auto">
                    <Input
                      value={promptInput}
                      onChange={(e) => setPromptInput(e.target.value)}
                      placeholder="Enter a complex task for the autonomous agent (e.g., 'Analyze the macroeconomic impact of AI in 2026')..."
                      className="font-mono-tech text-xs bg-background border-cyan-500/35 flex-1 py-6 shadow-xs"
                      disabled={createTaskMutation.isPending}
                    />
                    <Button
                      type="submit"
                      disabled={createTaskMutation.isPending || !promptInput.trim()}
                      className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-6 shadow-md shadow-cyan-500/20"
                    >
                      {createTaskMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </div>

              {/* Right Col: Tool Execution Console & Live Logs */}
              <div className="flex flex-col bg-muted/15 border-t lg:border-t-0 border-cyan-500/25 overflow-hidden">
                <div className="p-3 border-b border-cyan-500/25 bg-card/80 flex items-center justify-between">
                  <div className="text-xs uppercase font-bold tracking-wider flex items-center space-x-2 text-cyan-700 dark:text-cyan-300">
                    <Terminal className="w-4 h-4 text-cyan-600" />
                    <span>Tool Telemetry & Logs</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-600 border-cyan-500/30">Live Stream</Badge>
                </div>

                <ScrollArea className="flex-1 p-4 font-mono text-[11px] space-y-3">
                  {toolLogs.length === 0 ? (
                    <div className="text-muted-foreground text-center py-16 space-y-2">
                      <Terminal className="w-8 h-8 mx-auto opacity-40" />
                      <div>No tool telemetry captured yet.</div>
                    </div>
                  ) : (
                    toolLogs.map((log) => (
                      <div key={log.id} className="p-3 rounded border border-cyan-500/30 bg-card/95 space-y-2 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-cyan-600 uppercase">[{log.toolName}]</span>
                          <Badge
                            variant={log.status === "success" ? "default" : "destructive"}
                            className="text-[9px] uppercase"
                          >
                            {log.status}
                          </Badge>
                        </div>
                        {log.inputArgs && (
                          <div className="bg-muted p-2 rounded text-[10px] text-muted-foreground overflow-x-auto border border-border">
                            <span className="font-semibold text-foreground">Args:</span> {log.inputArgs}
                          </div>
                        )}
                        {log.outputResult && (
                          <div className="bg-cyan-500/5 p-2 rounded text-[10px] text-cyan-800 dark:text-cyan-200 overflow-x-auto border border-cyan-500/25">
                            <span className="font-semibold text-foreground">Output:</span> {log.outputResult}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
