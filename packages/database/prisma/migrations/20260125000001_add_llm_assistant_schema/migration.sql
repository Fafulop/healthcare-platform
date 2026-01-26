-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "llm_assistant";

-- CreateTable: LLM Docs Chunks
CREATE TABLE "llm_assistant"."llm_docs_chunks" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "module" VARCHAR(100) NOT NULL,
    "submodule" VARCHAR(100),
    "section" VARCHAR(255),
    "doc_type" VARCHAR(50) NOT NULL DEFAULT 'reference',
    "file_path" VARCHAR(500) NOT NULL,
    "heading" VARCHAR(500),
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "chunk_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_docs_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LLM Module Summaries
CREATE TABLE "llm_assistant"."llm_module_summaries" (
    "id" SERIAL NOT NULL,
    "module_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_module_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LLM Query Cache
CREATE TABLE "llm_assistant"."llm_query_cache" (
    "id" SERIAL NOT NULL,
    "query_hash" VARCHAR(64) NOT NULL,
    "query_text" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "modules_used" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "chunks_used" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_query_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LLM Conversation Memory
CREATE TABLE "llm_assistant"."llm_conversation_memory" (
    "id" SERIAL NOT NULL,
    "session_id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "turns" JSONB NOT NULL DEFAULT '[]',
    "active_module" VARCHAR(100),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_conversation_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LLM Docs Version
CREATE TABLE "llm_assistant"."llm_docs_versions" (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL,
    "module_id" VARCHAR(100) NOT NULL,
    "change_type" VARCHAR(50) NOT NULL,
    "files_changed" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "chunks_added" INTEGER NOT NULL DEFAULT 0,
    "chunks_removed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_docs_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LLM Docs File Hash
CREATE TABLE "llm_assistant"."llm_docs_file_hashes" (
    "id" SERIAL NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "module_id" VARCHAR(100) NOT NULL,
    "last_synced" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_docs_file_hashes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "llm_module_summaries_module_id_key" ON "llm_assistant"."llm_module_summaries"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "llm_query_cache_query_hash_key" ON "llm_assistant"."llm_query_cache"("query_hash");

-- CreateIndex
CREATE UNIQUE INDEX "llm_conversation_memory_session_id_key" ON "llm_assistant"."llm_conversation_memory"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "llm_docs_file_hashes_file_path_key" ON "llm_assistant"."llm_docs_file_hashes"("file_path");

-- CreateIndex: Performance indexes
CREATE INDEX "llm_docs_chunks_module_idx" ON "llm_assistant"."llm_docs_chunks"("module");
CREATE INDEX "llm_docs_chunks_file_path_idx" ON "llm_assistant"."llm_docs_chunks"("file_path");
CREATE INDEX "llm_docs_chunks_doc_type_idx" ON "llm_assistant"."llm_docs_chunks"("doc_type");
CREATE INDEX "llm_query_cache_expires_at_idx" ON "llm_assistant"."llm_query_cache"("expires_at");
CREATE INDEX "llm_conversation_memory_user_id_idx" ON "llm_assistant"."llm_conversation_memory"("user_id");
CREATE INDEX "llm_conversation_memory_expires_at_idx" ON "llm_assistant"."llm_conversation_memory"("expires_at");
CREATE INDEX "llm_docs_versions_module_id_idx" ON "llm_assistant"."llm_docs_versions"("module_id");
CREATE INDEX "llm_docs_file_hashes_module_id_idx" ON "llm_assistant"."llm_docs_file_hashes"("module_id");

-- HNSW vector indexes for fast similarity search
CREATE INDEX "llm_docs_chunks_embedding_idx" ON "llm_assistant"."llm_docs_chunks"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX "llm_module_summaries_embedding_idx" ON "llm_assistant"."llm_module_summaries"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- SQL Function: search_chunks
-- Performs vector similarity search on document chunks with optional module filter
CREATE OR REPLACE FUNCTION llm_assistant.search_chunks(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 10,
    filter_modules TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id INT,
    content TEXT,
    module VARCHAR(100),
    submodule VARCHAR(100),
    section VARCHAR(255),
    doc_type VARCHAR(50),
    file_path VARCHAR(500),
    heading VARCHAR(500),
    token_count INT,
    chunk_index INT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.content,
        c.module,
        c.submodule,
        c.section,
        c.doc_type,
        c.file_path,
        c.heading,
        c.token_count,
        c.chunk_index,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM llm_assistant.llm_docs_chunks c
    WHERE c.embedding IS NOT NULL
      AND (filter_modules IS NULL OR c.module = ANY(filter_modules))
      AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- SQL Function: detect_modules
-- Detects relevant modules based on embedding similarity to module summaries
CREATE OR REPLACE FUNCTION llm_assistant.detect_modules(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 3
)
RETURNS TABLE (
    module_id VARCHAR(100),
    name VARCHAR(255),
    description TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ms.module_id,
        ms.name,
        ms.description,
        1 - (ms.embedding <=> query_embedding) AS similarity
    FROM llm_assistant.llm_module_summaries ms
    WHERE ms.embedding IS NOT NULL
      AND 1 - (ms.embedding <=> query_embedding) > match_threshold
    ORDER BY ms.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
