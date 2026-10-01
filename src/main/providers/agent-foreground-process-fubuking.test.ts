import { afterEach, describe, expect, it } from 'vitest'
import { resetProcessTableSnapshotForTests } from '../../shared/process-table-snapshot-reader'
import { __setWindowsProcessTreeLoaderForTests } from '../windows/windows-process-table'
import { resolveAgentForegroundProcess } from './agent-foreground-process'

const platform = Object.getOwnPropertyDescriptor(process, 'platform')

afterEach(() => {
  __setWindowsProcessTreeLoaderForTests()
  resetProcessTableSnapshotForTests()
  if (platform) {
    Object.defineProperty(process, 'platform', platform)
  }
})

describe('FubuKing foreground provider after handoff', () => {
  it('follows the current Windows provider underneath the original launcher', async () => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
    resetProcessTableSnapshotForTests()
    __setWindowsProcessTreeLoaderForTests(() => ({
      ProcessDataFlag: { None: 0, Memory: 1, CommandLine: 2, CreationTime: 4 },
      getAllProcesses: (callback) => {
        callback([
          { pid: process.pid, ppid: 0, name: 'vitest.exe', commandLine: 'vitest' },
          { pid: 100, ppid: 1, name: 'powershell.exe', commandLine: 'powershell.exe' },
          {
            pid: 101,
            ppid: 100,
            name: 'fubuking.exe',
            commandLine: 'fubuking.exe claude --account default'
          },
          {
            pid: 102,
            ppid: 101,
            name: 'codex.exe',
            commandLine: 'codex.exe resume current-session'
          }
        ])
      }
    }))
    await expect(resolveAgentForegroundProcess(100, 'fubuking.exe')).resolves.toBe('codex')
  })
})
