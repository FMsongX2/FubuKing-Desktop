// FubuKing 실행을 기존 에이전트 명령 설정에 연결한다.
// 계정 환경과 세션 수명은 실행 호스트와 FubuKing CLI가 소유한다.
import type { TuiAgent } from './tui-agent'

export type FubuKingAgent = 'claude' | 'codex'
export const FUBUKING_AGENTS: readonly FubuKingAgent[] = ['claude', 'codex']

/** 입력: 지원 에이전트; 반환: 호스트가 선택한 계정 환경에서 시작하는 실행 명령. */
export function getFubuKingLaunchCommand(agent: FubuKingAgent): string {
  return `fubuking ${agent} --account default`
}

/** 입력: 현재 명령 설정, 에이전트, 활성화 여부; 반환: 사용자 지정 명령을 보존한 새 명령 설정. */
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

/** 입력: 명령 토큰; 반환: FubuKing이 실행하는 제공자 토큰 위치, 지원하지 않는 명령이면 null. */
export function getFubuKingAgentIndex(tokens: readonly string[]): number | null {
  const commandIndex = tokens[0] === '&' ? 1 : 0
  if (!isFubuKingExecutable(tokens[commandIndex])) {
    return null
  }
  const agentIndex = commandIndex + 1
  return tokens[agentIndex] === 'claude' || tokens[agentIndex] === 'codex' ? agentIndex : null
}

/** 입력: 실행 파일 이름이나 경로; 반환: 제공자 인계 중에도 살아 있는 FubuKing 부모 프로세스인지 여부. */
export function isFubuKingExecutable(value: string | null | undefined): boolean {
  const executable = value
    ?.trim()
    .replace(/^["']|["']$/g, '')
    .split(/[\\/]/)
    .pop()
    ?.toLowerCase()
  return executable === 'fubuking' || executable === 'fubuking.exe'
}
