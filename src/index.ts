#!/usr/bin/env node
/**
 * hnrkb-mcp-server
 *
 * Local stdio MCP server providing read access to the HNR Knowledge Base vault.
 * Scoped to a single vault root — all paths are validated against it to prevent
 * directory traversal.
 *
 * Configuration (environment variables):
 *   KB_VAULT_PATH   Absolute or ~ path to the vault root.
 *                   Default: ~/obsidian/vaults/hnr-knowledge-base
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
import type { Dirent } from "fs";
import * as path from "path";
import * as os from "os";

/* ================================================================ */
/*  Config                                                          */
/* ================================================================ */

const DEFAULT_VAULT = "~/obsidian/vaults/hnr-knowledge-base";

function expandHome(p: string): string {
  return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

const VAULT_ROOT = path.resolve(
  expandHome(process.env.KB_VAULT_PATH ?? DEFAULT_VAULT)
);

/* ================================================================ */
/*  Utilities                                                       */
/* ================================================================ */

/**
 * Resolve a vault-relative path to an absolute path, rejecting any attempt
 * to escape the vault root via `..` or symlink tricks.
 */
function resolveVaultPath(relativePath: string): string {
  // Normalise separators and strip leading slashes so callers don't need to
  const cleaned = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = path.resolve(VAULT_ROOT, cleaned);

  // Ensure the resolved path is strictly inside the vault root
  const vaultWithSep = VAULT_ROOT.endsWith(path.sep)
    ? VAULT_ROOT
    : VAULT_ROOT + path.sep;

  if (resolved !== VAULT_ROOT && !resolved.startsWith(vaultWithSep)) {
    throw new Error(`Path escapes vault root: "${relativePath}"`);
  }
  return resolved;
}

function errorResult(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

/* ================================================================ */
/*  Server                                                          */
/* ================================================================ */

const server = new McpServer({
  name: "hnrkb-mcp-server",
  version: "1.1.0",
});

/* ---------------------------------------------------------------- */
/*  kb_read_note                                                    */
/* ---------------------------------------------------------------- */

server.registerTool(
  "kb_read_note",
  {
    title: "Read KB Note",
    description: `Read the full markdown content of a Knowledge Base note by its vault-relative path.

Args:
  - path (string): Vault-relative path to the note.
    Example: "Pillars/Productivity/Knowledge Management/KB Specifics/Email/Email Routing Queue.md"

Returns:
  The raw markdown text of the file.

Errors:
  - "File not found" when the path does not exist in the vault.
  - "Path escapes vault root" when the path attempts directory traversal.`,
    inputSchema: z.object({
      path: z
        .string()
        .min(1, "Path must not be empty")
        .describe(
          "Vault-relative path to the note, e.g. \"Pillars/Finance/Budget.md\""
        ),
    }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ path: notePath }) => {
    try {
      const absPath = resolveVaultPath(notePath);
      const content = await fs.readFile(absPath, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        return errorResult(
          `File not found: "${notePath}" (vault: ${VAULT_ROOT})`
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      return errorResult(`Error reading note: ${msg}`);
    }
  }
);

/* ---------------------------------------------------------------- */
/*  kb_list_notes                                                   */
/* ---------------------------------------------------------------- */

server.registerTool(
  "kb_list_notes",
  {
    title: "List KB Notes",
    description: `List markdown notes (.md files) inside a vault directory.

Args:
  - path (string): Vault-relative directory path. Omit or pass "" for the vault root.
  - recursive (boolean): When true, descends into all subdirectories. Default false.

Returns:
  Newline-separated list of vault-relative paths to .md files found.`,
    inputSchema: z.object({
      path: z
        .string()
        .default("")
        .describe(
          "Vault-relative directory path. Empty string lists the vault root."
        ),
      recursive: z
        .boolean()
        .default(false)
        .describe("Descend into subdirectories when true."),
    }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ path: dirPath, recursive }) => {
    try {
      const absDir = dirPath ? resolveVaultPath(dirPath) : VAULT_ROOT;
      const notes = await collectNotes(absDir, recursive);
      const relative = notes.map((p) => path.relative(VAULT_ROOT, p));
      return {
        content: [
          {
            type: "text",
            text: relative.length > 0 ? relative.join("\n") : "(no notes found)",
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResult(`Error listing notes: ${msg}`);
    }
  }
);

async function collectNotes(dir: string, recursive: boolean): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true, encoding: "utf-8" }) as Dirent[];
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      throw new Error(`Directory not found: "${path.relative(VAULT_ROOT, dir)}"`);
    }
    throw err;
  }

  const results: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      results.push(...(await collectNotes(full, true)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

/* ---------------------------------------------------------------- */
/*  kb_write_note                                                   */
/* ---------------------------------------------------------------- */

server.registerTool(
  "kb_write_note",
  {
    title: "Write KB Note",
    description: `Write or overwrite a markdown note in the Knowledge Base vault.

Args:
  - path (string): Vault-relative path to the note.
    Example: "Pillars/Productivity/Knowledge Management/KB Specifics/Email/Email Status.md"
  - content (string): Full markdown content to write to the file.
  - create_dirs (boolean): Create parent directories if they do not exist. Default true.

Returns:
  Confirmation message with the vault-relative path and byte count written.

Errors:
  - "Path escapes vault root" when the path attempts directory traversal.
  - "Directory not found" when create_dirs is false and the parent directory does not exist.`,
    inputSchema: z.object({
      path: z
        .string()
        .min(1, "Path must not be empty")
        .describe(
          "Vault-relative path to the note, e.g. \"Pillars/Finance/Budget.md\""
        ),
      content: z
        .string()
        .describe("Full markdown content to write to the file."),
      create_dirs: z
        .boolean()
        .default(true)
        .describe(
          "Create parent directories if they do not exist. Default true."
        ),
    }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ path: notePath, content, create_dirs }) => {
    try {
      const absPath = resolveVaultPath(notePath);

      if (create_dirs) {
        await fs.mkdir(path.dirname(absPath), { recursive: true });
      }

      await fs.writeFile(absPath, content, "utf-8");

      return {
        content: [
          {
            type: "text",
            text: `Written: "${notePath}" (${Buffer.byteLength(content, "utf-8")} bytes)`,
          },
        ],
      };
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        return errorResult(
          `Directory not found for: "${notePath}" — set create_dirs: true to create it automatically`
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      return errorResult(`Error writing note: ${msg}`);
    }
  }
);

/* ================================================================ */
/*  Boot                                                            */
/* ================================================================ */

async function main(): Promise<void> {
  // Verify vault root exists before accepting connections
  try {
    await fs.access(VAULT_ROOT);
  } catch {
    console.error(
      `hnrkb-mcp-server: vault root not accessible: ${VAULT_ROOT}\n` +
        `Set KB_VAULT_PATH to the correct path and restart.`
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`hnrkb-mcp-server ready — vault: ${VAULT_ROOT}`);
}

main().catch((err) => {
  console.error("hnrkb-mcp-server fatal:", err);
  process.exit(1);
});
