import { describe, expect, it } from 'vitest'
import { getFubuKingLaunchCommand, updateFubuKingLaunchCommands } from './fubuking-launch'
import {
  isAgentForegroundWrapperProcess,
  recognizeAgentProcessFromCommandLine
} from './agent-process-recognition'
import { buildAgentResumeStartupPlan, buildAgentStartupPlan } from './tui-agent-startup'
import { tokenizeStartupCommand, type AgentStartupShell } from './tui-agent-startup-shell'

function commandTokens(command: string, shell: AgentStartupShell): string[] {
  const parsed = tokenizeStartupCommand(command, shell)
  expect(parsed.ok).toBe(true)
  return parsed.ok ? parsed.tokens : []
}

describe('FubuKing launch integration', () => {
  it('changes only the requested provider and preserves custom commands', () => {
    const original = { codex: 'custom-codex --profile work', cursor: 'cursor-agent --beta' }
    const enabled = updateFubuKingLaunchCommands(original, 'claude', true)
    expect(enabled).toEqual({ ...original, claude: 'fubuking claude --account default' })
    expect(original).not.toHaveProperty('claude')
    expect(updateFubuKingLaunchCommands(enabled, 'claude', false)).toEqual(original)
    expect(updateFubuKingLaunchCommands(original, 'codex', true)).toBe(original)
    expect(updateFubuKingLaunchCommands(original, 'codex', false)).toBe(original)
  })

  it.each([
    { platform: 'darwin', shell: 'posix' },
    { platform: 'linux', shell: 'posix' },
    { platform: 'win32', shell: 'powershell' },
    { platform: 'win32', shell: 'cmd' }
  ] as const)(
    'keeps provider options, prompt bytes and captured resume on $shell',
    ({ platform, shell }) => {
      for (const agent of ['claude', 'codex'] as const) {
        const start = buildAgentStartupPlan({
          agent,
          platform,
          shell,
          prompt: 'fix "quoted" input and $values',
          agentArgs: '--model test-model',
          agentEnv: { TEST_PROFILE: 'selected' },
          cmdOverrides: { [agent]: getFubuKingLaunchCommand(agent) }
        })
        expect(start).not.toBeNull()
        if (!start) {
          continue
        }
        expect(commandTokens(start.launchCommand, shell)).toEqual([
          'fubuking',
          agent,
          '--account',
          'default',
          '--model',
          'test-model',
          'fix "quoted" input and $values'
        ])
        expect(start.expectedProcess).toBe(agent)
        expect(start.env).toEqual({ TEST_PROFILE: 'selected' })
        const resumed = buildAgentResumeStartupPlan({
          agent,
          platform,
          shell,
          cmdOverrides: {},
          agentCommand: start.launchConfig.agentCommand,
          providerSession: { key: 'session_id', id: 'session-123' }
        })
        expect(resumed).not.toBeNull()
        expect(commandTokens(resumed?.launchCommand ?? '', shell)).toEqual([
          'fubuking',
          agent,
          '--account',
          'default',
          '--model',
          'test-model',
          ...(agent === 'claude' ? ['--resume'] : ['resume']),
          'session-123'
        ])
      }
    }
  )

  it('replaces stale Claude resume selectors inside a FubuKing command', () => {
    const resumed = buildAgentResumeStartupPlan({
      agent: 'claude',
      platform: 'linux',
      cmdOverrides: {},
      agentCommand: 'fubuking claude --account default --resume stale --model test-model',
      providerSession: { key: 'session_id', id: 'current' }
    })
    expect(commandTokens(resumed?.launchCommand ?? '', 'posix')).toEqual([
      'fubuking',
      'claude',
      '--account',
      'default',
      '--model',
      'test-model',
      '--resume',
      'current'
    ])
  })

  it('recognizes the provider through FubuKing while excluding memory servers and prompt mentions', () => {
    expect(recognizeAgentProcessFromCommandLine('fubuking claude --account default')).toEqual({
      agent: 'claude',
      processName: 'claude'
    })
    expect(
      recognizeAgentProcessFromCommandLine('"C:\\tools\\fubuking.exe" codex resume id')
    ).toEqual({
      agent: 'codex',
      processName: 'codex'
    })
    expect(recognizeAgentProcessFromCommandLine('fubuking mcp --agent claude')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('fubuking quota "claude"')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('echo fubuking claude')).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine('fubuking claude --account default -p hi')
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('fubuking claude -- --print')).not.toBeNull()
    expect(isAgentForegroundWrapperProcess('fubuking.exe')).toBe(true)
  })
})
