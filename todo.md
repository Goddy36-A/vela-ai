# Project TODO

- [x] Design and migrate database schema (tasks, subtasks, logs, messages)
- [x] Implement backend tRPC router for agent task creation, streaming, and history retrieval
- [x] Integrate built-in LLM for structured planning, tool selection, and response generation with streaming
- [x] Implement agent runtime with exact phases: planning, executing, reviewing, done
- [x] Build sidebar with task history, new task creation, and settings
- [x] Implement multi-step task planner widget and live tool execution log viewer
- [x] Add vitest unit tests for agent execution and tRPC procedures
- [x] Install Playwright and configure browser automation helper
- [x] Redesign UI into a real ChatGPT-clone workspace (sans-serif fonts, collapsible sidebar, centered chat stream, floating composer, model selector, tool log drawer)
- [x] Implement collapsible tool-log inspector drawer and live step telemetry
- [x] Add chat management controls (rename, clear history, delete chat session)
- [x] Securely request GitHub PAT and validate via Vitest
- [x] Create public GitHub repository Goddy36-A/vela-ai and push current project code
- [x] Save checkpoint and verify deployment readiness
