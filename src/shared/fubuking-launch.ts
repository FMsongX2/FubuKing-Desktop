import type { TuiAgent } from './tui-agent'

export type FubuKingAgent = 'claude' | 'codex'
export const FUBUKING_AGENTS: readonly FubuKingAgent[] = ['claude', 'codex']

export function getFubuKingLaunchCommand(agent: FubuKingAgent): string {
  return `fubuking ${agent} --account default`
}

export function updateFubuKingLaunchCommands(
  overrides: Partial<Record<TuiAgent, string>>,
  agent: FubuKingAgent,
  enabled: boolean
): Partial<Record<TuiAgent, string>> {
  const current = overrides[agent]?.trim()
  const command = getFubuKingLaunchCommand(agent)
  if (current && current !== agent && current !== command) {
    return overrides
  }
  if (!enabled && current !== command) {
    return overrides
  }
  const next = { ...overrides }
  if (enabled) {
    next[agent] = command
  } else {
    delete next[agent]
  }
  return next
}

export function getFubuKingAgentIndex(tokens: readonly string[]): number | null {
  const commandIndex = tokens[0] === '&' ? 1 : 0
  if (!isFubuKingExecutable(tokens[commandIndex])) {
    return null
  }
  const agentIndex = commandIndex + 1
  return tokens[agentIndex] === 'claude' || tokens[agentIndex] === 'codex' ? agentIndex : null
}

export function isFubuKingExecutable(value: string | null | undefined): boolean {
  const executable = value
    ?.trim()
    .replace(/^["']|["']$/g, '')
    .split(/[\\/]/)
    .pop()
    ?.toLowerCase()
  return executable === 'fubuking' || executable === 'fubuking.exe'
}
