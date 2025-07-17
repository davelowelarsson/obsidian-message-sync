/**
 * Security Utilities for Obsidian Plugin
 *
 * Provides security functions for path validation, file sanitization,
 * and safe file operations within the Obsidian environment.
 */

import { type App, normalizePath } from 'obsidian';

/**
 * Validates that a file path is within the vault and safe to use
 */
export function validateVaultPath(_app: App, filePath: string): string {
  // Normalize the path using Obsidian's normalizePath
  const normalizedPath = normalizePath(filePath);

  // Check for path traversal attempts
  if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
    throw new Error(`Invalid path: ${filePath}`);
  }

  return normalizedPath;
}

/**
 * Sanitizes a filename by removing dangerous characters and limiting length
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed_file';
  }

  if (filename.trim() === '') {
    return 'unnamed_file';
  }

  // Remove or replace dangerous characters
  let sanitized = filename
    // Remove path separators
    .replace(/[/\\:]/g, '_')
    // Remove control characters and other dangerous chars
    .replace(/[<>:"|?*]/g, '_')
    // Remove control characters
    .replace(/[\x00-\x1f\x7f]/g, '')
    // Replace multiple underscores with single
    .replace(/_+/g, '_')
    // Trim underscores from start and end
    .replace(/^_+|_+$/g, '');

  // Limit length
  if (sanitized.length > 255) {
    const ext = getFileExtension(sanitized);
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.') || sanitized.length);
    const maxNameLength = 255 - ext.length - 1; // -1 for the dot
    sanitized = nameWithoutExt.substring(0, maxNameLength) + (ext ? `.${ext}` : '');
  }

  // Ensure it's not empty after sanitization
  if (sanitized === '') {
    sanitized = 'unnamed_file';
  }

  return sanitized;
}

/**
 * Gets the file extension from a filename
 */
function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex > 0 ? filename.substring(lastDotIndex + 1) : '';
}

/**
 * Validates file size against limits
 */
export function validateFileSize(size: number, maxSize: number = 10 * 1024 * 1024): boolean {
  return size > 0 && size <= maxSize;
}

/**
 * Safely creates a directory path within the vault
 */
export async function safeCreateDirectory(app: App, dirPath: string): Promise<void> {
  const normalizedPath = validateVaultPath(app, dirPath);

  try {
    const exists = await app.vault.adapter.exists(normalizedPath);
    if (!exists) {
      await app.vault.createFolder(normalizedPath);
    }
  } catch (error) {
    throw new Error(`Failed to create directory ${normalizedPath}: ${error}`);
  }
}

/**
 * Safely writes content to a file within the vault
 */
export async function safeWriteFile(
  app: App,
  filePath: string,
  content: string,
  options: { overwrite?: boolean } = {}
): Promise<void> {
  const normalizedPath = validateVaultPath(app, filePath);

  try {
    // Ensure directory exists
    const dirPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
    if (dirPath) {
      await safeCreateDirectory(app, dirPath);
    }

    // Check if file exists
    const exists = await app.vault.adapter.exists(normalizedPath);
    if (exists && !options.overwrite) {
      throw new Error(`File already exists: ${normalizedPath}`);
    }

    // Write the file
    await app.vault.adapter.write(normalizedPath, content);
  } catch (error) {
    throw new Error(`Failed to write file ${normalizedPath}: ${error}`);
  }
}

/**
 * Safely reads a file from the vault
 */
export async function safeReadFile(app: App, filePath: string): Promise<string> {
  const normalizedPath = validateVaultPath(app, filePath);

  try {
    const exists = await app.vault.adapter.exists(normalizedPath);
    if (!exists) {
      throw new Error(`File not found: ${normalizedPath}`);
    }

    return await app.vault.adapter.read(normalizedPath);
  } catch (error) {
    throw new Error(`Failed to read file ${normalizedPath}: ${error}`);
  }
}

/**
 * Validates that a string is safe for use as a path component
 */
export function validatePathComponent(component: string): boolean {
  // Check for dangerous patterns
  const dangerousPatterns = [
    /\.\./, // Parent directory
    /^[/\\]/, // Absolute path
    /[<>:"|?*]/, // Invalid filename characters
    /[\x00-\x1f]/, // Control characters
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(component));
}

/**
 * Escapes special characters in a string for safe use in file paths
 */
export function escapeForPath(input: string): string {
  return input
    .replace(/[<>:"|?*]/g, '_')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}
