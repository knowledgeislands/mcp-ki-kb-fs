// @ts-nocheck
// Generated on 2026-06-24T14:59:13.387Z by @knowledgeislands/mcp-kb-fs@1.0.0
// Server: mcp-kb-mcp-kb-fs
// Source: /Users/krisbrown/.mcporter/mcporter.json
// Transport: STDIO node /Users/krisbrown/kis/knowledgeislands/mcp-kb-fs/dist/mcp-server/index.js

import { createRuntime, createServerProxy, wrapCallResult } from 'mcporter'
import type { McpKbMcpKbFsTools } from './types.d'

type RuntimeInstance = Awaited<ReturnType<typeof createRuntime>>
export type McpKbMcpKbFsClient = McpKbMcpKbFsTools & { close(): Promise<void> }

export interface CreateClientOptions {
  runtime?: RuntimeInstance
  configPath?: string
  rootDir?: string
}

export async function createMcpKbMcpKbFsClient(options: CreateClientOptions = {}): Promise<McpKbMcpKbFsClient> {
  const runtime =
    options.runtime ??
    (await createRuntime({
      configPath: options.configPath,
      rootDir: options.rootDir
    }))
  const ownsRuntime = !options.runtime
  const proxy = createServerProxy(runtime, 'mcp-kb-mcp-kb-fs')
  const client: McpKbMcpKbFsClient = {
    async kb_note_read(params: Parameters<McpKbMcpKbFsTools['kb_note_read']>[0]) {
      const tool = proxy.kbNoteRead as (args: Parameters<McpKbMcpKbFsTools['kb_note_read']>[0]) => Promise<unknown>
      const raw = await tool(params)
      return wrapCallResult(raw).callResult
    },

    async kb_notes_list(params: Parameters<McpKbMcpKbFsTools['kb_notes_list']>[0]) {
      const tool = proxy.kbNotesList as (args: Parameters<McpKbMcpKbFsTools['kb_notes_list']>[0]) => Promise<unknown>
      const raw = await tool(params)
      return wrapCallResult(raw).callResult
    },

    async kb_folders_list(params: Parameters<McpKbMcpKbFsTools['kb_folders_list']>[0]) {
      const tool = proxy.kbFoldersList as (args: Parameters<McpKbMcpKbFsTools['kb_folders_list']>[0]) => Promise<unknown>
      const raw = await tool(params)
      return wrapCallResult(raw).callResult
    },

    async kb_note_write(params: Parameters<McpKbMcpKbFsTools['kb_note_write']>[0]) {
      const tool = proxy.kbNoteWrite as (args: Parameters<McpKbMcpKbFsTools['kb_note_write']>[0]) => Promise<unknown>
      const raw = await tool(params)
      return wrapCallResult(raw).callResult
    },

    async kb_note_rename(params: Parameters<McpKbMcpKbFsTools['kb_note_rename']>[0]) {
      const tool = proxy.kbNoteRename as (args: Parameters<McpKbMcpKbFsTools['kb_note_rename']>[0]) => Promise<unknown>
      const raw = await tool(params)
      return wrapCallResult(raw).callResult
    },

    async kb_folder_create(params: Parameters<McpKbMcpKbFsTools['kb_folder_create']>[0]) {
      const tool = proxy.kbFolderCreate as (args: Parameters<McpKbMcpKbFsTools['kb_folder_create']>[0]) => Promise<unknown>
      const raw = await tool(params)
      return wrapCallResult(raw).callResult
    },

    async kb_note_delete(params: Parameters<McpKbMcpKbFsTools['kb_note_delete']>[0]) {
      const tool = proxy.kbNoteDelete as (args: Parameters<McpKbMcpKbFsTools['kb_note_delete']>[0]) => Promise<unknown>
      const raw = await tool(params)
      return wrapCallResult(raw).callResult
    },

    async close() {
      if (ownsRuntime) {
        await runtime.close('mcp-kb-mcp-kb-fs').catch(() => {})
      }
    }
  }
  return client
}
