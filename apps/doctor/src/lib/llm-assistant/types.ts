/**
 * LLM Assistant Type Definitions
 */

// --- Document Types ---

export type DocType = 'overview' | 'howto' | 'capability' | 'limitation' | 'faq' | 'reference';

export interface DocumentChunk {
  content: string;
  module: string;
  submodule?: string;
  section?: string;
  docType: DocType;
  filePath: string;
  heading?: string;
  tokenCount: number;
  chunkIndex: number;
}

export interface RetrievedChunk extends DocumentChunk {
  id: number;
  similarity: number;
}

// --- Query Types ---

export interface UIContext {
  /** Current URL path, e.g. "/appointments" or "/dashboard/practice/ventas" */
  currentPath: string;
}

export interface UserQuery {
  question: string;
  sessionId: string;
  userId: string;
  /** Optional: where the user is in the app when they ask the question */
  uiContext?: UIContext;
}

export interface AssistantResponse {
  answer: string;
  sources: SourceReference[];
  confidence: 'high' | 'medium' | 'low' | 'none';
  cached: boolean;
  modulesUsed: string[];
}

export interface SourceReference {
  module: string;
  submodule?: string;
  heading?: string;
  filePath: string;
}

// --- Conversation Types ---

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ConversationMemory {
  sessionId: string;
  userId: string;
  turns: ConversationTurn[];
  activeModule?: string;
}

// --- Module Types ---

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  submodules: SubmoduleDefinition[];
  filePaths: string[];
}

export interface SubmoduleDefinition {
  id: string;
  name: string;
  keywords: string[];
}

export interface DetectedModule {
  moduleId: string;
  name: string;
  confidence: number;
  source: 'keyword' | 'embedding' | 'hybrid';
}

// --- Ingestion Types ---

export interface ParsedSection {
  heading: string;
  content: string;
  level: number;
}

export interface IngestionResult {
  filePath: string;
  module: string;
  submodule?: string;
  chunksCreated: number;
  totalTokens: number;
}

export interface SyncResult {
  moduleId: string;
  filesProcessed: number;
  chunksAdded: number;
  chunksRemoved: number;
  unchanged: number;
}

// --- Prompt Types ---

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// --- Cache Types ---

export interface CachedResponse {
  response: string;
  modulesUsed: string[];
  chunksUsed: number[];
}

// --- Error Types ---

export class LLMAssistantError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public userMessage: string = 'Ha ocurrido un error. Por favor intenta de nuevo.'
  ) {
    super(message);
    this.name = 'LLMAssistantError';
  }
}
