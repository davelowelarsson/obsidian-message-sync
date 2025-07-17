/**
 * Browser-compatible File Download Service for Obsidian Plugin
 *
 * Handles downloading files from Slack using Obsidian's file system APIs.
 * This service is designed for the browser environment and uses Obsidian's
 * vault adapter for file operations.
 */

import { type App, normalizePath, requestUrl } from 'obsidian';
import type { SlackMessage } from '../../../types/slack';

export interface FileDownloadOptions {
  outputDir: string;
  assetsDir?: string;
  downloadFiles?: boolean;
  maxFileSize?: number; // in bytes
  allowedExtensions?: string[];
}

export interface FileDownloadResult {
  localPath: string;
  relativePath: string;
  downloadedSize: number;
  wasDownloaded: boolean;
}

export interface SlackFile {
  id: string;
  name?: string;
  title?: string;
  url_private?: string;
  permalink?: string;
  filetype?: string;
  size?: number;
  mimetype?: string;
}

/**
 * Browser-compatible file download service for Obsidian plugins
 */
export class FileDownloadService {
  private app: App;
  private token: string;
  private options: FileDownloadOptions;

  constructor(app: App, token: string, options: FileDownloadOptions) {
    this.app = app;
    this.token = token;
    this.options = {
      assetsDir: 'assets',
      downloadFiles: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB default
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.md', '.doc', '.docx'],
      ...options,
    };
  }

