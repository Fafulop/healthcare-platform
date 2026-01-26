# LLM ASSISTANT TECHNICAL SPECIFICATION

## Document Metadata

```yaml
version: "1.0.0"
created: "2026-01-25"
purpose: "Machine-readable technical specification for LLM implementation"
target_reader: "LLM or developer implementing the system"
language: "English (code), Spanish (user-facing content)"
status: "AUTHORITATIVE"
```

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Technology Stack](#3-technology-stack)
4. [Implementation Constants](#4-implementation-constants)
5. [Database Layer](#5-database-layer)
6. [Data Types & Interfaces](#6-data-types--interfaces)
7. [Documentation Lifecycle Management](#7-documentation-lifecycle-management)
8. [Offline Ingestion Pipeline](#8-offline-ingestion-pipeline)
9. [Runtime Query Pipeline](#9-runtime-query-pipeline)
10. [Module Detection Algorithm](#10-module-detection-algorithm)
11. [Vector Retrieval](#11-vector-retrieval)
12. [Chunk Deduplication](#12-chunk-deduplication)
13. [Memory Management](#13-memory-management)
14. [Prompt Assembly](#14-prompt-assembly)
15. [LLM API Integration](#15-llm-api-integration)
16. [Caching Layer](#16-caching-layer)
17. [Error Handling](#17-error-handling)
18. [API Endpoints](#18-api-endpoints)
19. [File Structure](#19-file-structure)
20. [Testing Requirements](#20-testing-requirements)
21. [Security Considerations](#21-security-considerations)

---

## 1. SYSTEM OVERVIEW

### 1.1 Purpose

This system implements a **read-only in-app assistant** that answers user questions about the Portal Médico application functionality using **grounded documentation retrieval**.

### 1.2 Core Principles

```
PRINCIPLE_1: GROUNDED_ONLY
  The assistant MUST ONLY answer using retrieved documentation.
  The assistant MUST NOT invent UI elements, buttons, or features.
  The assistant MUST NOT hallucinate capabilities.

PRINCIPLE_2: READ_ONLY
  The assistant MUST NOT perform actions in the application.
  The assistant MUST NOT modify data.
  The assistant provides information only.

PRINCIPLE_3: EXPLICIT_LIMITATIONS
  When information is not found, the assistant MUST say so explicitly.
  When a feature does not exist, the assistant MUST state this clearly.
  The assistant MUST NOT speculate about future features.

PRINCIPLE_4: DETERMINISTIC_BEHAVIOR
  Same question + same documentation = same retrieval.
  Token usage MUST be predictable.
  Responses MUST be consistent.
```

### 1.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Answer questions about app functionality | MUST |
| FR-002 | Retrieve relevant documentation chunks | MUST |
| FR-003 | Maintain short-term conversation context | MUST |
| FR-004 | Indicate source module of information | SHOULD |
| FR-005 | Handle "I don't know" gracefully | MUST |
| FR-006 | Support Spanish language | MUST |
| FR-007 | Cache common queries | SHOULD |
| FR-008 | Detect user intent/module | MUST |

### 1.4 Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | Response latency | < 3 seconds |
| NFR-002 | Token budget per request | < 4000 tokens |
| NFR-003 | Retrieval accuracy | > 85% relevant chunks |
| NFR-004 | Uptime | 99.5% |
| NFR-005 | Concurrent users | 100+ |

---

## 2. ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SYSTEM ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    OFFLINE PIPELINE (One-time / On-change)          │   │
│  │                                                                     │   │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐  │   │
│  │  │ Markdown │───▶│  Parser  │───▶│ Chunker  │───▶│  Embedding   │  │   │
│  │  │  Files   │    │          │    │          │    │    API       │  │   │
│  │  └──────────┘    └──────────┘    └──────────┘    └──────┬───────┘  │   │
│  │                                                          │          │   │
│  │                                                          ▼          │   │
│  │                                                   ┌──────────────┐  │   │
│  │                                                   │  PostgreSQL  │  │   │
│  │                                                   │  (pgvector)  │  │   │
│  │                                                   └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    RUNTIME PIPELINE (Per-request)                   │   │
│  │                                                                     │   │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐  │   │
│  │  │   User   │───▶│  Cache   │───▶│  Module  │───▶│   Question   │  │   │
│  │  │ Question │    │  Check   │    │ Detector │    │  Embedding   │  │   │
│  │  └──────────┘    └──────────┘    └──────────┘    └──────┬───────┘  │   │
│  │                       │                                  │          │   │
│  │                       │ (cache hit)                      ▼          │   │
│  │                       │                          ┌──────────────┐   │   │
│  │                       │                          │   Vector     │   │   │
│  │                       │                          │   Search     │   │   │
│  │                       │                          └──────┬───────┘   │   │
│  │                       │                                  │          │   │
│  │                       │                                  ▼          │   │
│  │                       │                          ┌──────────────┐   │   │
│  │                       │                          │  Deduplicate │   │   │
│  │                       │                          │   & Rank     │   │   │
│  │                       │                          └──────┬───────┘   │   │
│  │                       │                                  │          │   │
│  │                       │                                  ▼          │   │
│  │                       │         ┌──────────┐    ┌──────────────┐   │   │
│  │                       │         │  Memory  │───▶│   Prompt     │   │   │
│  │                       │         │  Store   │    │  Assembly    │   │   │
│  │                       │         └──────────┘    └──────┬───────┘   │   │
│  │                       │                                  │          │   │
│  │                       │                                  ▼          │   │
│  │                       │                          ┌──────────────┐   │   │
│  │                       └─────────────────────────▶│   LLM API    │   │   │
│  │                                                  │  (Answer)    │   │   │
│  │                                                  └──────┬───────┘   │   │
│  │                                                          │          │   │
│  │                                                          ▼          │   │
│  │                                                  ┌──────────────┐   │   │
│  │                                                  │   Response   │   │   │
│  │                                                  │   + Cache    │   │   │
│  │                                                  └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. TECHNOLOGY STACK

### 3.1 Authoritative Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Runtime | Node.js | >= 18.x | Server execution |
| Framework | Next.js | >= 14.x | API routes, integration |
| Database | PostgreSQL | >= 15.x | Data storage |
| Vector Extension | pgvector | >= 0.5.0 | Similarity search |
| LLM Provider | Anthropic Claude | claude-3-haiku | Answer generation |
| Embedding Provider | OpenAI | text-embedding-3-small | Vector embeddings |
| Cache | Redis (optional) | >= 7.x | Query caching |
| ORM | Prisma | >= 5.x | Database access |

### 3.2 Explicitly Excluded

```
EXCLUDED_TECHNOLOGIES:
  - Supabase (use raw PostgreSQL)
  - Pinecone (use pgvector)
  - LangChain (implement directly)
  - Vercel AI SDK (implement directly)
  - Client-side LLM calls (server-only)
  - Vector databases as services (use PostgreSQL)
```

### 3.3 External API Dependencies

```typescript
interface ExternalAPIs {
  embedding: {
    provider: "openai";
    endpoint: "https://api.openai.com/v1/embeddings";
    model: "text-embedding-3-small";
    dimensions: 1536;
    rateLimitRPM: 3000;
  };
  completion: {
    provider: "anthropic";
    endpoint: "https://api.anthropic.com/v1/messages";
    model: "claude-3-haiku-20240307";
    maxTokens: 1024;
    rateLimitRPM: 1000;
  };
}
```

---

## 4. IMPLEMENTATION CONSTANTS

### 4.1 Core Constants

```typescript
// File: src/lib/llm-assistant/constants.ts

export const LLM_ASSISTANT_CONFIG = {
  // Embedding Configuration
  EMBEDDING_MODEL: "text-embedding-3-small",
  EMBEDDING_DIMENSIONS: 1536,
  EMBEDDING_BATCH_SIZE: 100,

  // Chunking Configuration
  CHUNK_SIZE_TARGET_TOKENS: 400,
  CHUNK_SIZE_MAX_TOKENS: 500,
  CHUNK_SIZE_MIN_TOKENS: 100,
  CHUNK_OVERLAP_TOKENS: 80,

  // Retrieval Configuration
  RETRIEVAL_LIMIT: 5,
  RETRIEVAL_LIMIT_MAX: 8,
  SIMILARITY_THRESHOLD: 0.65,
  SIMILARITY_THRESHOLD_STRICT: 0.75,

  // Token Budgets
  TOKEN_BUDGET_SYSTEM_PROMPT: 500,
  TOKEN_BUDGET_STATIC_CONTEXT: 300,
  TOKEN_BUDGET_RETRIEVED_DOCS: 1200,
  TOKEN_BUDGET_MEMORY: 400,
  TOKEN_BUDGET_USER_QUESTION: 200,
  TOKEN_BUDGET_TOTAL_INPUT: 2600,
  TOKEN_BUDGET_OUTPUT: 1024,

  // Memory Configuration
  MEMORY_MAX_TURNS: 2,
  MEMORY_RESET_ON_MODULE_CHANGE: true,

  // Cache Configuration
  CACHE_TTL_SECONDS: 3600,
  CACHE_MAX_ENTRIES: 1000,

  // LLM Configuration
  LLM_TEMPERATURE: 0.1,
  LLM_TOP_P: 0.9,
  LLM_MODEL: "claude-3-haiku-20240307",

  // Application Metadata
  APP_NAME: "Portal Médico",
  APP_LANGUAGE: "es",
  DOCS_BASE_PATH: "docs/llm-assistant",
} as const;
```

### 4.2 Module Definitions

```typescript
// File: src/lib/llm-assistant/modules.ts

export const MODULE_DEFINITIONS = {
  "medical-records": {
    id: "medical-records",
    name: "Expedientes Médicos",
    description: "Gestión de pacientes, consultas, recetas, multimedia y línea de tiempo",
    keywords: [
      "paciente", "pacientes", "expediente", "expedientes",
      "consulta", "consultas", "encuentro", "encuentros",
      "receta", "recetas", "prescripción", "medicamento",
      "foto", "fotos", "archivo", "archivos", "multimedia",
      "historial", "timeline", "línea de tiempo"
    ],
    submodules: ["patients", "encounters", "prescriptions", "media", "timeline"],
    paths: [
      "modules/medical-records/overview.md",
      "modules/medical-records/patients.md",
      "modules/medical-records/encounters.md",
      "modules/medical-records/prescriptions.md",
      "modules/medical-records/media.md",
      "modules/medical-records/timeline.md"
    ]
  },
  "appointments": {
    id: "appointments",
    name: "Citas",
    description: "Gestión de disponibilidad, espacios de cita y reservaciones de pacientes",
    keywords: [
      "cita", "citas", "agenda", "calendario",
      "espacio", "espacios", "horario", "horarios",
      "reservación", "reservaciones", "booking",
      "disponibilidad", "bloquear", "cancelar"
    ],
    submodules: ["slots", "bookings"],
    paths: [
      "modules/appointments/overview.md",
      "modules/appointments/slots.md",
      "modules/appointments/bookings.md"
    ]
  },
  "practice-management": {
    id: "practice-management",
    name: "Gestión de Consultorio",
    description: "Ventas, compras, flujo de dinero, productos, clientes y proveedores",
    keywords: [
      "venta", "ventas", "compra", "compras",
      "flujo", "dinero", "ingreso", "ingresos", "egreso", "egresos",
      "producto", "productos", "inventario",
      "cliente", "clientes", "proveedor", "proveedores",
      "factura", "pago", "cobro", "cotización"
    ],
    submodules: ["sales", "purchases", "cash-flow", "products", "clients", "suppliers"],
    paths: [
      "modules/practice-management/overview.md",
      "modules/practice-management/sales.md",
      "modules/practice-management/purchases.md",
      "modules/practice-management/cash-flow.md",
      "modules/practice-management/products.md",
      "modules/practice-management/clients.md",
      "modules/practice-management/suppliers.md"
    ]
  },
  "blog": {
    id: "blog",
    name: "Blog",
    description: "Publicación de artículos en el perfil público del médico",
    keywords: [
      "blog", "artículo", "artículos", "publicar", "publicación",
      "borrador", "borradores", "post", "escribir"
    ],
    submodules: [],
    paths: [
      "modules/blog.md"
    ]
  },
  "voice-assistant": {
    id: "voice-assistant",
    name: "Asistente de Voz",
    description: "Funcionalidad de dictado por voz con transcripción e IA",
    keywords: [
      "voz", "dictar", "dictado", "micrófono", "grabar",
      "transcripción", "audio", "hablar", "asistente de voz"
    ],
    submodules: [],
    paths: [
      "features/voice-assistant.md"
    ]
  },
  "navigation": {
    id: "navigation",
    name: "Navegación",
    description: "Cómo navegar por la aplicación, menús y rutas",
    keywords: [
      "menú", "navegación", "navegar", "ir a", "dónde está",
      "cómo llego", "ruta", "página", "sección", "botón"
    ],
    submodules: [],
    paths: [
      "features/navigation.md"
    ]
  },
  "general": {
    id: "general",
    name: "General",
    description: "Información general de la aplicación y preguntas frecuentes",
    keywords: [
      "qué es", "para qué sirve", "cómo funciona",
      "ayuda", "soporte", "problema", "error"
    ],
    submodules: [],
    paths: [
      "index.md",
      "faq.md"
    ]
  }
} as const;

export type ModuleId = keyof typeof MODULE_DEFINITIONS;
```

---

## 5. DATABASE LAYER

### 5.1 PostgreSQL Extension Setup

```sql
-- File: prisma/migrations/001_enable_pgvector.sql

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### 5.2 Schema Definition (Prisma)

```prisma
// File: prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector, pgcrypto]
}

model LlmDocsChunk {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  // Content
  content   String   @db.Text
  embedding Unsupported("vector(1536)")

  // Metadata
  module    String   @db.VarChar(50)
  submodule String?  @db.VarChar(50)
  section   String   @db.VarChar(200)
  docType   String   @map("doc_type") @db.VarChar(20)

  // Source tracking
  filePath  String   @map("file_path") @db.VarChar(500)
  heading   String?  @db.VarChar(200)

  // Metadata
  language  String   @default("es") @db.VarChar(5)
  tokenCount Int     @map("token_count")
  chunkIndex Int     @map("chunk_index")

  // Timestamps
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("llm_docs_chunks")
  @@index([module])
  @@index([docType])
}

model LlmModuleSummary {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  moduleId    String   @unique @map("module_id") @db.VarChar(50)
  name        String   @db.VarChar(100)
  description String   @db.Text
  keywords    String[] @db.VarChar(50)
  embedding   Unsupported("vector(1536)")

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("llm_module_summaries")
}

model LlmQueryCache {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  queryHash     String   @unique @map("query_hash") @db.VarChar(64)
  queryText     String   @map("query_text") @db.Text
  response      String   @db.Text
  modulesUsed   String[] @map("modules_used") @db.VarChar(50)
  chunksUsed    String[] @map("chunks_used") @db.Uuid

  hitCount      Int      @default(1) @map("hit_count")

  createdAt     DateTime @default(now()) @map("created_at")
  expiresAt     DateTime @map("expires_at")

  @@map("llm_query_cache")
  @@index([expiresAt])
}

model LlmConversationMemory {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  sessionId   String   @map("session_id") @db.VarChar(100)
  userId      String?  @map("user_id") @db.VarChar(100)

  turns       Json     @db.JsonB
  activeModule String? @map("active_module") @db.VarChar(50)

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  expiresAt   DateTime @map("expires_at")

  @@map("llm_conversation_memory")
  @@unique([sessionId])
  @@index([expiresAt])
}
```

### 5.3 Raw SQL for Vector Operations

```sql
-- File: prisma/migrations/002_vector_indexes.sql

-- Create HNSW index for vector similarity search
-- HNSW is better than IVFFlat for datasets < 100k rows
CREATE INDEX llm_docs_chunks_embedding_hnsw_idx
ON llm_docs_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create index on module summaries
CREATE INDEX llm_module_summaries_embedding_hnsw_idx
ON llm_module_summaries
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Function to search chunks by similarity
CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding vector(1536),
  target_modules text[],
  similarity_threshold float DEFAULT 0.65,
  max_results int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  module text,
  submodule text,
  section text,
  doc_type text,
  file_path text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.content,
    c.module,
    c.submodule,
    c.section,
    c.doc_type,
    c.file_path,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM llm_docs_chunks c
  WHERE
    (target_modules IS NULL OR c.module = ANY(target_modules))
    AND 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT max_results;
$$;

-- Function to detect modules by similarity
CREATE OR REPLACE FUNCTION detect_modules(
  query_embedding vector(1536),
  max_modules int DEFAULT 2
)
RETURNS TABLE (
  module_id text,
  name text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    m.module_id,
    m.name,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM llm_module_summaries m
  ORDER BY m.embedding <=> query_embedding
  LIMIT max_modules;
$$;
```

---

## 6. DATA TYPES & INTERFACES

### 6.1 Core Types

```typescript
// File: src/lib/llm-assistant/types.ts

// ============================================
// CHUNK TYPES
// ============================================

export type DocType =
  | "overview"
  | "howto"
  | "capability"
  | "limitation"
  | "faq"
  | "reference";

export interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];

  module: string;
  submodule: string | null;
  section: string;
  docType: DocType;

  filePath: string;
  heading: string | null;

  language: string;
  tokenCount: number;
  chunkIndex: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface ChunkMetadata {
  module: string;
  submodule: string | null;
  section: string;
  docType: DocType;
  filePath: string;
  heading: string | null;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  module: string;
  submodule: string | null;
  section: string;
  docType: DocType;
  filePath: string;
  similarity: number;
}

// ============================================
// QUERY TYPES
// ============================================

export interface UserQuery {
  text: string;
  sessionId: string;
  userId?: string;
  timestamp: Date;
}

export interface QueryEmbedding {
  vector: number[];
  tokenCount: number;
  model: string;
}

export interface ModuleDetectionResult {
  modules: Array<{
    moduleId: string;
    name: string;
    similarity: number;
  }>;
  confidence: "high" | "medium" | "low";
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  totalTokens: number;
  modulesCovered: string[];
  averageSimilarity: number;
}

// ============================================
// MEMORY TYPES
// ============================================

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  moduleContext?: string;
}

export interface ConversationMemory {
  sessionId: string;
  userId?: string;
  turns: ConversationTurn[];
  activeModule: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface MemoryContext {
  recentTurns: ConversationTurn[];
  activeModule: string | null;
  summary?: string;
}

// ============================================
// PROMPT TYPES
// ============================================

export interface AssembledPrompt {
  systemPrompt: string;
  staticContext: string;
  memoryContext: string;
  retrievedDocs: string;
  userQuestion: string;

  tokenCounts: {
    system: number;
    static: number;
    memory: number;
    docs: number;
    question: number;
    total: number;
  };
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface AssistantResponse {
  answer: string;
  sourcesUsed: Array<{
    module: string;
    section: string;
  }>;
  confidence: "high" | "medium" | "low";
  cached: boolean;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: {
    sourcesUsed?: Array<{ module: string; section: string }>;
    cached?: boolean;
  };
}

// ============================================
// CACHE TYPES
// ============================================

export interface CachedQuery {
  queryHash: string;
  queryText: string;
  response: string;
  modulesUsed: string[];
  chunksUsed: string[];
  hitCount: number;
  createdAt: Date;
  expiresAt: Date;
}

// ============================================
// INGESTION TYPES
// ============================================

export interface ParsedSection {
  heading: string;
  content: string;
  level: number;
  startLine: number;
  endLine: number;
}

export interface ChunkingResult {
  chunks: Array<{
    content: string;
    metadata: ChunkMetadata;
    tokenCount: number;
    chunkIndex: number;
  }>;
  totalChunks: number;
  totalTokens: number;
}

export interface IngestionResult {
  filesProcessed: number;
  chunksCreated: number;
  chunksDeleted: number;
  errors: Array<{
    filePath: string;
    error: string;
  }>;
  duration: number;
}

// ============================================
// ERROR TYPES
// ============================================

export class LLMAssistantError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = "LLMAssistantError";
  }
}

export type ErrorCode =
  | "EMBEDDING_FAILED"
  | "RETRIEVAL_FAILED"
  | "NO_RELEVANT_CHUNKS"
  | "LLM_API_ERROR"
  | "MEMORY_ERROR"
  | "CACHE_ERROR"
  | "INGESTION_ERROR"
  | "INVALID_INPUT";
```

---

## 7. DOCUMENTATION LIFECYCLE MANAGEMENT

### 7.1 Overview

This section defines how documentation changes are detected, processed, and propagated to the vector database and cache.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENTATION UPDATE WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DEVELOPER WORKFLOW:                                                        │
│                                                                             │
│  1. Add/Edit feature in app code                                            │
│           │                                                                 │
│           ▼                                                                 │
│  2. Update corresponding markdown in docs/llm-assistant/                    │
│           │                                                                 │
│           ▼                                                                 │
│  3. Run: npm run docs:sync -- --module=<module-name>                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌────────────────────────────────────────────────────────────┐            │
│  │                    SYNC PROCESS                             │            │
│  │                                                             │            │
│  │  a. Detect changed files in module (hash comparison)        │            │
│  │  b. Create new doc version record                           │            │
│  │  c. Delete old chunks for changed files                     │            │
│  │  d. Re-chunk and embed changed files                        │            │
│  │  e. Invalidate cache for affected module                    │            │
│  │  f. Log change for audit trail                              │            │
│  │                                                             │            │
│  └────────────────────────────────────────────────────────────┘            │
│           │                                                                 │
│           ▼                                                                 │
│  4. Commit docs + run tests                                                 │
│           │                                                                 │
│           ▼                                                                 │
│  5. Deploy (docs already synced to DB)                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Update Strategies

```
STRATEGY: PER-MODULE INCREMENTAL WITH VERSION TRACKING

Trigger: Manual CLI command (npm run docs:sync)
Granularity: Per-module (all files in a module are re-processed together)
Versioning: Yes - maintain history of documentation versions
Cache: Invalidate module-specific cached queries

This approach balances:
- Simplicity (developer runs one command)
- Efficiency (only affected module re-processed)
- Traceability (version history for auditing)
```

### 7.3 Database Schema Additions

```prisma
// Add to prisma/schema.prisma

model LlmDocsVersion {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  version     Int      @default(autoincrement())
  moduleId    String   @map("module_id") @db.VarChar(50)

  // Change tracking
  changeType  String   @map("change_type") @db.VarChar(20) // "create" | "update" | "delete"
  filesChanged String[] @map("files_changed") @db.VarChar(500)
  chunksAdded Int      @map("chunks_added")
  chunksRemoved Int    @map("chunks_removed")

  // Metadata
  triggeredBy String?  @map("triggered_by") @db.VarChar(100) // user or "system"
  gitCommit   String?  @map("git_commit") @db.VarChar(40)
  description String?  @db.Text

  // Timestamps
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("llm_docs_versions")
  @@index([moduleId])
  @@index([createdAt])
}

model LlmDocsFileHash {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

  filePath    String   @unique @map("file_path") @db.VarChar(500)
  contentHash String   @map("content_hash") @db.VarChar(64)
  moduleId    String   @map("module_id") @db.VarChar(50)
  lastSynced  DateTime @map("last_synced")

  @@map("llm_docs_file_hashes")
  @@index([moduleId])
}
```

```sql
-- Add to migrations

-- Table for tracking document versions
CREATE TABLE llm_docs_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  version SERIAL,
  module_id VARCHAR(50) NOT NULL,

  change_type VARCHAR(20) NOT NULL,
  files_changed VARCHAR(500)[] NOT NULL,
  chunks_added INT NOT NULL DEFAULT 0,
  chunks_removed INT NOT NULL DEFAULT 0,

  triggered_by VARCHAR(100),
  git_commit VARCHAR(40),
  description TEXT,

  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX llm_docs_versions_module_idx ON llm_docs_versions(module_id);
CREATE INDEX llm_docs_versions_created_idx ON llm_docs_versions(created_at);

-- Table for tracking file content hashes
CREATE TABLE llm_docs_file_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  file_path VARCHAR(500) UNIQUE NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  module_id VARCHAR(50) NOT NULL,
  last_synced TIMESTAMP NOT NULL
);

CREATE INDEX llm_docs_file_hashes_module_idx ON llm_docs_file_hashes(module_id);

-- Add version reference to chunks table
ALTER TABLE llm_docs_chunks
ADD COLUMN version_id UUID REFERENCES llm_docs_versions(id);
```

### 7.4 CLI Commands

```typescript
// File: scripts/docs-sync.ts

import { Command } from "commander";
import { syncModule, syncAll, listModules, getStatus } from "../src/lib/llm-assistant/sync";

const program = new Command();

program
  .name("docs-sync")
  .description("Synchronize LLM assistant documentation with vector database")
  .version("1.0.0");

// Sync specific module
program
  .command("sync")
  .description("Sync documentation for a specific module")
  .requiredOption("-m, --module <moduleId>", "Module ID to sync (e.g., medical-records)")
  .option("-f, --force", "Force re-sync even if no changes detected", false)
  .option("-d, --description <text>", "Description of changes for audit log")
  .action(async (options) => {
    await syncModule({
      moduleId: options.module,
      force: options.force,
      description: options.description
    });
  });

// Sync all modules
program
  .command("sync-all")
  .description("Sync all documentation modules")
  .option("-f, --force", "Force re-sync all modules", false)
  .action(async (options) => {
    await syncAll({ force: options.force });
  });

// List available modules
program
  .command("list")
  .description("List all documentation modules and their status")
  .action(async () => {
    await listModules();
  });

// Check status
program
  .command("status")
  .description("Show sync status and pending changes")
  .option("-m, --module <moduleId>", "Check specific module only")
  .action(async (options) => {
    await getStatus({ moduleId: options.module });
  });

// Show version history
program
  .command("history")
  .description("Show documentation version history")
  .option("-m, --module <moduleId>", "Filter by module")
  .option("-n, --limit <number>", "Number of entries to show", "10")
  .action(async (options) => {
    await showHistory({
      moduleId: options.module,
      limit: parseInt(options.limit)
    });
  });

program.parse();
```

### 7.5 Package.json Scripts

```json
{
  "scripts": {
    "docs:sync": "tsx scripts/docs-sync.ts sync",
    "docs:sync-all": "tsx scripts/docs-sync.ts sync-all",
    "docs:status": "tsx scripts/docs-sync.ts status",
    "docs:list": "tsx scripts/docs-sync.ts list",
    "docs:history": "tsx scripts/docs-sync.ts history"
  }
}
```

### 7.6 Sync Implementation

```typescript
// File: src/lib/llm-assistant/sync/index.ts

import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { MODULE_DEFINITIONS, ModuleId } from "../modules";
import { LLM_ASSISTANT_CONFIG } from "../constants";
import { generateEmbeddingsBatch } from "../embedding";
import { parseMarkdownSections, chunkSection, extractMetadataFromPath } from "../ingestion/pipeline";
import { invalidateCacheForModule } from "../query/cache";

const prisma = new PrismaClient();

interface SyncOptions {
  moduleId: string;
  force?: boolean;
  description?: string;
  triggeredBy?: string;
}

interface SyncResult {
  moduleId: string;
  filesProcessed: number;
  filesChanged: number;
  chunksAdded: number;
  chunksRemoved: number;
  cacheInvalidated: number;
  versionId: string;
  duration: number;
}

// ============================================
// MAIN SYNC FUNCTION
// ============================================

export async function syncModule(options: SyncOptions): Promise<SyncResult> {
  const startTime = Date.now();
  const { moduleId, force = false, description, triggeredBy = "cli" } = options;

  console.log(`\n📚 Syncing module: ${moduleId}`);
  console.log(`   Force: ${force}`);

  // Validate module exists
  const moduleDef = MODULE_DEFINITIONS[moduleId as ModuleId];
  if (!moduleDef) {
    throw new Error(`Unknown module: ${moduleId}. Use 'docs:list' to see available modules.`);
  }

  // Get files for this module
  const basePath = LLM_ASSISTANT_CONFIG.DOCS_BASE_PATH;
  const moduleFiles = await getModuleFiles(basePath, moduleDef.paths);

  console.log(`   Found ${moduleFiles.length} files`);

  // Detect changes
  const { changedFiles, unchangedFiles } = await detectChanges(moduleFiles, force);

  if (changedFiles.length === 0) {
    console.log(`   ✅ No changes detected. Module is up to date.`);
    return {
      moduleId,
      filesProcessed: 0,
      filesChanged: 0,
      chunksAdded: 0,
      chunksRemoved: 0,
      cacheInvalidated: 0,
      versionId: "",
      duration: Date.now() - startTime
    };
  }

  console.log(`   📝 ${changedFiles.length} files changed, ${unchangedFiles.length} unchanged`);

  // Create version record
  const version = await prisma.llmDocsVersion.create({
    data: {
      moduleId,
      changeType: "update",
      filesChanged: changedFiles.map(f => f.relativePath),
      chunksAdded: 0,
      chunksRemoved: 0,
      triggeredBy,
      gitCommit: await getGitCommit(),
      description
    }
  });

  // Delete existing chunks for changed files
  const deleteResult = await prisma.$executeRaw`
    DELETE FROM llm_docs_chunks
    WHERE module = ${moduleId}
    AND file_path = ANY(${changedFiles.map(f => f.relativePath)}::text[])
  `;

  console.log(`   🗑️  Removed ${deleteResult} old chunks`);

  // Process changed files
  const allChunks: Array<{
    content: string;
    metadata: any;
    tokenCount: number;
    chunkIndex: number;
  }> = [];

  for (const file of changedFiles) {
    const content = await fs.readFile(file.absolutePath, "utf-8");
    const sections = parseMarkdownSections(content);
    const baseMetadata = extractMetadataFromPath(file.absolutePath);

    let chunkIndex = 0;
    for (const section of sections) {
      const metadata = {
        module: moduleId,
        submodule: baseMetadata.submodule || null,
        section: section.heading,
        docType: "reference",
        filePath: file.relativePath,
        heading: section.heading
      };

      const result = chunkSection(section, metadata, chunkIndex);
      allChunks.push(...result.chunks);
      chunkIndex += result.totalChunks;
    }
  }

  console.log(`   📦 Created ${allChunks.length} new chunks`);

  // Generate embeddings
  console.log(`   🧠 Generating embeddings...`);
  const embeddings = await generateEmbeddingsBatch(allChunks.map(c => c.content));

  // Insert new chunks
  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    const embedding = embeddings[i];

    await prisma.$executeRaw`
      INSERT INTO llm_docs_chunks (
        content, embedding, module, submodule, section, doc_type,
        file_path, heading, language, token_count, chunk_index, version_id
      ) VALUES (
        ${chunk.content},
        ${embedding}::vector,
        ${chunk.metadata.module},
        ${chunk.metadata.submodule},
        ${chunk.metadata.section},
        ${chunk.metadata.docType},
        ${chunk.metadata.filePath},
        ${chunk.metadata.heading},
        'es',
        ${chunk.tokenCount},
        ${chunk.chunkIndex},
        ${version.id}::uuid
      )
    `;
  }

  // Update file hashes
  for (const file of changedFiles) {
    await prisma.llmDocsFileHash.upsert({
      where: { filePath: file.relativePath },
      create: {
        filePath: file.relativePath,
        contentHash: file.hash,
        moduleId,
        lastSynced: new Date()
      },
      update: {
        contentHash: file.hash,
        lastSynced: new Date()
      }
    });
  }

  // Update version record with counts
  await prisma.llmDocsVersion.update({
    where: { id: version.id },
    data: {
      chunksAdded: allChunks.length,
      chunksRemoved: deleteResult
    }
  });

  // Invalidate cache for this module
  const cacheInvalidated = await invalidateCacheForModule(moduleId);
  console.log(`   🗑️  Invalidated ${cacheInvalidated} cached queries`);

  const duration = Date.now() - startTime;
  console.log(`   ✅ Sync completed in ${duration}ms\n`);

  return {
    moduleId,
    filesProcessed: changedFiles.length,
    filesChanged: changedFiles.length,
    chunksAdded: allChunks.length,
    chunksRemoved: deleteResult,
    cacheInvalidated,
    versionId: version.id,
    duration
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

interface FileInfo {
  absolutePath: string;
  relativePath: string;
  hash: string;
}

async function getModuleFiles(basePath: string, paths: readonly string[]): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  for (const relativePath of paths) {
    const absolutePath = path.join(basePath, relativePath);

    try {
      const content = await fs.readFile(absolutePath, "utf-8");
      const hash = createHash("sha256").update(content).digest("hex");

      files.push({
        absolutePath,
        relativePath,
        hash
      });
    } catch (error) {
      console.warn(`   ⚠️  File not found: ${relativePath}`);
    }
  }

  return files;
}

async function detectChanges(
  files: FileInfo[],
  force: boolean
): Promise<{
  changedFiles: FileInfo[];
  unchangedFiles: FileInfo[];
}> {
  if (force) {
    return { changedFiles: files, unchangedFiles: [] };
  }

  const changedFiles: FileInfo[] = [];
  const unchangedFiles: FileInfo[] = [];

  for (const file of files) {
    const stored = await prisma.llmDocsFileHash.findUnique({
      where: { filePath: file.relativePath }
    });

    if (!stored || stored.contentHash !== file.hash) {
      changedFiles.push(file);
    } else {
      unchangedFiles.push(file);
    }
  }

  return { changedFiles, unchangedFiles };
}

async function getGitCommit(): Promise<string | null> {
  try {
    const { execSync } = await import("child_process");
    const commit = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
    return commit.slice(0, 40);
  } catch {
    return null;
  }
}

// ============================================
// ADDITIONAL COMMANDS
// ============================================

export async function syncAll(options: { force?: boolean }): Promise<void> {
  console.log("\n📚 Syncing all modules...\n");

  const results: SyncResult[] = [];

  for (const moduleId of Object.keys(MODULE_DEFINITIONS)) {
    try {
      const result = await syncModule({
        moduleId,
        force: options.force
      });
      results.push(result);
    } catch (error) {
      console.error(`   ❌ Error syncing ${moduleId}:`, error);
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("SYNC SUMMARY");
  console.log("=".repeat(60));

  let totalChunksAdded = 0;
  let totalChunksRemoved = 0;
  let totalFilesChanged = 0;

  for (const result of results) {
    if (result.filesChanged > 0) {
      console.log(`\n${result.moduleId}:`);
      console.log(`   Files changed: ${result.filesChanged}`);
      console.log(`   Chunks: +${result.chunksAdded} / -${result.chunksRemoved}`);
      totalChunksAdded += result.chunksAdded;
      totalChunksRemoved += result.chunksRemoved;
      totalFilesChanged += result.filesChanged;
    }
  }

  console.log("\n" + "-".repeat(60));
  console.log(`Total: ${totalFilesChanged} files, +${totalChunksAdded}/-${totalChunksRemoved} chunks`);
  console.log("=".repeat(60) + "\n");
}

export async function listModules(): Promise<void> {
  console.log("\n📚 Available Documentation Modules\n");
  console.log("-".repeat(60));

  for (const [id, module] of Object.entries(MODULE_DEFINITIONS)) {
    const fileCount = module.paths.length;
    const chunkCount = await prisma.llmDocsChunk.count({
      where: { module: id }
    });

    console.log(`\n${module.name} (${id})`);
    console.log(`   Description: ${module.description}`);
    console.log(`   Files: ${fileCount}`);
    console.log(`   Chunks in DB: ${chunkCount}`);
  }

  console.log("\n" + "-".repeat(60) + "\n");
}

export async function getStatus(options: { moduleId?: string }): Promise<void> {
  console.log("\n📊 Documentation Sync Status\n");
  console.log("-".repeat(60));

  const modules = options.moduleId
    ? [options.moduleId]
    : Object.keys(MODULE_DEFINITIONS);

  for (const moduleId of modules) {
    const moduleDef = MODULE_DEFINITIONS[moduleId as ModuleId];
    if (!moduleDef) continue;

    const basePath = LLM_ASSISTANT_CONFIG.DOCS_BASE_PATH;
    const files = await getModuleFiles(basePath, moduleDef.paths);
    const { changedFiles } = await detectChanges(files, false);

    const lastVersion = await prisma.llmDocsVersion.findFirst({
      where: { moduleId },
      orderBy: { createdAt: "desc" }
    });

    console.log(`\n${moduleDef.name} (${moduleId})`);

    if (changedFiles.length > 0) {
      console.log(`   ⚠️  ${changedFiles.length} file(s) have pending changes:`);
      for (const file of changedFiles) {
        console.log(`      - ${file.relativePath}`);
      }
    } else {
      console.log(`   ✅ Up to date`);
    }

    if (lastVersion) {
      console.log(`   Last sync: ${lastVersion.createdAt.toISOString()}`);
      if (lastVersion.gitCommit) {
        console.log(`   Git commit: ${lastVersion.gitCommit.slice(0, 7)}`);
      }
    } else {
      console.log(`   ⚠️  Never synced`);
    }
  }

  console.log("\n" + "-".repeat(60) + "\n");
}

export async function showHistory(options: {
  moduleId?: string;
  limit: number;
}): Promise<void> {
  console.log("\n📜 Documentation Version History\n");
  console.log("-".repeat(60));

  const versions = await prisma.llmDocsVersion.findMany({
    where: options.moduleId ? { moduleId: options.moduleId } : undefined,
    orderBy: { createdAt: "desc" },
    take: options.limit
  });

  if (versions.length === 0) {
    console.log("No version history found.");
    return;
  }

  for (const version of versions) {
    console.log(`\nVersion #${version.version} - ${version.moduleId}`);
    console.log(`   Date: ${version.createdAt.toISOString()}`);
    console.log(`   Change: ${version.changeType}`);
    console.log(`   Files: ${version.filesChanged.length} changed`);
    console.log(`   Chunks: +${version.chunksAdded} / -${version.chunksRemoved}`);
    if (version.description) {
      console.log(`   Note: ${version.description}`);
    }
    if (version.gitCommit) {
      console.log(`   Commit: ${version.gitCommit.slice(0, 7)}`);
    }
  }

  console.log("\n" + "-".repeat(60) + "\n");
}
```

### 7.7 Developer Workflow Examples

```bash
# SCENARIO 1: Added new feature to medical-records module
# Developer updated patients.md with new "export to PDF" feature

# Check what changed
npm run docs:status -- --module=medical-records

# Output:
# Expedientes Médicos (medical-records)
#    ⚠️  1 file(s) have pending changes:
#       - modules/medical-records/patients.md

# Sync the changes
npm run docs:sync -- --module=medical-records --description="Added PDF export feature"

# Output:
# 📚 Syncing module: medical-records
#    Found 6 files
#    📝 1 files changed, 5 unchanged
#    🗑️  Removed 12 old chunks
#    📦 Created 14 new chunks
#    🧠 Generating embeddings...
#    🗑️  Invalidated 8 cached queries
#    ✅ Sync completed in 3420ms
```

```bash
# SCENARIO 2: Major update across multiple modules

# Check all modules
npm run docs:status

# Force sync everything (ignores hash comparison)
npm run docs:sync-all -- --force

# View what happened
npm run docs:history -- --limit=5
```

```bash
# SCENARIO 3: New module added

# 1. Create new markdown files in docs/llm-assistant/modules/new-module/
# 2. Add module definition to src/lib/llm-assistant/modules.ts
# 3. Run sync

npm run docs:sync -- --module=new-module --description="Initial sync for new module"
```

### 7.8 Audit Trail Query Examples

```sql
-- See all changes for a module
SELECT
  version,
  change_type,
  files_changed,
  chunks_added,
  chunks_removed,
  triggered_by,
  created_at
FROM llm_docs_versions
WHERE module_id = 'medical-records'
ORDER BY created_at DESC
LIMIT 10;

-- Find which version a chunk belongs to
SELECT
  c.section,
  c.file_path,
  v.version,
  v.created_at as synced_at
FROM llm_docs_chunks c
JOIN llm_docs_versions v ON c.version_id = v.id
WHERE c.module = 'appointments'
ORDER BY v.created_at DESC;

-- Check for modules with pending changes (run from app)
-- This would be implemented in the sync status command
```

### 7.9 Integration with CI/CD (Optional Future Enhancement)

```yaml
# .github/workflows/docs-check.yml
# This is OPTIONAL - for teams that want automated checks

name: Documentation Sync Check

on:
  pull_request:
    paths:
      - 'docs/llm-assistant/**'

jobs:
  check-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Check for doc changes
        run: npm run docs:status

      - name: Remind to sync
        run: |
          echo "⚠️ Documentation changes detected!"
          echo "Remember to run 'npm run docs:sync' before deploying."
```

### 7.10 Cache Invalidation Rules

```
RULE: MODULE-SCOPED INVALIDATION

When module X is synced:
1. Delete all cached queries where modulesUsed contains X
2. Keep cached queries for other modules untouched

This ensures:
- Relevant cache is cleared
- Unaffected queries remain cached
- No stale answers for updated content
```

```typescript
// Implementation (already shown in cache.ts)
export async function invalidateCacheForModule(moduleId: string): Promise<number> {
  const result = await prisma.llmQueryCache.deleteMany({
    where: {
      modulesUsed: { has: moduleId }
    }
  });
  return result.count;
}
```

---

## 8. OFFLINE INGESTION PIPELINE

### 7.1 Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       INGESTION PIPELINE FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. DISCOVER FILES                                                      │
│     Input: docs/llm-assistant/**/*.md                                   │
│     Output: List of file paths                                          │
│                                                                         │
│  2. PARSE MARKDOWN                                                      │
│     Input: File content                                                 │
│     Output: Structured sections with headings                           │
│                                                                         │
│  3. EXTRACT METADATA                                                    │
│     Input: File path + content                                          │
│     Output: module, submodule, docType                                  │
│                                                                         │
│  4. CHUNK SECTIONS                                                      │
│     Input: Sections                                                     │
│     Output: Chunks (300-500 tokens, 80 token overlap)                   │
│                                                                         │
│  5. GENERATE EMBEDDINGS                                                 │
│     Input: Chunk content                                                │
│     Output: 1536-dimension vectors                                      │
│                                                                         │
│  6. STORE IN DATABASE                                                   │
│     Input: Chunks with embeddings                                       │
│     Output: Rows in llm_docs_chunks                                     │
│                                                                         │
│  7. UPDATE MODULE SUMMARIES                                             │
│     Input: Module definitions                                           │
│     Output: Rows in llm_module_summaries                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Implementation

```typescript
// File: src/lib/llm-assistant/ingestion/pipeline.ts

import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { LLM_ASSISTANT_CONFIG } from "../constants";
import { MODULE_DEFINITIONS } from "../modules";
import {
  ParsedSection,
  ChunkMetadata,
  ChunkingResult,
  IngestionResult,
  DocType
} from "../types";
import { generateEmbedding, generateEmbeddingsBatch } from "../embedding";
import { countTokens } from "../tokenizer";

const prisma = new PrismaClient();

// ============================================
// FILE DISCOVERY
// ============================================

export async function discoverMarkdownFiles(basePath: string): Promise<string[]> {
  const files: string[] = [];

  async function walkDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip TECHNICAL_SPEC.md and hidden directories
        if (!entry.name.startsWith(".")) {
          await walkDir(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        // Skip the technical spec itself
        if (entry.name !== "TECHNICAL_SPEC.md") {
          files.push(fullPath);
        }
      }
    }
  }

  await walkDir(basePath);
  return files.sort();
}

// ============================================
// MARKDOWN PARSING
// ============================================

export function parseMarkdownSections(content: string): ParsedSection[] {
  const lines = content.split("\n");
  const sections: ParsedSection[] = [];

  let currentSection: ParsedSection | null = null;
  let contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentLines.join("\n").trim();
        currentSection.endLine = i - 1;
        if (currentSection.content.length > 0) {
          sections.push(currentSection);
        }
      }

      // Start new section
      currentSection = {
        heading: headingMatch[2],
        content: "",
        level: headingMatch[1].length,
        startLine: i,
        endLine: i
      };
      contentLines = [];
    } else if (currentSection) {
      contentLines.push(line);
    } else {
      // Content before first heading - create implicit section
      if (line.trim()) {
        if (!currentSection) {
          currentSection = {
            heading: "Introduction",
            content: "",
            level: 1,
            startLine: 0,
            endLine: 0
          };
        }
        contentLines.push(line);
      }
    }
  }

  // Don't forget last section
  if (currentSection) {
    currentSection.content = contentLines.join("\n").trim();
    currentSection.endLine = lines.length - 1;
    if (currentSection.content.length > 0) {
      sections.push(currentSection);
    }
  }

  return sections;
}

// ============================================
// METADATA EXTRACTION
// ============================================

export function extractMetadataFromPath(filePath: string): Partial<ChunkMetadata> {
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Extract relative path from docs/llm-assistant/
  const match = normalizedPath.match(/docs\/llm-assistant\/(.+)\.md$/);
  if (!match) {
    return { module: "general", submodule: null };
  }

  const relativePath = match[1];
  const parts = relativePath.split("/");

  // Determine module and submodule from path structure
  if (parts[0] === "modules") {
    if (parts.length >= 3) {
      // e.g., modules/medical-records/patients.md
      return {
        module: parts[1],
        submodule: parts[2] === "overview" ? null : parts[2],
        filePath: relativePath
      };
    } else if (parts.length === 2) {
      // e.g., modules/blog.md
      return {
        module: parts[1].replace(".md", ""),
        submodule: null,
        filePath: relativePath
      };
    }
  } else if (parts[0] === "features") {
    // e.g., features/voice-assistant.md
    return {
      module: parts[1]?.replace(".md", "") || "general",
      submodule: null,
      filePath: relativePath
    };
  }

  // Default cases (index.md, faq.md)
  return {
    module: "general",
    submodule: null,
    filePath: relativePath
  };
}

export function determineDocType(section: ParsedSection, filePath: string): DocType {
  const headingLower = section.heading.toLowerCase();
  const contentLower = section.content.toLowerCase();
  const fileNameLower = path.basename(filePath).toLowerCase();

  // Check heading patterns
  if (headingLower.includes("visión general") || headingLower.includes("overview")) {
    return "overview";
  }
  if (headingLower.includes("paso a paso") || headingLower.includes("cómo")) {
    return "howto";
  }
  if (headingLower.includes("puede hacer") || headingLower.includes("funcionalidades")) {
    return "capability";
  }
  if (headingLower.includes("no puede") || headingLower.includes("limitaciones")) {
    return "limitation";
  }
  if (headingLower.includes("preguntas frecuentes") || fileNameLower === "faq.md") {
    return "faq";
  }

  // Check content patterns
  if (contentLower.includes("no es posible") || contentLower.includes("no disponible")) {
    return "limitation";
  }
  if (contentLower.includes("1.") && contentLower.includes("2.") && contentLower.includes("click")) {
    return "howto";
  }

  return "reference";
}

// ============================================
// CHUNKING
// ============================================

export function chunkSection(
  section: ParsedSection,
  metadata: ChunkMetadata,
  startIndex: number
): ChunkingResult {
  const { CHUNK_SIZE_TARGET_TOKENS, CHUNK_SIZE_MAX_TOKENS, CHUNK_OVERLAP_TOKENS } = LLM_ASSISTANT_CONFIG;

  const fullContent = `## ${section.heading}\n\n${section.content}`;
  const totalTokens = countTokens(fullContent);

  // If section fits in one chunk, return as-is
  if (totalTokens <= CHUNK_SIZE_MAX_TOKENS) {
    return {
      chunks: [{
        content: fullContent,
        metadata: {
          ...metadata,
          section: section.heading
        },
        tokenCount: totalTokens,
        chunkIndex: startIndex
      }],
      totalChunks: 1,
      totalTokens
    };
  }

  // Need to split the section
  const chunks: ChunkingResult["chunks"] = [];
  const paragraphs = section.content.split(/\n\n+/);

  let currentChunkContent = `## ${section.heading}\n\n`;
  let currentTokens = countTokens(currentChunkContent);
  let chunkIndex = startIndex;
  let overlapContent = "";

  for (const paragraph of paragraphs) {
    const paragraphTokens = countTokens(paragraph);

    if (currentTokens + paragraphTokens > CHUNK_SIZE_TARGET_TOKENS && currentTokens > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunkContent.trim(),
        metadata: {
          ...metadata,
          section: section.heading
        },
        tokenCount: currentTokens,
        chunkIndex: chunkIndex++
      });

      // Start new chunk with overlap
      overlapContent = getOverlapContent(currentChunkContent, CHUNK_OVERLAP_TOKENS);
      currentChunkContent = `## ${section.heading} (cont.)\n\n${overlapContent}\n\n`;
      currentTokens = countTokens(currentChunkContent);
    }

    currentChunkContent += paragraph + "\n\n";
    currentTokens += paragraphTokens;
  }

  // Don't forget last chunk
  if (currentTokens > countTokens(`## ${section.heading}\n\n`)) {
    chunks.push({
      content: currentChunkContent.trim(),
      metadata: {
        ...metadata,
        section: section.heading
      },
      tokenCount: currentTokens,
      chunkIndex: chunkIndex
    });
  }

  return {
    chunks,
    totalChunks: chunks.length,
    totalTokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0)
  };
}

function getOverlapContent(content: string, targetTokens: number): string {
  const sentences = content.split(/(?<=[.!?])\s+/);
  let overlap = "";
  let tokens = 0;

  // Take sentences from the end
  for (let i = sentences.length - 1; i >= 0 && tokens < targetTokens; i--) {
    const sentenceTokens = countTokens(sentences[i]);
    if (tokens + sentenceTokens <= targetTokens * 1.2) {
      overlap = sentences[i] + " " + overlap;
      tokens += sentenceTokens;
    } else {
      break;
    }
  }

  return overlap.trim();
}

// ============================================
// MAIN INGESTION FUNCTION
// ============================================

export async function runIngestionPipeline(
  basePath: string = LLM_ASSISTANT_CONFIG.DOCS_BASE_PATH
): Promise<IngestionResult> {
  const startTime = Date.now();
  const errors: IngestionResult["errors"] = [];

  console.log("[Ingestion] Starting pipeline...");

  // 1. Discover files
  const files = await discoverMarkdownFiles(basePath);
  console.log(`[Ingestion] Found ${files.length} markdown files`);

  // 2. Process each file
  const allChunks: Array<{
    content: string;
    metadata: ChunkMetadata;
    tokenCount: number;
    chunkIndex: number;
  }> = [];

  for (const filePath of files) {
    try {
      console.log(`[Ingestion] Processing: ${filePath}`);

      const content = await fs.readFile(filePath, "utf-8");
      const sections = parseMarkdownSections(content);
      const baseMetadata = extractMetadataFromPath(filePath);

      let chunkIndex = 0;
      for (const section of sections) {
        const docType = determineDocType(section, filePath);
        const metadata: ChunkMetadata = {
          module: baseMetadata.module || "general",
          submodule: baseMetadata.submodule || null,
          section: section.heading,
          docType,
          filePath: baseMetadata.filePath || filePath,
          heading: section.heading
        };

        const result = chunkSection(section, metadata, chunkIndex);
        allChunks.push(...result.chunks);
        chunkIndex += result.totalChunks;
      }
    } catch (error) {
      errors.push({
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  console.log(`[Ingestion] Created ${allChunks.length} chunks`);

  // 3. Generate embeddings in batches
  console.log("[Ingestion] Generating embeddings...");
  const contents = allChunks.map(c => c.content);
  const embeddings = await generateEmbeddingsBatch(contents);

  // 4. Clear existing chunks and insert new ones
  console.log("[Ingestion] Updating database...");

  const deletedCount = await prisma.$executeRaw`
    DELETE FROM llm_docs_chunks
  `;

  // Insert in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const embedding = batchEmbeddings[j];

      await prisma.$executeRaw`
        INSERT INTO llm_docs_chunks (
          content, embedding, module, submodule, section, doc_type,
          file_path, heading, language, token_count, chunk_index
        ) VALUES (
          ${chunk.content},
          ${embedding}::vector,
          ${chunk.metadata.module},
          ${chunk.metadata.submodule},
          ${chunk.metadata.section},
          ${chunk.metadata.docType},
          ${chunk.metadata.filePath},
          ${chunk.metadata.heading},
          'es',
          ${chunk.tokenCount},
          ${chunk.chunkIndex}
        )
      `;
    }
  }

  // 5. Update module summaries
  console.log("[Ingestion] Updating module summaries...");
  await updateModuleSummaries();

  const duration = Date.now() - startTime;
  console.log(`[Ingestion] Completed in ${duration}ms`);

  return {
    filesProcessed: files.length,
    chunksCreated: allChunks.length,
    chunksDeleted: deletedCount,
    errors,
    duration
  };
}

async function updateModuleSummaries(): Promise<void> {
  // Clear existing summaries
  await prisma.$executeRaw`DELETE FROM llm_module_summaries`;

  for (const [moduleId, module] of Object.entries(MODULE_DEFINITIONS)) {
    const summaryText = `${module.name}: ${module.description}. Palabras clave: ${module.keywords.join(", ")}`;
    const embedding = await generateEmbedding(summaryText);

    await prisma.$executeRaw`
      INSERT INTO llm_module_summaries (module_id, name, description, keywords, embedding)
      VALUES (
        ${moduleId},
        ${module.name},
        ${module.description},
        ${module.keywords}::text[],
        ${embedding}::vector
      )
    `;
  }
}
```

### 7.3 Tokenizer Implementation

```typescript
// File: src/lib/llm-assistant/tokenizer.ts

import { encoding_for_model, TiktokenModel } from "tiktoken";

// Use cl100k_base encoding (used by GPT-4, Claude, etc.)
let encoder: ReturnType<typeof encoding_for_model> | null = null;

function getEncoder() {
  if (!encoder) {
    encoder = encoding_for_model("gpt-4" as TiktokenModel);
  }
  return encoder;
}

export function countTokens(text: string): number {
  const enc = getEncoder();
  return enc.encode(text).length;
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const enc = getEncoder();
  const tokens = enc.encode(text);

  if (tokens.length <= maxTokens) {
    return text;
  }

  const truncatedTokens = tokens.slice(0, maxTokens);
  return enc.decode(truncatedTokens);
}
```

---

## 9. RUNTIME QUERY PIPELINE

### 18.1 Pipeline Overview

```
INPUT: UserQuery
  │
  ▼
┌─────────────────────┐
│ 1. VALIDATE INPUT   │ ─── Invalid? ───▶ Return error
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 2. CHECK CACHE      │ ─── Hit? ───▶ Return cached response
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 3. EMBED QUESTION   │
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 4. DETECT MODULES   │
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 5. RETRIEVE CHUNKS  │ ─── No results? ───▶ Return "not found"
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 6. DEDUPLICATE      │
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 7. LOAD MEMORY      │
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 8. ASSEMBLE PROMPT  │
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 9. CALL LLM         │
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 10. CACHE RESPONSE  │
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 11. UPDATE MEMORY   │
└─────────────────────┘
  │
  ▼
OUTPUT: AssistantResponse
```

### 18.2 Implementation

```typescript
// File: src/lib/llm-assistant/query/pipeline.ts

import { PrismaClient } from "@prisma/client";
import { LLM_ASSISTANT_CONFIG } from "../constants";
import {
  UserQuery,
  AssistantResponse,
  RetrievedChunk,
  ModuleDetectionResult,
  MemoryContext,
  AssembledPrompt,
  LLMAssistantError
} from "../types";
import { generateEmbedding } from "../embedding";
import { detectModules } from "./module-detector";
import { retrieveChunks } from "./retriever";
import { deduplicateChunks } from "./deduplicator";
import { loadMemory, updateMemory } from "./memory";
import { assemblePrompt } from "./prompt-assembler";
import { callLLM } from "../llm-client";
import { checkCache, saveToCache } from "./cache";
import { countTokens } from "../tokenizer";

const prisma = new PrismaClient();

export async function processQuery(query: UserQuery): Promise<AssistantResponse> {
  const startTime = Date.now();

  // 1. Validate input
  validateQuery(query);

  // 2. Check cache
  const cachedResponse = await checkCache(query.text);
  if (cachedResponse) {
    return {
      ...cachedResponse,
      cached: true
    };
  }

  // 3. Embed the question
  const questionEmbedding = await generateEmbedding(query.text);

  // 4. Detect relevant modules
  const moduleDetection = await detectModules(questionEmbedding);

  // 5. Retrieve relevant chunks
  const retrievedChunks = await retrieveChunks(
    questionEmbedding,
    moduleDetection.modules.map(m => m.moduleId)
  );

  // Handle no results
  if (retrievedChunks.length === 0) {
    return createNotFoundResponse(query);
  }

  // 6. Deduplicate chunks
  const uniqueChunks = deduplicateChunks(retrievedChunks);

  // 7. Load conversation memory
  const memoryContext = await loadMemory(query.sessionId);

  // 8. Check if module changed (reset memory if needed)
  const primaryModule = uniqueChunks[0]?.module;
  if (
    LLM_ASSISTANT_CONFIG.MEMORY_RESET_ON_MODULE_CHANGE &&
    memoryContext.activeModule &&
    memoryContext.activeModule !== primaryModule
  ) {
    memoryContext.recentTurns = [];
    memoryContext.activeModule = primaryModule;
  }

  // 9. Assemble prompt
  const prompt = assemblePrompt(
    query.text,
    uniqueChunks,
    memoryContext
  );

  // 10. Call LLM
  const llmResponse = await callLLM(prompt);

  // 11. Build response
  const response: AssistantResponse = {
    answer: llmResponse.content,
    sourcesUsed: uniqueChunks.map(c => ({
      module: c.module,
      section: c.section
    })),
    confidence: determineConfidence(uniqueChunks),
    cached: false,
    tokenUsage: {
      input: prompt.tokenCounts.total,
      output: countTokens(llmResponse.content),
      total: prompt.tokenCounts.total + countTokens(llmResponse.content)
    }
  };

  // 12. Save to cache
  await saveToCache(query.text, response, uniqueChunks);

  // 13. Update memory
  await updateMemory(query.sessionId, {
    userMessage: query.text,
    assistantMessage: response.answer,
    activeModule: primaryModule
  });

  console.log(`[Query] Processed in ${Date.now() - startTime}ms`);

  return response;
}

function validateQuery(query: UserQuery): void {
  if (!query.text || query.text.trim().length === 0) {
    throw new LLMAssistantError(
      "La pregunta no puede estar vacía",
      "INVALID_INPUT",
      false
    );
  }

  if (query.text.length > 1000) {
    throw new LLMAssistantError(
      "La pregunta es demasiado larga (máximo 1000 caracteres)",
      "INVALID_INPUT",
      false
    );
  }

  if (!query.sessionId) {
    throw new LLMAssistantError(
      "Se requiere un ID de sesión",
      "INVALID_INPUT",
      false
    );
  }
}

function createNotFoundResponse(query: UserQuery): AssistantResponse {
  return {
    answer: `No encontré información específica sobre "${query.text}" en la documentación del Portal Médico. ¿Podrías reformular tu pregunta o preguntar sobre otro tema?`,
    sourcesUsed: [],
    confidence: "low",
    cached: false,
    tokenUsage: {
      input: 0,
      output: 0,
      total: 0
    }
  };
}

function determineConfidence(chunks: RetrievedChunk[]): "high" | "medium" | "low" {
  if (chunks.length === 0) return "low";

  const avgSimilarity = chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length;

  if (avgSimilarity >= 0.8) return "high";
  if (avgSimilarity >= 0.7) return "medium";
  return "low";
}
```

---

## 10. MODULE DETECTION ALGORITHM

### 18.1 Detection Strategy

```
STRATEGY: HYBRID MODULE DETECTION

Phase 1: Keyword Matching (Fast, no API call)
  - Check if query contains module keywords
  - High confidence if exact match found
  - Skip to retrieval if match found

Phase 2: Embedding Similarity (If Phase 1 inconclusive)
  - Compare query embedding to module summary embeddings
  - Take top 2 modules with similarity > 0.5
  - Use both for broader retrieval
```

### 18.2 Implementation

```typescript
// File: src/lib/llm-assistant/query/module-detector.ts

import { PrismaClient } from "@prisma/client";
import { MODULE_DEFINITIONS, ModuleId } from "../modules";
import { ModuleDetectionResult } from "../types";

const prisma = new PrismaClient();

export async function detectModules(
  queryEmbedding: number[]
): Promise<ModuleDetectionResult> {
  // Phase 1: Try keyword matching first (cheaper)
  const keywordMatch = detectModulesByKeywords(queryEmbedding.toString()); // Note: We need the original text here

  if (keywordMatch.confidence === "high") {
    return keywordMatch;
  }

  // Phase 2: Use embedding similarity
  const embeddingMatch = await detectModulesByEmbedding(queryEmbedding);

  // Combine results if keyword match had medium confidence
  if (keywordMatch.confidence === "medium") {
    const combinedModules = [
      ...keywordMatch.modules,
      ...embeddingMatch.modules.filter(
        em => !keywordMatch.modules.some(km => km.moduleId === em.moduleId)
      )
    ].slice(0, 3);

    return {
      modules: combinedModules,
      confidence: "medium"
    };
  }

  return embeddingMatch;
}

// Overload that accepts original text for keyword matching
export async function detectModulesWithText(
  queryText: string,
  queryEmbedding: number[]
): Promise<ModuleDetectionResult> {
  // Phase 1: Keyword matching
  const keywordMatch = detectModulesByKeywords(queryText);

  if (keywordMatch.confidence === "high") {
    return keywordMatch;
  }

  // Phase 2: Embedding similarity
  const embeddingMatch = await detectModulesByEmbedding(queryEmbedding);

  if (keywordMatch.confidence === "medium") {
    const combinedModules = mergeModuleResults(
      keywordMatch.modules,
      embeddingMatch.modules
    );

    return {
      modules: combinedModules,
      confidence: "medium"
    };
  }

  return embeddingMatch;
}

function detectModulesByKeywords(queryText: string): ModuleDetectionResult {
  const queryLower = queryText.toLowerCase();
  const matchedModules: Array<{
    moduleId: string;
    name: string;
    similarity: number;
    matchCount: number;
  }> = [];

  for (const [moduleId, module] of Object.entries(MODULE_DEFINITIONS)) {
    let matchCount = 0;

    for (const keyword of module.keywords) {
      if (queryLower.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      matchedModules.push({
        moduleId,
        name: module.name,
        similarity: Math.min(matchCount / 3, 1), // Normalize to 0-1
        matchCount
      });
    }
  }

  // Sort by match count
  matchedModules.sort((a, b) => b.matchCount - a.matchCount);

  // Determine confidence
  let confidence: "high" | "medium" | "low" = "low";

  if (matchedModules.length > 0) {
    if (matchedModules[0].matchCount >= 2) {
      confidence = "high";
    } else if (matchedModules[0].matchCount >= 1) {
      confidence = "medium";
    }
  }

  return {
    modules: matchedModules.slice(0, 2).map(m => ({
      moduleId: m.moduleId,
      name: m.name,
      similarity: m.similarity
    })),
    confidence
  };
}

async function detectModulesByEmbedding(
  queryEmbedding: number[]
): Promise<ModuleDetectionResult> {
  const results = await prisma.$queryRaw<
    Array<{ module_id: string; name: string; similarity: number }>
  >`
    SELECT
      module_id,
      name,
      1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
    FROM llm_module_summaries
    WHERE 1 - (embedding <=> ${queryEmbedding}::vector) > 0.5
    ORDER BY embedding <=> ${queryEmbedding}::vector
    LIMIT 2
  `;

  const modules = results.map(r => ({
    moduleId: r.module_id,
    name: r.name,
    similarity: r.similarity
  }));

  // Determine confidence
  let confidence: "high" | "medium" | "low" = "low";

  if (modules.length > 0) {
    if (modules[0].similarity >= 0.8) {
      confidence = "high";
    } else if (modules[0].similarity >= 0.65) {
      confidence = "medium";
    }
  }

  // If no modules found, default to general
  if (modules.length === 0) {
    modules.push({
      moduleId: "general",
      name: "General",
      similarity: 0.5
    });
  }

  return { modules, confidence };
}

function mergeModuleResults(
  primary: ModuleDetectionResult["modules"],
  secondary: ModuleDetectionResult["modules"]
): ModuleDetectionResult["modules"] {
  const seen = new Set(primary.map(m => m.moduleId));
  const merged = [...primary];

  for (const module of secondary) {
    if (!seen.has(module.moduleId)) {
      merged.push(module);
      seen.add(module.moduleId);
    }
  }

  return merged.slice(0, 3);
}
```

---

## 11. VECTOR RETRIEVAL

### 18.1 Retrieval Strategy

```
STRATEGY: FILTERED VECTOR SEARCH WITH THRESHOLD

1. Filter by detected modules (reduces search space)
2. Apply similarity threshold (0.65 minimum)
3. Limit to top 5 results
4. Enforce token budget (1200 tokens max)
5. Drop lowest similarity if budget exceeded
```

### 18.2 Implementation

```typescript
// File: src/lib/llm-assistant/query/retriever.ts

import { PrismaClient } from "@prisma/client";
import { LLM_ASSISTANT_CONFIG } from "../constants";
import { RetrievedChunk } from "../types";
import { countTokens } from "../tokenizer";

const prisma = new PrismaClient();

export async function retrieveChunks(
  queryEmbedding: number[],
  moduleIds: string[]
): Promise<RetrievedChunk[]> {
  const {
    RETRIEVAL_LIMIT,
    SIMILARITY_THRESHOLD,
    TOKEN_BUDGET_RETRIEVED_DOCS
  } = LLM_ASSISTANT_CONFIG;

  // Query database using the search function
  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      content: string;
      module: string;
      submodule: string | null;
      section: string;
      doc_type: string;
      file_path: string;
      similarity: number;
    }>
  >`
    SELECT * FROM search_chunks(
      ${queryEmbedding}::vector,
      ${moduleIds}::text[],
      ${SIMILARITY_THRESHOLD}::float,
      ${RETRIEVAL_LIMIT}::int
    )
  `;

  // Convert to RetrievedChunk type
  let chunks: RetrievedChunk[] = results.map(r => ({
    id: r.id,
    content: r.content,
    module: r.module,
    submodule: r.submodule,
    section: r.section,
    docType: r.doc_type as RetrievedChunk["docType"],
    filePath: r.file_path,
    similarity: r.similarity
  }));

  // Enforce token budget
  chunks = enforceTokenBudget(chunks, TOKEN_BUDGET_RETRIEVED_DOCS);

  return chunks;
}

function enforceTokenBudget(
  chunks: RetrievedChunk[],
  maxTokens: number
): RetrievedChunk[] {
  let totalTokens = 0;
  const result: RetrievedChunk[] = [];

  // Chunks are already sorted by similarity (desc)
  for (const chunk of chunks) {
    const chunkTokens = countTokens(chunk.content);

    if (totalTokens + chunkTokens <= maxTokens) {
      result.push(chunk);
      totalTokens += chunkTokens;
    } else if (result.length === 0) {
      // Always include at least one chunk, even if it exceeds budget
      result.push(chunk);
      break;
    }
  }

  return result;
}

// Alternative: Retrieve without module filtering (for fallback)
export async function retrieveChunksUnfiltered(
  queryEmbedding: number[]
): Promise<RetrievedChunk[]> {
  const { RETRIEVAL_LIMIT, SIMILARITY_THRESHOLD } = LLM_ASSISTANT_CONFIG;

  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      content: string;
      module: string;
      submodule: string | null;
      section: string;
      doc_type: string;
      file_path: string;
      similarity: number;
    }>
  >`
    SELECT
      id,
      content,
      module,
      submodule,
      section,
      doc_type,
      file_path,
      1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
    FROM llm_docs_chunks
    WHERE 1 - (embedding <=> ${queryEmbedding}::vector) >= ${SIMILARITY_THRESHOLD}
    ORDER BY embedding <=> ${queryEmbedding}::vector
    LIMIT ${RETRIEVAL_LIMIT}
  `;

  return results.map(r => ({
    id: r.id,
    content: r.content,
    module: r.module,
    submodule: r.submodule,
    section: r.section,
    docType: r.doc_type as RetrievedChunk["docType"],
    filePath: r.file_path,
    similarity: r.similarity
  }));
}
```

---

## 12. CHUNK DEDUPLICATION

### 18.1 Deduplication Strategy

```
STRATEGY: SECTION-BASED DEDUPLICATION

Problem: Vector search may return multiple chunks from same section
Solution: Keep only highest-similarity chunk per module+section combination

Additional: Remove near-duplicate content (>90% overlap)
```

### 18.2 Implementation

```typescript
// File: src/lib/llm-assistant/query/deduplicator.ts

import { RetrievedChunk } from "../types";

export function deduplicateChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  // Phase 1: Section-based deduplication
  const sectionDeduped = deduplicateBySectionKey(chunks);

  // Phase 2: Content-based deduplication (near-duplicates)
  const contentDeduped = deduplicateByContent(sectionDeduped);

  return contentDeduped;
}

function deduplicateBySectionKey(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Map<string, RetrievedChunk>();

  // Chunks are sorted by similarity, so first occurrence is highest
  for (const chunk of chunks) {
    const key = `${chunk.module}:${chunk.section}`;

    if (!seen.has(key)) {
      seen.set(key, chunk);
    }
  }

  return Array.from(seen.values());
}

function deduplicateByContent(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const result: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    const isDuplicate = result.some(existing =>
      calculateContentOverlap(existing.content, chunk.content) > 0.9
    );

    if (!isDuplicate) {
      result.push(chunk);
    }
  }

  return result;
}

function calculateContentOverlap(content1: string, content2: string): number {
  const words1 = new Set(content1.toLowerCase().split(/\s+/));
  const words2 = new Set(content2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size; // Jaccard similarity
}
```

---

## 13. MEMORY MANAGEMENT

### 18.1 Memory Strategy

```
STRATEGY: SLIDING WINDOW WITH MODULE TRACKING

- Keep last 2 conversation turns (4 messages)
- Track active module for context continuity
- Reset memory when module changes significantly
- Session-based, expires after 30 minutes of inactivity
- No long-term storage of conversations
```

### 18.2 Implementation

```typescript
// File: src/lib/llm-assistant/query/memory.ts

import { PrismaClient } from "@prisma/client";
import { LLM_ASSISTANT_CONFIG } from "../constants";
import { ConversationMemory, MemoryContext, ConversationTurn } from "../types";

const prisma = new PrismaClient();

const MEMORY_EXPIRY_MINUTES = 30;

export async function loadMemory(sessionId: string): Promise<MemoryContext> {
  const memory = await prisma.llmConversationMemory.findUnique({
    where: { sessionId }
  });

  if (!memory || new Date() > memory.expiresAt) {
    return {
      recentTurns: [],
      activeModule: null
    };
  }

  const turns = memory.turns as ConversationTurn[];
  const { MEMORY_MAX_TURNS } = LLM_ASSISTANT_CONFIG;

  // Get last N turns (each turn = 1 user + 1 assistant message)
  const recentTurns = turns.slice(-MEMORY_MAX_TURNS * 2);

  return {
    recentTurns,
    activeModule: memory.activeModule
  };
}

export async function updateMemory(
  sessionId: string,
  update: {
    userMessage: string;
    assistantMessage: string;
    activeModule: string | null;
  }
): Promise<void> {
  const { MEMORY_MAX_TURNS } = LLM_ASSISTANT_CONFIG;
  const expiresAt = new Date(Date.now() + MEMORY_EXPIRY_MINUTES * 60 * 1000);

  const existing = await prisma.llmConversationMemory.findUnique({
    where: { sessionId }
  });

  const existingTurns = (existing?.turns as ConversationTurn[]) || [];

  const newTurns: ConversationTurn[] = [
    ...existingTurns,
    {
      role: "user",
      content: update.userMessage,
      timestamp: new Date(),
      moduleContext: update.activeModule || undefined
    },
    {
      role: "assistant",
      content: update.assistantMessage,
      timestamp: new Date(),
      moduleContext: update.activeModule || undefined
    }
  ].slice(-MEMORY_MAX_TURNS * 2); // Keep last N turns

  await prisma.llmConversationMemory.upsert({
    where: { sessionId },
    create: {
      sessionId,
      turns: newTurns as any,
      activeModule: update.activeModule,
      expiresAt
    },
    update: {
      turns: newTurns as any,
      activeModule: update.activeModule,
      expiresAt,
      updatedAt: new Date()
    }
  });
}

export async function clearMemory(sessionId: string): Promise<void> {
  await prisma.llmConversationMemory.delete({
    where: { sessionId }
  }).catch(() => {
    // Ignore if not found
  });
}

export function formatMemoryForPrompt(memory: MemoryContext): string {
  if (memory.recentTurns.length === 0) {
    return "";
  }

  const lines = ["Conversación reciente:"];

  for (const turn of memory.recentTurns) {
    const role = turn.role === "user" ? "Usuario" : "Asistente";
    // Truncate long messages
    const content = turn.content.length > 200
      ? turn.content.slice(0, 200) + "..."
      : turn.content;
    lines.push(`${role}: ${content}`);
  }

  if (memory.activeModule) {
    lines.push(`\nContexto activo: ${memory.activeModule}`);
  }

  return lines.join("\n");
}
```

---

## 14. PROMPT ASSEMBLY

### 18.1 Prompt Structure (MANDATORY ORDER)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PROMPT STRUCTURE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SECTION 1: SYSTEM PROMPT (~500 tokens)                                 │
│  ├── Role definition                                                    │
│  ├── Behavior constraints                                               │
│  └── Response format rules                                              │
│                                                                         │
│  SECTION 2: STATIC CONTEXT (~300 tokens)                                │
│  ├── Application name and purpose                                       │
│  ├── Available modules list                                             │
│  └── Language instruction                                               │
│                                                                         │
│  SECTION 3: CONVERSATION MEMORY (~400 tokens)                           │
│  ├── Recent turns (if any)                                              │
│  └── Active module context                                              │
│                                                                         │
│  SECTION 4: RETRIEVED DOCUMENTATION (~1200 tokens)                      │
│  ├── Chunk 1 with source attribution                                    │
│  ├── Chunk 2 with source attribution                                    │
│  └── ... up to token budget                                             │
│                                                                         │
│  SECTION 5: USER QUESTION (~200 tokens)                                 │
│  └── Current question                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 18.2 Implementation

```typescript
// File: src/lib/llm-assistant/query/prompt-assembler.ts

import { LLM_ASSISTANT_CONFIG, MODULE_DEFINITIONS } from "../constants";
import { RetrievedChunk, MemoryContext, AssembledPrompt } from "../types";
import { countTokens, truncateToTokens } from "../tokenizer";
import { formatMemoryForPrompt } from "./memory";

export function assemblePrompt(
  userQuestion: string,
  chunks: RetrievedChunk[],
  memory: MemoryContext
): AssembledPrompt {
  // Build each section
  const systemPrompt = buildSystemPrompt();
  const staticContext = buildStaticContext();
  const memoryContext = formatMemoryForPrompt(memory);
  const retrievedDocs = formatRetrievedDocs(chunks);

  // Count tokens
  const tokenCounts = {
    system: countTokens(systemPrompt),
    static: countTokens(staticContext),
    memory: countTokens(memoryContext),
    docs: countTokens(retrievedDocs),
    question: countTokens(userQuestion),
    total: 0
  };
  tokenCounts.total = Object.values(tokenCounts).reduce((a, b) => a + b, 0) - tokenCounts.total;

  return {
    systemPrompt,
    staticContext,
    memoryContext,
    retrievedDocs,
    userQuestion,
    tokenCounts
  };
}

function buildSystemPrompt(): string {
  return `Eres el asistente de ayuda integrado del Portal Médico, una aplicación para médicos.

TU PROPÓSITO:
Responder preguntas de los usuarios sobre cómo usar la aplicación, qué pueden hacer y qué no pueden hacer.

REGLAS ESTRICTAS:
1. SOLO responde usando la documentación proporcionada en este prompt.
2. NUNCA inventes funcionalidades, botones o características que no estén documentadas.
3. Si la información no está en la documentación, di explícitamente: "No tengo información sobre eso en la documentación disponible."
4. NUNCA especules sobre futuras funcionalidades.
5. Cuando menciones limitaciones, sé claro y directo.
6. SIEMPRE responde en español.
7. Sé conciso pero completo.
8. Cuando sea relevante, indica de qué módulo proviene la información.

FORMATO DE RESPUESTA:
- Usa párrafos cortos
- Usa listas cuando enumeres pasos o características
- Si el usuario pregunta "cómo hacer algo", proporciona pasos numerados
- Si el usuario pregunta "puedo hacer X", responde directamente sí o no, y luego explica

PROHIBIDO:
- Realizar acciones en la aplicación
- Modificar datos
- Acceder a información del usuario
- Proporcionar información médica o de salud`;
}

function buildStaticContext(): string {
  const moduleList = Object.values(MODULE_DEFINITIONS)
    .map(m => `- ${m.name}: ${m.description}`)
    .join("\n");

  return `CONTEXTO DE LA APLICACIÓN:
Nombre: Portal Médico
Tipo: Plataforma de gestión para médicos
Idioma: Español (México)

MÓDULOS DISPONIBLES:
${moduleList}

El usuario puede preguntar sobre cualquiera de estos módulos.`;
}

function formatRetrievedDocs(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "DOCUMENTACIÓN: No se encontró documentación relevante para esta consulta.";
  }

  const formattedChunks = chunks.map((chunk, index) => {
    const source = chunk.submodule
      ? `[${chunk.module}/${chunk.submodule}]`
      : `[${chunk.module}]`;

    return `--- Documento ${index + 1} ${source} ---
${chunk.content}`;
  });

  return `DOCUMENTACIÓN RELEVANTE:

${formattedChunks.join("\n\n")}

--- Fin de documentación ---`;
}

// Build the full message array for the LLM API
export function buildMessageArray(prompt: AssembledPrompt): Array<{
  role: "system" | "user" | "assistant";
  content: string;
}> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: prompt.systemPrompt
    },
    {
      role: "user",
      content: `${prompt.staticContext}

${prompt.memoryContext ? prompt.memoryContext + "\n\n" : ""}${prompt.retrievedDocs}

PREGUNTA DEL USUARIO:
${prompt.userQuestion}`
    }
  ];

  return messages;
}
```

---

## 15. LLM API INTEGRATION

### 18.1 Client Implementation

```typescript
// File: src/lib/llm-assistant/llm-client.ts

import Anthropic from "@anthropic-ai/sdk";
import { LLM_ASSISTANT_CONFIG } from "./constants";
import { AssembledPrompt, LLMAssistantError } from "./types";
import { buildMessageArray } from "./query/prompt-assembler";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

interface LLMResponse {
  content: string;
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export async function callLLM(prompt: AssembledPrompt): Promise<LLMResponse> {
  const { LLM_MODEL, LLM_TEMPERATURE, TOKEN_BUDGET_OUTPUT } = LLM_ASSISTANT_CONFIG;

  const messages = buildMessageArray(prompt);

  try {
    const response = await anthropic.messages.create({
      model: LLM_MODEL,
      max_tokens: TOKEN_BUDGET_OUTPUT,
      temperature: LLM_TEMPERATURE,
      messages: messages.map(m => ({
        role: m.role === "system" ? "user" : m.role, // Anthropic doesn't have system in messages
        content: m.content
      })),
      system: messages.find(m => m.role === "system")?.content
    });

    const textContent = response.content.find(c => c.type === "text");

    return {
      content: textContent?.text || "",
      stopReason: response.stop_reason || "end_turn",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    };
  } catch (error) {
    console.error("[LLM] API Error:", error);

    if (error instanceof Anthropic.APIError) {
      throw new LLMAssistantError(
        `Error al comunicarse con el asistente: ${error.message}`,
        "LLM_API_ERROR",
        error.status !== 401 // Not recoverable if auth error
      );
    }

    throw new LLMAssistantError(
      "Error inesperado al generar respuesta",
      "LLM_API_ERROR",
      true
    );
  }
}
```

### 18.2 Embedding Client

```typescript
// File: src/lib/llm-assistant/embedding.ts

import OpenAI from "openai";
import { LLM_ASSISTANT_CONFIG } from "./constants";
import { LLMAssistantError } from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const { EMBEDDING_MODEL } = LLM_ASSISTANT_CONFIG;

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: "float"
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("[Embedding] Error:", error);
    throw new LLMAssistantError(
      "Error al procesar la pregunta",
      "EMBEDDING_FAILED",
      true
    );
  }
}

export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  const { EMBEDDING_MODEL, EMBEDDING_BATCH_SIZE } = LLM_ASSISTANT_CONFIG;
  const embeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
        encoding_format: "float"
      });

      // Sort by index to maintain order
      const sorted = response.data.sort((a, b) => a.index - b.index);
      embeddings.push(...sorted.map(d => d.embedding));

      // Rate limiting: wait between batches
      if (i + EMBEDDING_BATCH_SIZE < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error("[Embedding] Batch error:", error);
      throw new LLMAssistantError(
        "Error al procesar embeddings",
        "EMBEDDING_FAILED",
        true
      );
    }
  }

  return embeddings;
}
```

---

## 16. CACHING LAYER

### 18.1 Cache Strategy

```
STRATEGY: QUERY HASH CACHING

- Hash the normalized query text
- Store response with TTL (1 hour)
- Include chunk IDs for cache invalidation
- Track hit count for analytics
- Invalidate on documentation update
```

### 18.2 Implementation

```typescript
// File: src/lib/llm-assistant/query/cache.ts

import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { LLM_ASSISTANT_CONFIG } from "../constants";
import { AssistantResponse, RetrievedChunk, CachedQuery } from "../types";

const prisma = new PrismaClient();

export function hashQuery(query: string): string {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

export async function checkCache(
  queryText: string
): Promise<AssistantResponse | null> {
  const queryHash = hashQuery(queryText);

  const cached = await prisma.llmQueryCache.findUnique({
    where: { queryHash }
  });

  if (!cached || new Date() > cached.expiresAt) {
    return null;
  }

  // Update hit count
  await prisma.llmQueryCache.update({
    where: { queryHash },
    data: { hitCount: { increment: 1 } }
  });

  // Parse and return cached response
  const response = JSON.parse(cached.response) as AssistantResponse;
  return response;
}

export async function saveToCache(
  queryText: string,
  response: AssistantResponse,
  chunks: RetrievedChunk[]
): Promise<void> {
  const { CACHE_TTL_SECONDS } = LLM_ASSISTANT_CONFIG;

  const queryHash = hashQuery(queryText);
  const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);

  await prisma.llmQueryCache.upsert({
    where: { queryHash },
    create: {
      queryHash,
      queryText,
      response: JSON.stringify(response),
      modulesUsed: [...new Set(chunks.map(c => c.module))],
      chunksUsed: chunks.map(c => c.id),
      expiresAt
    },
    update: {
      response: JSON.stringify(response),
      modulesUsed: [...new Set(chunks.map(c => c.module))],
      chunksUsed: chunks.map(c => c.id),
      expiresAt,
      hitCount: 1 // Reset hit count on update
    }
  });
}

export async function invalidateCache(): Promise<number> {
  const result = await prisma.llmQueryCache.deleteMany({});
  return result.count;
}

export async function invalidateCacheForModule(moduleId: string): Promise<number> {
  const result = await prisma.llmQueryCache.deleteMany({
    where: {
      modulesUsed: { has: moduleId }
    }
  });
  return result.count;
}

export async function cleanExpiredCache(): Promise<number> {
  const result = await prisma.llmQueryCache.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  });
  return result.count;
}
```

---

## 17. ERROR HANDLING

### 18.1 Error Classification

```typescript
// File: src/lib/llm-assistant/errors.ts

