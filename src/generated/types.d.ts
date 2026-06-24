// Generated on 2026-06-24T14:59:13.387Z by @knowledgeislands/mcp-kb-fs@1.0.0
// Server: mcp-kb-mcp-kb-fs
// Source: /Users/krisbrown/.mcporter/mcporter.json
// Transport: STDIO node /Users/krisbrown/kis/knowledgeislands/mcp-kb-fs/dist/mcp-server/index.js

import type { CallResult } from 'mcporter'

export interface McpKbMcpKbFsTools {
  /**
   * Read a Knowledge Base note by its KB-relative path — all of it, or just its YAML frontmatter or just
   * its body.
   * Args:
   * - path (string): KB-relative path to the note.
   * Example: "CLAUDE.md"
   * - part (string): which slice to return. One of:
   * - "all" (default): the raw markdown of the whole file.
   * - "frontmatter": only the YAML between the leading "---" fences (fences excluded); "(no
   * frontmatter)" when the note has none.
   * - "body": only the markdown after the closing "---" fence (the whole file when there is no
   * frontmatter).
   * Returns:
   * The requested slice of the note as text.
   * Errors:
   * - "File not found" when the path does not exist in the knowledge base.
   * - "Path escapes root" when the path attempts directory traversal.
   * - "Malformed frontmatter" when part is "frontmatter"/"body" and the note opens a "---" fence that
   * never closes.
   *
   * @param path KB-relative path to the note, e.g. "Pillars/Finance/Budget.md"
   * @param part? Which slice to return: whole file (all), just the YAML frontmatter, or just the body.
   */
  kb_note_read(path: string, part?: 'all' | 'frontmatter' | 'body'): Promise<CallResult>

  /**
   * List markdown notes (.md files) inside a knowledge base directory.
   * Args:
   * - path (string): KB-relative directory path. Omit or pass "" for the knowledge base root.
   * - recursive (boolean): When true, descends into all subdirectories. Default false.
   * Returns:
   * Newline-separated list of KB-relative paths to .md files found.
   *
   * @param path? KB-relative directory path. Empty string lists the knowledge base root.
   * @param recursive? Descend into subdirectories when true.
   */
  kb_notes_list(path?: string, recursive?: boolean): Promise<CallResult>

  /**
   * List subfolders inside a knowledge base directory.
   * Args:
   * - path (string): KB-relative directory path. Omit or pass "" for the knowledge base root.
   * - recursive (boolean): When true, descends into all subdirectories. Default false.
   * Returns:
   * Newline-separated list of KB-relative folder paths found.
   *
   * @param path? KB-relative directory path. Empty string lists the knowledge base root.
   * @param recursive? Descend into subdirectories when true.
   */
  kb_folders_list(path?: string, recursive?: boolean): Promise<CallResult>

  /**
   * Write or overwrite a markdown note in the knowledge base.
   * Args:
   * - path (string): KB-relative path to the note.
   * Example: "CLAUDE.md"
   * - content (string): Full markdown content to write to the file.
   * - create_dirs (boolean): Create parent directories if they do not exist. Default true.
   * - dry_run (boolean): When true (the default), validate inputs and report what would change without
   * writing anything. Pass dry_run: false to actually write the file.
   * Returns:
   * Confirmation message with the KB-relative path and byte count written, or a "[dry_run] would ..."
   * preview.
   * Errors:
   * - "Path escapes root" when the path attempts directory traversal.
   * - "Directory not found" when create_dirs is false and the parent directory does not exist.
   *
   * @param path KB-relative path to the note, e.g. "CLAUDE.md"
   * @param content Full markdown content to write to the file.
   * @param create_dirs? Create parent directories if they do not exist. Default true.
   * @param dry_run? Preview only; do not write. Default true — pass false to actually write.
   */
  kb_note_write(path: string, content: string, create_dirs?: boolean, dry_run?: boolean): Promise<CallResult>

  /**
   * Rename or move a markdown note within the knowledge base. Non-destructive: refuses to overwrite an
   * existing destination.
   * Args:
   * - from (string): Current KB-relative path of the note.
   * Example: "Inbox/draft.md"
   * - to (string): New KB-relative path for the note.
   * Example: "Pillars/Finance/Budget.md"
   * - create_dirs (boolean): Create parent directories of the destination if they do not exist. Default
   * true.
   * Returns:
   * Confirmation message with both paths.
   * Errors:
   * - "Destination already exists" — refuses to overwrite (use kb_note_delete + kb_note_write if you
   * really want that).
   * - "File not found" when the source does not exist.
   * - "Path escapes root" / "Path is protected" — standard guards on both paths.
   *
   * @param from Current KB-relative path of the note, e.g. "Inbox/draft.md"
   * @param to New KB-relative path for the note, e.g. "Pillars/Finance/Budget.md"
   * @param create_dirs? Create parent directories of the destination if they do not exist. Default true.
   */
  kb_note_rename(from: string, to: string, create_dirs?: boolean): Promise<CallResult>

  /**
   * Create a folder in the knowledge base. Idempotent: succeeds even if the folder already exists.
   * Parent directories are created as needed.
   * Args:
   * - path (string): KB-relative folder path to create.
   * Example: "Pillars/Finance/2026"
   * Returns:
   * Confirmation message indicating whether the folder was created or already existed.
   * Errors:
   * - "Path exists as a file, not a folder" when the path already exists as a regular file.
   * - "Path escapes root" / "Path is protected" — standard guards.
   *
   * @param path KB-relative folder path to create, e.g. "Pillars/Finance/2026"
   */
  kb_folder_create(path: string): Promise<CallResult>

  /**
   * Delete a markdown note from the knowledge base.
   * Args:
   * - path (string): KB-relative path of the note to delete.
   * Example: "Inbox/2026-04-30.md"
   * - dry_run (boolean): When true (the default), report what would be deleted without removing
   * anything. Pass dry_run: false to actually delete.
   * Returns:
   * Confirmation message with the KB-relative path and byte count deleted, or a "[dry_run] would delete
   * (N bytes)" preview.
   * Errors:
   * - "File not found" when the path does not exist.
   * - "Not a note file" when the path is not a regular file.
   * - "Path escapes root" / "Path is protected" — standard guards.
   *
   * @param path KB-relative path of the note to delete, e.g. "Inbox/2026-04-30.md"
   * @param dry_run? Preview only; do not delete. Default true — pass false to actually delete.
   */
  kb_note_delete(path: string, dry_run?: boolean): Promise<CallResult>
}
