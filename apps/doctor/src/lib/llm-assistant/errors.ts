/**
 * Error handling for LLM Assistant
 */

import { LLMAssistantError } from './types';

interface ErrorConfig {
  userMessage: string;
  statusCode: number;
}

const ERROR_MAP: Record<string, ErrorConfig> = {
  EMPTY_QUERY: {
    userMessage: 'Por favor escribe una pregunta.',
    statusCode: 400,
  },
  QUERY_TOO_LONG: {
    userMessage: 'Tu pregunta es demasiado larga. Por favor intenta con una pregunta más corta.',
    statusCode: 400,
  },
  AUTH_REQUIRED: {
    userMessage: 'Necesitas iniciar sesión para usar el asistente.',
    statusCode: 401,
  },
  EMBEDDING_FAILED: {
    userMessage: 'No pude procesar tu pregunta. Por favor intenta de nuevo.',
    statusCode: 502,
  },
  LLM_FAILED: {
    userMessage: 'No pude generar una respuesta. Por favor intenta de nuevo.',
    statusCode: 502,
  },
  NO_CHUNKS_FOUND: {
    userMessage: 'No encontré información relevante para tu pregunta. Intenta reformularla.',
    statusCode: 200,
  },
  RATE_LIMITED: {
    userMessage: 'Demasiadas solicitudes. Por favor espera un momento.',
    statusCode: 429,
  },
  INTERNAL_ERROR: {
    userMessage: 'Ha ocurrido un error interno. Por favor intenta de nuevo.',
    statusCode: 500,
  },
  INGESTION_FAILED: {
    userMessage: 'Error al procesar la documentación.',
    statusCode: 500,
  },
  ADMIN_REQUIRED: {
    userMessage: 'Se requieren permisos de administrador.',
    statusCode: 403,
  },
};

export function createError(code: string, detail?: string): LLMAssistantError {
  const config = ERROR_MAP[code] || ERROR_MAP.INTERNAL_ERROR;
  return new LLMAssistantError(
    detail || code,
    code,
    config.statusCode,
    config.userMessage
  );
}

export function isLLMAssistantError(error: unknown): error is LLMAssistantError {
  return error instanceof LLMAssistantError;
}

export function toErrorResponse(error: unknown) {
  if (isLLMAssistantError(error)) {
    return {
      success: false,
      error: error.userMessage,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  const fallback = ERROR_MAP.INTERNAL_ERROR;
  return {
    success: false,
    error: fallback.userMessage,
    code: 'INTERNAL_ERROR',
    statusCode: fallback.statusCode,
  };
}