import { LLMAssistantError, ErrorCode } from "./types";

export const ERROR_RESPONSES: Record<ErrorCode, {
  userMessage: string;
  httpStatus: number;
  logLevel: "error" | "warn" | "info";
}> = {
  EMBEDDING_FAILED: {
    userMessage: "Hubo un problema al procesar tu pregunta. Por favor, intenta de nuevo.",
    httpStatus: 500,
    logLevel: "error"
  },
  RETRIEVAL_FAILED: {
    userMessage: "No pude buscar en la documentación. Por favor, intenta de nuevo.",
    httpStatus: 500,
    logLevel: "error"
  },
  NO_RELEVANT_CHUNKS: {
    userMessage: "No encontré información relacionada con tu pregunta en la documentación.",
    httpStatus: 200, // Not an error, just no results
    logLevel: "info"
  },
  LLM_API_ERROR: {
    userMessage: "El asistente no está disponible en este momento. Por favor, intenta más tarde.",
    httpStatus: 503,
    logLevel: "error"
  },
  MEMORY_ERROR: {
    userMessage: "Hubo un problema con la memoria de conversación. Tu pregunta será procesada sin contexto previo.",
    httpStatus: 200, // Degraded but functional
    logLevel: "warn"
  },
  CACHE_ERROR: {
    userMessage: "", // Cache errors are silent to user
    httpStatus: 200,
    logLevel: "warn"
  },
  INGESTION_ERROR: {
    userMessage: "Error al actualizar la documentación.",
    httpStatus: 500,
    logLevel: "error"
  },
  INVALID_INPUT: {
    userMessage: "Tu pregunta no es válida. Por favor, verifica e intenta de nuevo.",
    httpStatus: 400,
    logLevel: "info"
  }
};

