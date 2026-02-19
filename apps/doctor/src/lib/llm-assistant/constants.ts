/**
 * LLM Assistant Configuration Constants
 */

// --- LLM Model ---
export const LLM_MODEL = 'gpt-4o-mini';
export const LLM_TEMPERATURE = 0.1;
export const LLM_MAX_TOKENS = 1024;

// --- Embedding ---
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_BATCH_SIZE = 20;

// --- Chunking ---
export const CHUNK_TARGET_TOKENS = 300;
export const CHUNK_MAX_TOKENS = 500;
export const CHUNK_OVERLAP_TOKENS = 50;

// --- Retrieval ---
export const RETRIEVAL_TOP_K = 10;
export const RETRIEVAL_SIMILARITY_THRESHOLD = 0.5;
export const MODULE_DETECTION_THRESHOLD = 0.3;
export const MAX_CONTEXT_TOKENS = 3000;

// --- Cache ---
export const CACHE_TTL_HOURS = 24;
export const CACHE_MAX_ENTRIES = 1000;

// --- Conversation Memory ---
export const MEMORY_MAX_TURNS = 2;
export const MEMORY_TTL_HOURS = 1;

// --- Module Detection ---
export const MODULE_KEYWORD_BOOST = 0.2;
export const MAX_MODULES_PER_QUERY = 3;

// --- Token Budget ---
export const TOKEN_BUDGET_SYSTEM = 500;
export const TOKEN_BUDGET_STATIC = 200;
export const TOKEN_BUDGET_MEMORY = 300;
export const TOKEN_BUDGET_CAPABILITIES = 700;
export const TOKEN_BUDGET_DOCS = 2500;
export const TOKEN_BUDGET_QUESTION = 200;

// --- Docs Path ---
export const DOCS_BASE_PATH = 'docs/llm-assistant';
// Skip developer/setup docs — not useful for end-user RAG answers
export const DOCS_SKIP_FILES = [
  'TECHNICAL_SPEC.md',
  'IMPLEMENTATION_STATUS.md',
  'pgvector-railway-setup.md',
  'dual-database-architecture.md',
  'railway-db-migration-plan.md',
  'database-management-guide.md',
];

// --- Rate Limiting ---
export const EMBEDDING_RATE_LIMIT_MS = 100;