  /**
   * Download files from a Slack message
   */
  async downloadMessageFiles(
    message: SlackMessage,
    dateKey: string
  ): Promise<FileDownloadResult[]> {
    if (!this.options.downloadFiles || !message.files || message.files.length === 0) {
      return [];
    }

    const results: FileDownloadResult[] = [];

    for (const file of message.files) {
      try {
        const result = await this.downloadFile(file, dateKey);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`❌ Failed to download file ${file.name || file.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Download a single file from Slack
   */
  async downloadFile(file: SlackFile, dateKey: string): Promise<FileDownloadResult | null> {
    if (!this.options.downloadFiles) {
      return null;
    }

    try {
      const fileName = file.title || file.name || `file_${file.id}`;

      // Add debugging
      console.log('📥 File download - processing file:', {
        fileId: file.id,
        fileName: fileName,
        title: file.title,
        name: file.name,
        dateKey: dateKey,
      });

      const fileInfo = this.prepareFileDownload(file, fileName, dateKey);

      if (!fileInfo) {
        return null;
      }

      const { localFilePath, relativePath, finalFileName } = fileInfo;

      // Check if file already exists
      if (await this.app.vault.adapter.exists(localFilePath)) {
        console.log(`📁 File ${finalFileName} already exists, skipping download`);
        return {
          localPath: localFilePath,
          relativePath,
          downloadedSize: 0,
          wasDownloaded: false,
        };
      }

      console.log(`📥 Downloading ${fileName} (${file.id})`);

      const fileBuffer = await this.downloadFileFromSlack(file);
      if (!fileBuffer) {
        return null;
      }

      // Validate file size
      if (this.options.maxFileSize && fileBuffer.byteLength > this.options.maxFileSize) {
        console.warn(
          `⚠️ File ${fileName} exceeds maximum size limit (${this.options.maxFileSize} bytes)`
        );
        return null;
      }

      // Ensure directory exists
      const dirPath = localFilePath.substring(0, localFilePath.lastIndexOf('/'));
      await this.ensureDirectoryExists(dirPath);

      // Write file to vault
      await this.app.vault.adapter.writeBinary(localFilePath, fileBuffer);

      console.log(
        `✅ Successfully downloaded ${fileName} (${Math.round(fileBuffer.byteLength / 1024)} KB)`
      );

      return {
        localPath: localFilePath,
        relativePath,
        downloadedSize: fileBuffer.byteLength,
        wasDownloaded: true,
      };
    } catch (error) {
      console.error(`❌ Failed to download file:`, error);
      return null;
    }
  }

  /**
   * Prepare file download by determining paths and validating file
   */
  private prepareFileDownload(
    file: SlackFile,
    fileName: string,
    dateKey: string
  ): {
    localFilePath: string;
    relativePath: string;
    finalFileName: string;
  } | null {
    // Validate file extension if restrictions are set
    if (this.options.allowedExtensions && this.options.allowedExtensions.length > 0) {
      const fileExtension = this.getFileExtension(fileName);
      if (!this.options.allowedExtensions.includes(fileExtension)) {
        console.warn(`⚠️ File ${fileName} has disallowed extension: ${fileExtension}`);
        return null;
      }
    }

    // Sanitize filename
    const sanitizedFileName = this.sanitizeFilename(fileName);
    const finalFileName = `${file.id}_${sanitizedFileName}`;

    // Build paths - now assets are nested within the channel directory
    // dateKey format: "dm-davidlowelarsson/2025-07-13"
    // We want: "slack/dm-davidlowelarsson/assets/file.png"
    const pathParts = dateKey.split('/');
    const channelPath = pathParts[0]; // "dm-davidlowelarsson"
    const assetsDir = this.options.assetsDir || 'assets';

    // Create relative path: slack/channel/assets/file.png
    const relativePath = normalizePath(`slack/${channelPath}/${assetsDir}/${finalFileName}`);
    const localFilePath = normalizePath(`${this.options.outputDir}/${relativePath}`);

    console.log('📥 File path generation:', {
      dateKey,
      channelPath,
      assetsDir,
      finalFileName,
      relativePath,
      localFilePath,
    });

    return {
      localFilePath,
      relativePath,
      finalFileName,
    };
  }

  /**
   * Download file content from Slack
   */
  private async downloadFileFromSlack(file: SlackFile): Promise<ArrayBuffer | null> {
    // Check if this is a bot token (starts with xoxb) or user token (starts with xoxp)
    const isBotToken = this.token.startsWith('xoxb-');
    const isUserToken = this.token.startsWith('xoxp-');

    if (isBotToken) {
      console.warn(
        `⚠️ Bot tokens cannot download files. File ${file.name || file.id} will be skipped.`
      );
      console.warn(
        `💡 To download files, use a user token (xoxp-) instead of a bot token (xoxb-).`
      );
      return null;
    }

    if (!isUserToken) {
      console.warn(
        `⚠️ Unknown token type for file download. File ${file.name || file.id} will be skipped.`
      );
      return null;
    }

    // For user tokens, use the direct download URL
    const downloadUrl = file.url_private;

    if (!downloadUrl) {
      console.warn(`⚠️ No download URL available for file ${file.name || file.id}`);
      return null;
    }

    try {
      console.log(`🌐 Downloading file from: ${downloadUrl}`);

      // Use Obsidian's requestUrl function to avoid CORS issues and get proper binary data
      const response = await requestUrl({
        url: downloadUrl,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      // Check if we got HTML instead of the file (common issue with bot tokens)
      if (
        response.text &&
        (response.text.includes('<html>') || response.text.includes('<!DOCTYPE html>'))
      ) {
        console.error(`❌ Received HTML instead of file content for ${file.name || file.id}`);
        console.error(`💡 This usually means the token doesn't have permission to download files`);
        return null;
      }

      console.log(
        `✅ Successfully downloaded ${file.name || file.id} (${response.arrayBuffer.byteLength} bytes)`
      );

      // requestUrl returns an ArrayBuffer directly for binary files
      return response.arrayBuffer;
    } catch (error) {
      console.error(`❌ Failed to download file from URL:`, error);
      return null;
    }
  }

  /**
   * Ensure directory exists in vault
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      const exists = await this.app.vault.adapter.exists(dirPath);
      if (!exists) {
        await this.app.vault.createFolder(dirPath);
      }
    } catch (error) {
      console.warn(`⚠️ Could not create directory ${dirPath}:`, error);
    }
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return '';
    }
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex > -1 ? filename.substring(lastDotIndex).toLowerCase() : '';
  }

  /**
   * Sanitize filename for safe file system usage
   */
  private sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'untitled';
    }

    // Remove or replace dangerous characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '_') // Replace dangerous chars with underscore
      .replace(/\s+/g, '_') // Replace whitespace with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 200); // Limit length
  }

  /**
   * Update download options
   */
  updateOptions(newOptions: Partial<FileDownloadOptions>): void {
    this.options = {
      ...this.options,
      ...newOptions,
    };
  }

  /**
   * Get current download statistics
   */
  getDownloadStats(): {
    enabled: boolean;
    maxFileSize: number;
    allowedExtensions: string[];
    outputDir: string;
  } {
    return {
      enabled: this.options.downloadFiles || false,
      maxFileSize: this.options.maxFileSize || 0,
      allowedExtensions: this.options.allowedExtensions || [],
      outputDir: this.options.outputDir,
    };
  }
}
