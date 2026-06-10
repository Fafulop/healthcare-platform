# Agente Fiscal Inteligente — Research & Architecture

**Date:** 2026-06-03
**Status:** Research complete, ready to build
**Goal:** Create an LLM agent expert in flujo de dinero, SAT, facturacion, conciliacion bancaria

---

## 1. Technology Options Evaluated

### Option A: Claude Agent SDK (RECOMMENDED)

**What is it:** The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is Anthropic's official library that gives you the same agent loop, tools, and context management that power Claude Code — programmable in Python and TypeScript.

**Key capabilities:**
- **Built-in tools:** Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch
- **Custom tools:** Define your own tools as functions the agent can call
- **Subagents:** Spawn specialized agents for focused subtasks
- **Hooks:** Run custom code at key lifecycle points (PreToolUse, PostToolUse, Stop, etc.)
- **Sessions:** Maintain context across multiple exchanges, resume later
- **MCP integration:** Connect to external systems via Model Context Protocol
- **Permissions:** Fine-grained control over what tools the agent can use

**Installation:**
```bash
npm install @anthropic-ai/claude-agent-sdk
```

**Basic usage (TypeScript):**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Analiza mis deducciones de este ano y dime si estoy optimizando",
  options: {
    allowedTools: ["Read", "Bash", "WebSearch"],
    agents: {
      "fiscal-expert": {
        description: "Experto en fiscalidad mexicana para medicos regimen 612/626",
        prompt: "Eres un asesor fiscal experto en Mexico para medicos...",
        tools: ["Read", "Bash", "Grep"]
      }
    }
  }
})) {
  console.log(message);
}
```

**Subagent pattern:**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Use the fiscal-expert agent to review deductions",
  options: {
    allowedTools: ["Read", "Glob", "Grep", "Agent"],
    agents: {
      "fiscal-expert": {
        description: "Expert fiscal advisor for Mexican doctors",
        prompt: "Analyze tax optimization opportunities...",
        tools: ["Read", "Glob", "Grep"]
      }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

**Hooks example (audit logging):**
```typescript
import { query, HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { appendFile } from "fs/promises";

const logToolUse: HookCallback = async (input) => {
  const toolName = (input as any).tool_name ?? "unknown";
  await appendFile("./fiscal-agent-audit.log",
    `${new Date().toISOString()}: tool=${toolName}\n`);
  return {};
};

for await (const message of query({
  prompt: "Calcula mi ISR provisional de mayo",
  options: {
    permissionMode: "acceptEdits",
    hooks: {
      PostToolUse: [{ matcher: ".*", hooks: [logToolUse] }]
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

**Session persistence (multi-turn):**
```typescript
let sessionId: string | undefined;

// First query
for await (const message of query({
  prompt: "Lee mis CFDIs recibidos de este ano",
  options: { allowedTools: ["Read", "Glob"] }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// Resume with context
for await (const message of query({
  prompt: "Ahora clasifica las deducciones y dime cuanto puedo deducir",
  options: { resume: sessionId }
})) {
  if ("result" in message) console.log(message.result);
}
```

**Pricing note (June 2026):** Starting June 15, 2026, Agent SDK usage on subscription plans draws from a separate monthly Agent SDK credit. For API key auth, standard per-token pricing applies.

**Sources:**
- https://code.claude.com/docs/en/agent-sdk/overview
- https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk
- https://github.com/anthropics/claude-agent-sdk-python
- https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk

---

### Option B: MCP Server (Model Context Protocol)

**What is it:** MCP is Anthropic's open standard for connecting AI models to external tools and data sources. You build a server that exposes your fiscal data as tools, and any MCP-compatible client can connect.

**Key facts (2026):**
- Over 10,000 public MCP servers exist across registries
- Community servers for PostgreSQL, GitHub, Slack, Stripe, Docker, Kubernetes, etc.
- 2026 roadmap added OAuth 2.1, MCP Gateways, formal audit support
- July 2026 release: stateless HTTP core, server-rendered UIs (MCP Apps), Tasks extension
- Supported by Claude Desktop, Claude Code, VS Code, and many other clients

**Architecture:**
```
MCP Server (your fiscal data)
  |-- Tool: get_deducciones(year) -> categorized deductions
  |-- Tool: get_declaracion(year, month) -> ISR/IVA calculation
  |-- Tool: get_cobranza(year) -> aging report
  |-- Tool: check_deducibilidad(year) -> deductibility alerts
  |-- Tool: get_resumen_fiscal(year) -> annual summary
  |-- Tool: get_calendario() -> upcoming fiscal deadlines
  |-- Tool: get_cfdi_details(uuid) -> CFDI XML details
  |-- Resource: fiscal_profile -> doctor's regimen, RFC, etc.
```

**How it connects to Agent SDK:**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Analiza mi situacion fiscal",
  options: {
    mcpServers: {
      "fiscal-data": {
        command: "node",
        args: ["./mcp-fiscal-server.js"]
      }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

**Pros:** Reusable across any AI client, standardized protocol, decoupled from specific LLM
**Cons:** More infrastructure (separate server process), additional complexity

**Sources:**
- https://www.essamamdani.com/blog/complete-guide-model-context-protocol-mcp-2026
- https://github.com/modelcontextprotocol
- https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/

---

### Option C: Raw API Tool Use

**What is it:** Use the Anthropic Messages API directly with function calling. You define tools as JSON schemas, Claude decides when to call them, and you execute the tool calls yourself.

**Pattern:**
```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const tools = [{
  name: "consultar_deducciones",
  description: "Consulta las deducciones categorizadas del doctor para un ano fiscal",
  input_schema: {
    type: "object" as const,
    properties: { year: { type: "number" } },
    required: ["year"]
  }
}];

let response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  tools,
  messages: [{ role: "user", content: "Cuanto tengo en deducciones este ano?" }]
});

// You implement the tool loop
while (response.stop_reason === "tool_use") {
  const toolUse = response.content.find(b => b.type === "tool_use");
  const result = await executeMyTool(toolUse.name, toolUse.input);
  response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    tools,
    messages: [
      ...previousMessages,
      { role: "assistant", content: response.content },
      { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) }] }
    ]
  });
}
```

**Pros:** Simplest integration, no extra dependencies, fits existing Next.js API
**Cons:** You implement the tool loop, less autonomous, more boilerplate

**Sources:**
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview

---

## 2. Domain Knowledge Architecture

### Research findings on domain-specific agents

A 2026 research paper (arXiv:2601.15153) demonstrated a framework for building domain-expert AI agents with a **206% improvement** in output quality using:

1. **Request classifier** — routes queries to appropriate handler
2. **RAG for domain-specific code/data** — retrieves relevant context
3. **Codified expert rules** — hard-coded business rules the LLM must follow
4. **Clear separation of concerns** — each component has a single responsibility

**Best practices from the research:**
- Specialized agents focused on specific expertise areas produce more precise responses than generalist approaches
- Multi-layered verification systems should validate LLM responses against source documents
- Include confidence scoring and source attribution
- For massive datasets, expose database query tools rather than raw data

**Sources:**
- https://arxiv.org/html/2601.15153v1
- https://www.superannotate.com/blog/llm-agents

---

## 3. Proposed Architecture for Agente Fiscal

### System prompt (domain knowledge)

The agent's system prompt would encode all Mexican fiscal rules relevant to doctors:

```
Eres un asesor fiscal experto en Mexico, especializado en medicos
bajo Regimen 612 (Actividades Empresariales y Profesionales) y
Regimen 626 (RESICO).

CONOCIMIENTO FISCAL:
- ISR Art. 96: tabla progresiva mensual (11 tramos, 1.92%-35%)
- ISR Art. 113-E: RESICO tasa fija mensual (5 tramos, 1%-2.5%)
- ISR provisional es ACUMULATIVO (612) o MENSUAL (626)
- IVA siempre es mensual para ambos regimenes
- Deduccion en efectivo > $2,000 NO es deducible (Art. 105 LISR)
- Facturas canceladas NO son deducibles
- Gastos proporcionales (servicios basicos, vehiculo) solo parte profesional
- Declaracion mensual: dia 17 de cada mes (ISR + IVA + DIOT)
- Declaracion anual PF: 30 de abril
- Depreciacion equipos medicos: 10% anual (Art. 34 LISR, tasa general)
- Depreciacion computo: 30% anual (Art. 34 LISR)
- Depreciacion mobiliario: 10% anual (Art. 34 LISR)
- Vehiculo: 25% anual, tope $175k MXN

CATEGORIAS DE DEDUCCION:
- Renta de consultorio
- Insumos y material medico
- Equipo medico (depreciable 10%)
- Equipo de computo (depreciable 30%)
- Mobiliario (depreciable 10%)
- Servicios profesionales (honorarios contador, abogado)
- Seguros y fianzas
- Servicios basicos (proporcional)
- Capacitacion y desarrollo
- Vehiculo y transporte (proporcional, tope)
- Sueldos y nomina
- Otros gastos deducibles

REGLAS:
- Siempre basa tus respuestas en datos reales del doctor (usa las herramientas)
- Nunca inventes numeros — si no tienes datos, dilo
- Cita articulos de ley cuando sea relevante
- Distingue entre regimen 612 y 626 en tus calculos
- Si detectas riesgos fiscales, alertalos inmediatamente
- Recomienda acciones concretas con fechas limite
```

### Custom tools (wrapping existing API endpoints)

| Tool Name | Wraps Endpoint | Description |
|-----------|---------------|-------------|
| `get_resumen_fiscal` | `/api/sat-descarga/summary` | Resumen anual: ingresos, gastos, impuestos por mes |
| `get_deducciones` | `/api/sat-descarga/deductions` | Deducciones categorizadas con montos |
| `get_declaracion` | `/api/sat-descarga/declaration` | Calculo ISR/IVA mensual provisional |
| `get_cobranza` | `/api/sat-descarga/cashflow` | Reporte de antiguedad de saldos PPD |
| `check_deducibilidad` | `/api/sat-descarga/check-deducibility` | Alertas de deducibilidad en CFDIs |
| `get_pagos` | `/api/sat-descarga/pagos` | Estado de pagos complementarios |
| `get_cfdi_details` | `/api/sat-descarga/details` | Detalle XML de un CFDI especifico |
| `get_alertas` | `/api/sat-descarga/alerts` | Alertas de cancelaciones y nuevos CFDIs |
| `get_calendario_fiscal` | (client-side logic) | Proximas obligaciones fiscales |
| `get_facturas` | `/api/facturacion/cfdi` | Facturas emitidas |
| `get_flujo_dinero` | `/api/practice/flujo-de-dinero` | Movimientos del libro contable |

### Proposed file structure

```
apps/api/src/app/api/fiscal-agent/
  chat/route.ts          — POST: send message, stream response
  sessions/route.ts      — GET: list sessions, POST: create session
  sessions/[id]/route.ts — GET: resume session, DELETE: end session

apps/api/src/lib/
  fiscal-agent.ts        — Agent definition, system prompt, tool definitions
  fiscal-agent-tools.ts  — Custom tool implementations (API wrappers)

apps/doctor/src/app/dashboard/
  fiscal-agent/
    page.tsx             — Chat UI for the fiscal agent
```

### Data flow

```
Doctor types question in chat UI
  |
  v
POST /api/fiscal-agent/chat { message, sessionId? }
  |
  v
Agent SDK creates/resumes session with:
  - System prompt (fiscal domain knowledge)
  - Custom tools (wrapping existing endpoints)
  - Doctor's auth context (passed to tool calls)
  |
  v
Claude reasons about the question
  |-- Calls get_deducciones(2026) -> gets categorized expenses
  |-- Calls get_declaracion(2026) -> gets ISR/IVA calculations
  |-- Calls check_deducibilidad(2026) -> gets deductibility alerts
  |
  v
Claude synthesizes answer with specific numbers and recommendations
  |
  v
Stream response back to chat UI
```

---

## 4. Real-World Precedent

**LlamaIndex + Claude Agent SDK:** LlamaIndex used the Claude Agent SDK to automate income reconciliation across tax returns, pay stubs, W-2s, and bank statements. This is very similar to our use case (reconciling CFDIs, payments, and bank statements).

**Key insight:** The SDK's fit for document-intensive operational automation has been validated in production financial use cases.

---

## 5. Cost Considerations

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Best for |
|-------|----------------------|------------------------|----------|
| Claude Haiku 4.5 | $0.80 | $4.00 | Simple queries, high volume |
| Claude Sonnet 4.6 | $3.00 | $15.00 | Balanced cost/quality |
| Claude Opus 4.6 | $15.00 | $75.00 | Complex fiscal analysis |

**Recommendation:** Use **Sonnet 4.6** for the fiscal agent — good balance of cost and reasoning. Upgrade to Opus for complex multi-step analysis if needed.

**Estimated cost per conversation:**
- Average fiscal query: ~2K input tokens (system prompt + tools + message) + ~1K output
- Tool calls add ~500-1K tokens per call, typical query uses 2-3 tools
- Estimated: ~5K input + ~2K output per conversation = ~$0.045/conversation with Sonnet

---

## 6. Implementation Priority

1. **Phase 1 — API Tool Use (simplest, validate concept)**
   - Add a chat endpoint using raw Anthropic SDK with tool_use
   - Define 3-4 core tools (deducciones, declaracion, resumen)
   - Simple chat UI
   - Validate with real doctor data

2. **Phase 2 — Agent SDK (full autonomy)**
   - Migrate to Agent SDK for autonomous tool loop
   - Add all tools from the table above
   - Session persistence for multi-turn conversations
   - Hooks for audit logging

3. **Phase 3 — MCP Server (ecosystem integration)**
   - Extract tools into standalone MCP server
   - Enable Claude Desktop integration
   - Allow accountants to query directly from their tools

---

## 7. Comparison Table

| Feature | Raw API Tool Use | Agent SDK | MCP Server |
|---------|-----------------|-----------|------------|
| Complexity | Low | Medium | High |
| Autonomy | Manual tool loop | Fully autonomous | Depends on client |
| Custom tools | JSON schema | Python/TS functions | MCP protocol |
| Sessions | Manual | Built-in | Depends on client |
| Subagents | No | Yes | No |
| Hooks | No | Yes | No |
| Multi-client | No | No | Yes |
| Setup time | 2-3 hours | 4-6 hours | 8-12 hours |
| Our stack fit | Excellent (Next.js) | Excellent (TS SDK) | Good |
| Best for | MVP/prototype | Production agent | Ecosystem play |
