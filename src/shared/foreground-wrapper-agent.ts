// 실제 에이전트를 같은 정체성 그룹의 소유 프로세스와 연결한다.
// 제공자를 교체하는 런처는 에이전트 수명의 기준으로 삼지 않는다.
import {
  recognizeAgentProcess,
  recognizeAgentProcessFromCommandLine,
  type RecognizedAgentProcess
} from './agent-process-recognition'
import { getSyntheticAgentTitleProfile } from './synthetic-agent-title'

export type ForegroundAgentCandidate = {
  pid: number
  ppid: number
  command: string
  name?: string
}

export function shouldInspectOuterWrapperForegroundProcess(
  process: RecognizedAgentProcess
): boolean {
  // Why: only Pi is currently embedded by a same-group wrapper; scanning OMP would add a subprocess to every relay poll.
  return process.agent === 'pi'
}

/** Same gate for a bare process name, recognizing it first. */
export function shouldInspectOuterWrapperForegroundName(processName: string | null): boolean {
  const recognized = recognizeAgentProcess(processName)
  return recognized !== null && shouldInspectOuterWrapperForegroundProcess(recognized)
}

/**
 * Collapse a foreground read onto its outermost same-title-group ancestor.
 * Why: OMP embeds Pi, while depth alone cannot distinguish wrappers from sibling jobs.
 */
export function resolveOuterWrapperForegroundProcess(
  winner: RecognizedAgentProcess,
  winnerCandidate: ForegroundAgentCandidate,
  descendants: readonly ForegroundAgentCandidate[]
): string {
  return resolveOuterWrapperForegroundIdentity(winner, winnerCandidate, descendants).processName
}

/**
 * Same collapse, keeping the pid of the process the name belongs to.
 * Why: a liveness anchor must follow the REPORTED process — anchoring the
 * outer wrapper's name to the embedded leaf's pid reads the leaf's exit as
 * the wrapper's.
 */
/** 입력: 실제 제공자와 호스트 계보; 반환: 같은 정체성 그룹의 소유 프로세스 이름과 수명 기준 PID. */
export function resolveOuterWrapperForegroundIdentity(
  winner: RecognizedAgentProcess,
  winnerCandidate: ForegroundAgentCandidate,
  descendants: readonly ForegroundAgentCandidate[]
): { processName: string; processId: number } {
  const winnerGroup = getSyntheticAgentTitleProfile(winner.agent)?.titleIdentityGroup
  if (!winnerGroup) {
    return { processName: winner.processName, processId: winnerCandidate.pid }
  }
  const candidatesByPid = new Map(descendants.map((candidate) => [candidate.pid, candidate]))
  const seen = new Set<number>([winnerCandidate.pid])
  let outerProcessName = winner.processName
  let outerProcessId = winnerCandidate.pid
  let parentPid = winnerCandidate.ppid
  while (!seen.has(parentPid)) {
    seen.add(parentPid)
    const candidate = candidatesByPid.get(parentPid)
    if (!candidate) {
      break
    }
    const recognized =
      recognizeAgentProcessFromCommandLine(candidate.command, { ignoreFubuKingLauncher: true }) ??
      recognizeAgentProcessFromCommandLine(candidate.name)
    if (
      recognized &&
      getSyntheticAgentTitleProfile(recognized.agent)?.titleIdentityGroup === winnerGroup
    ) {
      outerProcessName = recognized.processName
      outerProcessId = candidate.pid
    }
    parentPid = candidate.ppid
  }
  return { processName: outerProcessName, processId: outerProcessId }
}
