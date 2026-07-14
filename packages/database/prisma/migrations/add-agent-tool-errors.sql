-- Audit A2 (GENERAL AGENTES/03): server-side log of assistant tool failures.
-- When a tool throws, the model receives a generic {error} and recovers
-- gracefully — without this table the failure is invisible to us.
-- Idempotent. Rows carry error identity only, never tool inputs/results.

CREATE TABLE IF NOT EXISTS public.agent_tool_errors (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL CONSTRAINT agent_tool_errors_doctor_id_fkey REFERENCES public.doctors(id) ON DELETE CASCADE ON UPDATE CASCADE,
  endpoint VARCHAR(100) NOT NULL,
  tool VARCHAR(100) NOT NULL,
  error_name VARCHAR(100),
  error_code VARCHAR(40),
  message VARCHAR(500),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS agent_tool_errors_created_at_idx ON public.agent_tool_errors (created_at);
CREATE INDEX IF NOT EXISTS agent_tool_errors_doctor_id_idx ON public.agent_tool_errors (doctor_id);