export function handleError(error: unknown): {
  userMessage: string;
  httpStatus: number;
  shouldLog: boolean;
} {
  if (error instanceof LLMAssistantError) {
    const config = ERROR_RESPONSES[error.code];
    return {
      userMessage: config.userMessage || error.message,
      httpStatus: config.httpStatus,
      shouldLog: config.logLevel === "error"
    };
  }

  // Unknown error
  console.error("[LLM Assistant] Unexpected error:", error);
  return {
    userMessage: "Ocurrió un error inesperado. Por favor, intenta de nuevo.",
    httpStatus: 500,
    shouldLog: true
  };
}
```

---

## 18. API ENDPOINTS

### 18.1 Chat Endpoint

```typescript
// File: src/app/api/llm-assistant/chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { processQuery } from "@/lib/llm-assistant/query/pipeline";
import { handleError } from "@/lib/llm-assistant/errors";
import { UserQuery } from "@/lib/llm-assistant/types";

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Parse request
    const body = await request.json();
    const { question, sessionId } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Se requiere una pregunta" },
        { status: 400 }
      );
    }

    // Build query object
    const query: UserQuery = {
      text: question,
      sessionId: sessionId || `session_${session.user.id}_${Date.now()}`,
      userId: session.user.id,
      timestamp: new Date()
    };

    // Process query
    const response = await processQuery(query);

    return NextResponse.json({
      success: true,
      data: {
        answer: response.answer,
        sources: response.sourcesUsed,
        confidence: response.confidence,
        cached: response.cached
      }
    });

  } catch (error) {
    const { userMessage, httpStatus, shouldLog } = handleError(error);

    if (shouldLog) {
      console.error("[API] Chat error:", error);
    }

    return NextResponse.json(
      { success: false, error: userMessage },
      { status: httpStatus }
    );
  }
}
```

### 18.2 Memory Clear Endpoint

```typescript
// File: src/app/api/llm-assistant/memory/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clearMemory } from "@/lib/llm-assistant/query/memory";

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Se requiere sessionId" }, { status: 400 });
    }

    await clearMemory(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Memory clear error:", error);
    return NextResponse.json({ error: "Error al limpiar memoria" }, { status: 500 });
  }
}
```

### 18.3 Ingestion Endpoint (Admin Only)

```typescript
// File: src/app/api/llm-assistant/ingest/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { runIngestionPipeline } from "@/lib/llm-assistant/ingestion/pipeline";
import { invalidateCache } from "@/lib/llm-assistant/query/cache";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    // Check for admin privileges
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Run ingestion
    const result = await runIngestionPipeline();

    // Invalidate cache after ingestion
    const cacheCleared = await invalidateCache();

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        cacheCleared
      }
    });
  } catch (error) {
    console.error("[API] Ingestion error:", error);
    return NextResponse.json(
      { error: "Error durante la ingestión" },
      { status: 500 }
    );
  }
}
```

---

## 19. FILE STRUCTURE

```
src/
├── app/
│   └── api/
│       └── llm-assistant/
│           ├── chat/
│           │   └── route.ts          # Main chat endpoint
│           ├── memory/
│           │   └── route.ts          # Memory management
│           └── ingest/
│               └── route.ts          # Documentation ingestion
│
├── lib/
│   └── llm-assistant/
│       ├── constants.ts              # Configuration constants
│       ├── modules.ts                # Module definitions
│       ├── types.ts                  # TypeScript types
│       ├── errors.ts                 # Error handling
│       ├── tokenizer.ts              # Token counting
│       ├── embedding.ts              # Embedding generation
│       ├── llm-client.ts             # LLM API client
│       │
│       ├── ingestion/
│       │   └── pipeline.ts           # Ingestion pipeline
│       │
│       └── query/
│           ├── pipeline.ts           # Query processing
│           ├── module-detector.ts    # Module detection
│           ├── retriever.ts          # Vector retrieval
│           ├── deduplicator.ts       # Chunk deduplication
│           ├── memory.ts             # Conversation memory
│           ├── prompt-assembler.ts   # Prompt building
│           └── cache.ts              # Query caching
│
├── components/
│   └── llm-assistant/
│       ├── ChatWidget.tsx            # Main chat UI
│       ├── ChatMessage.tsx           # Message component
│       ├── ChatInput.tsx             # Input component
│       └── ChatSources.tsx           # Source attribution
│
└── prisma/
    ├── schema.prisma                 # Database schema
    └── migrations/
        ├── 001_enable_pgvector.sql
        └── 002_vector_indexes.sql
