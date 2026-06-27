// Generated on 2026-06-27T20:39:35.414Z by @knowledgeislands/mcp-ki-kb-fs@1.0.0
// Server: mcp-ki-kb-mcp-ki-kb-fs
// Source: /Users/krisbrown/.mcporter/mcporter.json
// Transport: STDIO /Users/krisbrown/.local/share/mise/installs/node/lts/bin/node /Users/krisbrown/kis/knowledgeislands/mcp-ki-kb-fs/dist/mcp-server/index.js

import type { CallResult } from 'mcporter'

export interface McpKiKbMcpKiKbFsTools {
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

  /**
   * Read a side file (image, PDF, attachment, etc.) from the knowledge base.
   * Returns the file content together with its detected encoding and MIME type:
   * - `encoding: "utf-8"` — content is a UTF-8 string
   * - `encoding: "base64"` — content is base64-encoded (use for binary assets)
   * Zone restriction: the path must start with a declared zone or staging root
   * (e.g. "Pillars/", "Calendar/", "+/", "-/"). Files at the KB root are not accessible.
   * Errors:
   * - "File not found" — path does not exist.
   * - "Path is outside KB zones" — first segment is not a zone or staging root.
   * - "Path is protected" — dotfiles and root-level meta files.
   * - "Not a file" — path is a directory.
   *
   * @param path KB-relative path to the file, e.g. "Pillars/images/diagram.png"
   */
  kb_file_read(path: string): Promise<CallResult>

  /**
   * List files in a knowledge-base directory (any type; optionally filtered by extension).
   * Returns a JSON object with `files` (array of KB-relative paths) and `count`.
   * Parameters:
   * - path (string): KB-relative directory to list. Omit or pass "" for a zone root.
   * - recursive (boolean): Descend into sub-directories. Default false.
   * - ext (string, optional): Filter by extension including the dot, e.g. ".png", ".pdf".
   * Zone restriction: the path must start with a declared zone or staging root.
   *
   * @param path? KB-relative directory, e.g. "Pillars/images"
   * @param recursive? Descend into sub-directories. Default false.
   * @param ext? Filter by file extension including the dot, e.g. ".png". Omit to list all files.
   */
  kb_files_list(path?: string, recursive?: boolean, ext?: string): Promise<CallResult>

  /**
   * Write (create or overwrite) a side file in the knowledge base.
   * For binary files (images, PDFs), base64-encode the content and set encoding: "base64".
   * For text files, pass the raw string with encoding: "utf-8" (default).
   * Atomic write: a sibling temp file is written then renamed, so a crash mid-write
   * cannot produce a half-written file.
   * Parameters:
   * - path (string): KB-relative path to write, e.g. "Pillars/images/diagram.png".
   * - content (string): UTF-8 text or base64-encoded bytes depending on encoding.
   * - encoding ("utf-8" | "base64"): Default "utf-8".
   * - create_dirs (boolean): Create parent directories if they don't exist. Default true.
   * - dry_run (boolean): When true, returns a preview without writing. Default true.
   * Zone restriction: the path must start with a declared zone or staging root.
   *
   * @param path KB-relative path to write, e.g. "Pillars/images/diagram.png"
   * @param content File content: UTF-8 string or base64-encoded bytes depending on encoding.
   * @param encoding? Content encoding. Use "base64" for binary files. Default "utf-8".
   * @param create_dirs? Create parent directories if they do not exist. Default true.
   * @param dry_run? Preview the operation without writing. Change to false to actually write.
   */
  kb_file_write(path: string, content: string, encoding?: 'utf-8' | 'base64', create_dirs?: boolean, dry_run?: boolean): Promise<CallResult>

  /**
   * Rename or move a side file within the knowledge base zones.
   * Non-destructive: fails if the destination already exists.
   * Parameters:
   * - from (string): Current KB-relative path.
   * - to (string): New KB-relative path.
   * - create_dirs (boolean): Create destination parent directories if needed. Default true.
   * Zone restriction: both from and to must start with a declared zone or staging root.
   *
   * @param from Current KB-relative file path, e.g. "Pillars/images/old.png"
   * @param to New KB-relative file path, e.g. "Pillars/images/new.png"
   * @param create_dirs? Create destination parent directories if they do not exist. Default true.
   */
  kb_file_rename(from: string, to: string, create_dirs?: boolean): Promise<CallResult>

  /**
   * Delete a side file from the knowledge base.
   * Parameters:
   * - path (string): KB-relative path to delete.
   * - dry_run (boolean): When true, returns a preview without deleting. Default true.
   * Zone restriction: the path must start with a declared zone or staging root.
   *
   * @param path KB-relative path to delete, e.g. "Pillars/images/old.png"
   * @param dry_run? Preview only; change to false to actually delete.
   */
  kb_file_delete(path: string, dry_run?: boolean): Promise<CallResult>

  /**
   * Return the Knowledge Islands configuration for this KB: resolved zone names,
   * staging area names, and the raw .ki-config.toml content.
   * Use this as an orientation step when working with an unfamiliar KB — it tells
   * you which top-level folders correspond to each canonical zone (Calendar, Pillars,
   * Resources, Streams, Admin) and which staging areas (+/ and -/) are configured.
   * The zone map is derived from .ki-config.toml at server startup; if the file is
   * absent, all zones use their canonical defaults.
   * Takes no parameters. Returns a JSON object with:
   * - zones: { Calendar, Pillars, Resources, Streams, Admin }
   * - staging: { inbound, outbound }
   * - kiConfigPresent (boolean)
   * - kiConfigRaw (string — raw TOML or "(absent — all zones are defaults)")
   */
  kb_config(): Promise<CallResult>
}
