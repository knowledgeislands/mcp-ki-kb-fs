/**
 * loadConfig reads from the env object it's given, so tests pass explicit envs
 * (no process.env mutation, no module-reset dance). MCP_KB_FS_ROOT_PATH is
 * required, so every load supplies it unless the test is asserting the guard.
 */
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig } from './index.js'

const load = (extra: Record<string, string> = {}) => loadConfig({ MCP_KB_FS_ROOT_PATH: '/tmp/explicit-kb', ...extra })

describe('loadConfig', () => {
  describe('rootPath (MCP_KB_FS_ROOT_PATH)', () => {
    it('expands a leading ~/ to the user home directory', () => {
      expect(load({ MCP_KB_FS_ROOT_PATH: '~/some-kb' }).rootPath).toBe(path.resolve(path.join(os.homedir(), 'some-kb')))
    })

    it('leaves an absolute path unchanged', () => {
      expect(load({ MCP_KB_FS_ROOT_PATH: '/tmp/explicit-kb' }).rootPath).toBe('/tmp/explicit-kb')
    })

    it('throws when MCP_KB_FS_ROOT_PATH is unset', () => {
      expect(() => loadConfig({})).toThrow(/MCP_KB_FS_ROOT_PATH environment variable must be set/)
    })
  })

  describe('parseNonNegativeInt (via MCP_KB_FS_AUDIT_LOG_MAX_BYTES)', () => {
    it('parses a valid integer string', () => {
      expect(load({ MCP_KB_FS_AUDIT_LOG_MAX_BYTES: '2048' }).auditLogMaxBytes).toBe(2048)
    })

    it('defaults to 10 MiB when unset', () => {
      expect(load().auditLogMaxBytes).toBe(10 * 1024 * 1024)
    })

    it('throws on a non-numeric value', () => {
      expect(() => load({ MCP_KB_FS_AUDIT_LOG_MAX_BYTES: 'oops' })).toThrow(/Invalid MCP_KB_FS_AUDIT_LOG_MAX_BYTES="oops"/)
    })

    it('throws on a negative value', () => {
      expect(() => load({ MCP_KB_FS_AUDIT_LOG_MAX_BYTES: '-1' })).toThrow(/Invalid MCP_KB_FS_AUDIT_LOG_MAX_BYTES="-1"/)
    })

    it('defaults auditLogKeep to 5 and parses an override', () => {
      expect(load().auditLogKeep).toBe(5)
      expect(load({ MCP_KB_FS_AUDIT_LOG_KEEP: '3' }).auditLogKeep).toBe(3)
    })
  })

  describe('accessLevel (MCP_KB_FS_ACCESS_LEVEL)', () => {
    it('defaults to read when unset', () => {
      expect(load().accessLevel).toBe('read')
    })

    it('throws on unknown access level', () => {
      expect(() => load({ MCP_KB_FS_ACCESS_LEVEL: 'godmode' })).toThrow(/Invalid MCP_KB_FS_ACCESS_LEVEL="godmode"/)
    })

    it('accepts an explicit valid access level', () => {
      expect(load({ MCP_KB_FS_ACCESS_LEVEL: 'write' }).accessLevel).toBe('write')
    })
  })

  describe('auditLogMode (MCP_KB_FS_AUDIT_LOG)', () => {
    it('defaults to writes when unset', () => {
      expect(load().auditLogMode).toBe('writes')
    })

    it('throws on unknown audit log mode', () => {
      expect(() => load({ MCP_KB_FS_AUDIT_LOG: 'maybe' })).toThrow(/Invalid MCP_KB_FS_AUDIT_LOG="maybe"/)
    })

    it('accepts off / writes / all (case-insensitive)', () => {
      expect(load({ MCP_KB_FS_AUDIT_LOG: 'OFF' }).auditLogMode).toBe('off')
      expect(load({ MCP_KB_FS_AUDIT_LOG: 'all' }).auditLogMode).toBe('all')
    })
  })

  describe('auditLogPath (MCP_KB_FS_AUDIT_LOG_PATH)', () => {
    it('defaults under ~/.local/state/mcp-kb-fs', () => {
      expect(load().auditLogPath).toBe(path.join(os.homedir(), '.local', 'state', 'mcp-kb-fs', 'audit.jsonl'))
    })

    it('expands ~/ and resolves an override', () => {
      expect(load({ MCP_KB_FS_AUDIT_LOG_PATH: '~/logs/a.jsonl' }).auditLogPath).toBe(path.join(os.homedir(), 'logs', 'a.jsonl'))
    })
  })
})