```

---

## 20. TESTING REQUIREMENTS

### 21.1 Unit Tests

```typescript
// File: src/lib/llm-assistant/__tests__/chunking.test.ts

describe("Chunking", () => {
  it("should not exceed max token limit", () => {
    // Test that no chunk exceeds CHUNK_SIZE_MAX_TOKENS
  });

  it("should preserve section headers", () => {
    // Test that chunks start with ## heading
  });

  it("should create overlap between chunks", () => {
    // Test that consecutive chunks have CHUNK_OVERLAP_TOKENS overlap
  });
});

// File: src/lib/llm-assistant/__tests__/module-detector.test.ts

describe("Module Detection", () => {
  it("should detect medical-records module for patient questions", () => {
    const result = detectModulesByKeywords("¿cómo creo un paciente?");
    expect(result.modules[0].moduleId).toBe("medical-records");
  });

  it("should return general for ambiguous questions", () => {
    const result = detectModulesByKeywords("hola");
    expect(result.confidence).toBe("low");
  });
});
```

### 21.2 Integration Tests

```typescript
// File: src/lib/llm-assistant/__tests__/pipeline.integration.test.ts

describe("Query Pipeline Integration", () => {
  it("should return grounded answer for documented feature", async () => {
    const response = await processQuery({
      text: "¿Puedo eliminar un paciente?",
      sessionId: "test-session",
      timestamp: new Date()
    });

    expect(response.answer).toContain("no");
    expect(response.sourcesUsed.some(s => s.module === "medical-records")).toBe(true);
  });

  it("should indicate when information is not found", async () => {
    const response = await processQuery({
      text: "¿Puedo enviar SMS a los pacientes?",
      sessionId: "test-session",
      timestamp: new Date()
    });

    expect(response.answer).toMatch(/no (tengo|encontré) información/i);
  });
});
```

### 21.3 Hallucination Tests

```typescript
// File: src/lib/llm-assistant/__tests__/hallucination.test.ts

