/**
 * Zod Validation Utilities for Obsidian Plugin
 *
 * Provides helper functions to integrate Zod validation with plugin error handling,
 * converting Zod errors to structured plugin errors.
 */

import type { z } from 'zod';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  path: string[];
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * Validate input using a Zod schema and return a structured result
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  context?: {
    operation?: string;
    field?: string;
  }
): ValidationResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    field: context?.field || issue.path.join('.') || 'input',
    message: issue.message,
    code: issue.code,
    path: issue.path.map((p) => String(p)),
  }));

  return { success: false, errors };
}

/**
 * Validate input and throw structured error if validation fails
 */
export function validateInputOrThrow<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  context?: {
    operation?: string;
    field?: string;
  }
): T {
  const result = validateInput(schema, input, context);

  if (result.success && result.data) {
    return result.data;
  }

  const operation = context?.operation || 'validation';
  const field = context?.field || 'input';
  const errorMessages = result.errors?.map((e) => `${e.field}: ${e.message}`).join('; ');

  throw new Error(`${operation} failed for ${field}: ${errorMessages}`);
}

/**
 * Validate API response and throw appropriate error if validation fails
 */
export function validateApiResponse<T>(
  schema: z.ZodSchema<T>,
  response: unknown,
  context?: {
    endpoint?: string;
  }
): T {
  const result = schema.safeParse(response);

  if (result.success) {
    return result.data;
  }

  const endpoint = context?.endpoint || 'unknown';
  const errorMessages = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid API response from ${endpoint}: ${errorMessages}`);
}

/**
 * Format Zod error into human-readable message
 */
export function formatZodError(error: z.ZodError, operation?: string): string {
  if (error.issues.length === 1) {
    const issue = error.issues[0];
    if (issue) {
      const path = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
      return `${operation || 'Validation'} failed${path}: ${issue.message}`;
    }
  }

  const issues = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
      return `- ${issue.message}${path}`;
    })
    .join('\n');

  return `${operation || 'Validation'} failed with multiple issues:\n${issues}`;
}

/**
 * Check if an error is a validation error
 */
export function isValidationError(error: unknown): error is z.ZodError {
  return error instanceof Error && error.name === 'ZodError';
}

/**
 * Extract validation issues from a Zod error
 */
export function getValidationIssues(error: z.ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'input',
    message: issue.message,
    code: issue.code,
    path: issue.path.map((p) => String(p)),
  }));
}
