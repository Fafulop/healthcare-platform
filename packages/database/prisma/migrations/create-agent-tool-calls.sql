-- AgentToolCall — traza redactada de cada llamada a tool del asistente.
-- Ver el comentario del modelo en schema.prisma y agenda-agent/tool-digest.ts.
--
-- Aplicar con (NUNCA `prisma db push`: revierte el composite FK de bookings y
-- los índices parciales de doctor_members que viven en prod):
--   railway run --service pgvector -- npx prisma db execute \
--     --schema packages/database/prisma/schema.prisma \
--     --file packages/database/prisma/migrations/create-agent-tool-calls.sql
--
-- Idempotente: se puede correr dos veces sin romper nada.

CREATE TABLE IF NOT EXISTS public.agent_tool_calls (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL,
  endpoint    VARCHAR(100) NOT NULL,
  turn_id     TEXT NOT NULL,
  tool        VARCHAR(100) NOT NULL,
  seq         INTEGER NOT NULL,
  iteration   INTEGER NOT NULL,
  ok          BOOLEAN NOT NULL DEFAULT TRUE,
  duration_ms INTEGER NOT NULL,
  input       JSONB NOT NULL,
  digest      JSONB NOT NULL,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT agent_tool_calls_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS agent_tool_calls_created_at_idx
  ON public.agent_tool_calls (created_at);
CREATE INDEX IF NOT EXISTS agent_tool_calls_doctor_id_created_at_idx
  ON public.agent_tool_calls (doctor_id, created_at);
CREATE INDEX IF NOT EXISTS agent_tool_calls_turn_id_idx
  ON public.agent_tool_calls (turn_id);
