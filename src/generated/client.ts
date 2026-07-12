// @ts-nocheck
// Generated on 2026-07-12T10:44:03.652Z by @knowledgeislands/mcp-ki-kb-fs@1.0.0
// Server: mcp-ki-kb-mcp-ki-kb-fs
// Source: /Users/krisbrown/.mcporter/mcporter.json
// Transport: STDIO /Users/krisbrown/.local/share/mise/installs/node/lts/bin/node /Users/krisbrown/kis/knowledgeislands/mcp-ki-kb-fs/dist/mcp-server/index.js

import { createRuntime, createServerProxy, wrapCallResult } from 'mcporter';
import type { McpKiKbMcpKiKbFsTools } from './types';

type RuntimeInstance = Awaited<ReturnType<typeof createRuntime>>;
export type McpKiKbMcpKiKbFsClient = McpKiKbMcpKiKbFsTools & { close(): Promise<void> };

export interface CreateClientOptions {
  runtime?: RuntimeInstance;
  configPath?: string;
  rootDir?: string;
}

export async function createMcpKiKbMcpKiKbFsClient(options: CreateClientOptions = {}): Promise<McpKiKbMcpKiKbFsClient> {
  const runtime = options.runtime ?? (await createRuntime({
    configPath: options.configPath,
    rootDir: options.rootDir,
  }));
  const ownsRuntime = !options.runtime;
  const proxy = createServerProxy(runtime, "mcp-ki-kb-mcp-ki-kb-fs");
  const client: McpKiKbMcpKiKbFsClient = {
    async kb_note_read(params: Parameters<McpKiKbMcpKiKbFsTools["kb_note_read"]>[0]) {
      const tool = proxy.kbNoteRead as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_note_read"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_notes_list(params: Parameters<McpKiKbMcpKiKbFsTools["kb_notes_list"]>[0]) {
      const tool = proxy.kbNotesList as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_notes_list"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_folders_list(params: Parameters<McpKiKbMcpKiKbFsTools["kb_folders_list"]>[0]) {
      const tool = proxy.kbFoldersList as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_folders_list"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_note_write(params: Parameters<McpKiKbMcpKiKbFsTools["kb_note_write"]>[0]) {
      const tool = proxy.kbNoteWrite as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_note_write"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_note_rename(params: Parameters<McpKiKbMcpKiKbFsTools["kb_note_rename"]>[0]) {
      const tool = proxy.kbNoteRename as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_note_rename"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_folder_create(params: Parameters<McpKiKbMcpKiKbFsTools["kb_folder_create"]>[0]) {
      const tool = proxy.kbFolderCreate as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_folder_create"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_note_delete(params: Parameters<McpKiKbMcpKiKbFsTools["kb_note_delete"]>[0]) {
      const tool = proxy.kbNoteDelete as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_note_delete"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_file_read(params: Parameters<McpKiKbMcpKiKbFsTools["kb_file_read"]>[0]) {
      const tool = proxy.kbFileRead as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_file_read"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_files_list(params: Parameters<McpKiKbMcpKiKbFsTools["kb_files_list"]>[0]) {
      const tool = proxy.kbFilesList as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_files_list"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_file_write(params: Parameters<McpKiKbMcpKiKbFsTools["kb_file_write"]>[0]) {
      const tool = proxy.kbFileWrite as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_file_write"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_file_rename(params: Parameters<McpKiKbMcpKiKbFsTools["kb_file_rename"]>[0]) {
      const tool = proxy.kbFileRename as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_file_rename"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_file_delete(params: Parameters<McpKiKbMcpKiKbFsTools["kb_file_delete"]>[0]) {
      const tool = proxy.kbFileDelete as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_file_delete"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_config(params: Parameters<McpKiKbMcpKiKbFsTools["kb_config"]>[0]) {
      const tool = proxy.kbConfig as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_config"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async close() {
      if (ownsRuntime) {
        await runtime.close("mcp-ki-kb-mcp-ki-kb-fs").catch(() => {});
      }
    },
  };
  return client;
}

