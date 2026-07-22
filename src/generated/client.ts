// @ts-nocheck
// Generated on 2026-07-22T14:52:47.075Z by @knowledgeislands/mcp-ki-kb-fs@1.0.0
// Server: mcp-ki-kb-mcp-ki-kb-fs
// Source: /Users/krisbrown/.mcporter/mcporter.json
// Transport: STDIO /Users/krisbrown/.local/share/mise/installs/node/lts/bin/node /Users/krisbrown/workspaces/kis/knowledgeislands/mcp-ki-kb-fs/dist/mcp-server/index.js

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
    async kb_read(params: Parameters<McpKiKbMcpKiKbFsTools["kb_read"]>[0]) {
      const tool = proxy.kbRead as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_read"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_list(params: Parameters<McpKiKbMcpKiKbFsTools["kb_list"]>[0]) {
      const tool = proxy.kbList as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_list"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_write(params: Parameters<McpKiKbMcpKiKbFsTools["kb_write"]>[0]) {
      const tool = proxy.kbWrite as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_write"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_rename(params: Parameters<McpKiKbMcpKiKbFsTools["kb_rename"]>[0]) {
      const tool = proxy.kbRename as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_rename"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_delete(params: Parameters<McpKiKbMcpKiKbFsTools["kb_delete"]>[0]) {
      const tool = proxy.kbDelete as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_delete"]>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async kb_folder_create(params: Parameters<McpKiKbMcpKiKbFsTools["kb_folder_create"]>[0]) {
      const tool = proxy.kbFolderCreate as (args: Parameters<McpKiKbMcpKiKbFsTools["kb_folder_create"]>[0]) => Promise<unknown>;
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

