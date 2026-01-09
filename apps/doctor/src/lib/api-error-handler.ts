import { NextResponse } from 'next/server';
import { Prisma } from '@healthcare/database';

/**
 * Standardized API error handling for medical records endpoints
 */
export function handleApiError(error: unknown, context: string = 'API request'): NextResponse {
  console.error(`Error in ${context}:`, error);

  // Authentication errors
  if (error instanceof Error) {
    if (error.message.includes('Authentication required')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error.message.includes('Doctor role required') ||
        error.message.includes('No doctor profile')) {
      return NextResponse.json(
        { error: 'Forbidden - Doctor access required' },
        { status: 403 }
      );
    }
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2025': // Record not found
        return NextResponse.json(
          { error: 'Resource not found' },
          { status: 404 }
        );
      case 'P2002': // Unique constraint violation
        return NextResponse.json(
          { error: 'Resource already exists' },
          { status: 409 }
        );
      case 'P2003': // Foreign key constraint failed
        return NextResponse.json(
          { error: 'Invalid reference - related resource not found' },
          { status: 400 }
        );
      default:
        return NextResponse.json(
          { error: 'Database error' },
          { status: 500 }
        );
    }
  }

  // Validation errors (custom)
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  // Generic errors - don't expose internal details
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate required fields in request body
 */
export function validateRequired(
  body: Record<string, any>,
  fields: string[]
): void {
  const missing = fields.filter(field => !body[field]);
  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`
    );
  }
}

/**
 * Validate date is valid and not in future
 */
export function validateDateOfBirth(dateString: string): Date {
  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date format');
  }

  if (date > new Date()) {
    throw new ValidationError('Date of birth cannot be in the future');
  }

  // Check if date is reasonable (not before 1900)
  const minDate = new Date('1900-01-01');
  if (date < minDate) {
    throw new ValidationError('Date of birth must be after 1900');
  }

  return date;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: T,
  allowedValues: readonly T[],
  fieldName: string
): void {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `Invalid ${fieldName}. Allowed values: ${allowedValues.join(', ')}`
    );
  }
}

/**
 * Validate date for encounters
 */
export function validateEncounterDate(dateString: string): Date {
  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date format');
  }

  // Encounters can be in the future (scheduled appointments)
  // But not more than 1 year in the future
  const maxFutureDate = new Date();
  maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);

  if (date > maxFutureDate) {
    throw new ValidationError('Encounter date cannot be more than 1 year in the future');
  }

  // Not before 1900
  const minDate = new Date('1900-01-01');
  if (date < minDate) {
    throw new ValidationError('Encounter date must be after 1900');
  }

  return date;
}