describe("Hallucination Prevention", () => {
  const nonExistentFeatures = [
    "enviar recordatorios por SMS",
    "integración con Google Calendar",
    "exportar a Excel",
    "facturación electrónica",
    "chat con pacientes"
  ];

  nonExistentFeatures.forEach(feature => {
    it(`should not claim ${feature} exists`, async () => {
      const response = await processQuery({
        text: `¿Puedo ${feature}?`,
        sessionId: "test-session",
        timestamp: new Date()
      });

      // Should either say it's not supported or not documented
      expect(response.answer).toMatch(
        /(no|disponible|documentación|soporta|posible)/i
      );
      expect(response.answer).not.toMatch(/sí.*(puedes|puede)/i);
    });
  });
});
```

---

## 21. SECURITY CONSIDERATIONS

### 21.1 Input Validation

```typescript
// All user inputs must be validated:
// - Maximum length: 1000 characters
// - No SQL injection (using parameterized queries)
// - No prompt injection (structured prompt format)
// - Session ID validation (UUID format)
```

### 21.2 Rate Limiting

```typescript
// Implement rate limiting:
// - 20 requests per minute per user
// - 100 requests per minute per IP
// - Exponential backoff on limit exceeded
```

### 21.3 Data Privacy

```typescript
// Privacy requirements:
// - Conversation memory expires after 30 minutes
// - No PII stored in logs
// - Query cache contains no user identifiers
// - All data in PostgreSQL, no external transmission except LLM APIs
```

---

## APPENDIX A: ENVIRONMENT VARIABLES

```bash
# .env.local

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/portal_medico?schema=public"

# OpenAI (for embeddings)
OPENAI_API_KEY="sk-..."

# Anthropic (for LLM)
ANTHROPIC_API_KEY="sk-ant-..."

# Optional: Redis for caching
REDIS_URL="redis://localhost:6379"
```

---

## APPENDIX B: DEPLOYMENT CHECKLIST

```markdown
Pre-deployment:
[ ] PostgreSQL with pgvector extension installed
[ ] Environment variables configured
[ ] Database migrations applied
[ ] Initial documentation ingestion completed
[ ] Module summaries generated

Post-deployment:
[ ] Verify embedding generation works
[ ] Verify LLM API connection
[ ] Test query pipeline end-to-end
[ ] Monitor error rates
[ ] Set up cache cleanup cron job
```

---

## DOCUMENT END

```
This specification is complete and self-contained.
An LLM or developer should be able to implement the entire system
using only this document as reference.

Last updated: 2026-01-25
Version: 1.0.0
```
