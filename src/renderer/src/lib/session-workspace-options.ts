import type { Repo } from '../../../shared/repo-types'
import type { Worktree } from '../../../shared/worktree/types'
import type { FolderWorkspace } from '../../../shared/folder-workspace-types'
import {
  getWorktreeExecutionHostId,
  parseExecutionHostId,
  toSshExecutionHostId,
  type ExecutionHostId
} from '../../../shared/execution-host'
import { folderWorkspaceKey } from '../../../shared/workspace-scope'
import type { AgentDetectionTarget } from '../hooks/useDetectedAgents'

export type SessionWorkspaceOption = {
  value: string
  worktreeId: string
  executionHostId?: ExecutionHostId
  label: string
  context: string
}

type SessionWorkspaceCatalog = {
  repos: readonly Pick<Repo, 'id' | 'displayName' | 'path' | 'executionHostId' | 'connectionId'>[]
  worktreesByRepo: Record<
    string,
    readonly Pick<
      Worktree,
      'id' | 'displayName' | 'branch' | 'isMainWorktree' | 'isArchived' | 'hostId'
    >[]
  >
  folderWorkspaces: readonly Pick<
    FolderWorkspace,
    'id' | 'name' | 'folderPath' | 'isArchived' | 'connectionId' | 'executionHostId'
  >[]
}

export function buildSessionWorkspaceOptions(
  catalog: SessionWorkspaceCatalog
): SessionWorkspaceOption[] {
  const options: SessionWorkspaceOption[] = []
  const seen = new Set<string>()
  for (const repo of catalog.repos) {
    const name = repo.displayName || repo.path.split(/[\\/]/).pop() || repo.path
    for (const worktree of catalog.worktreesByRepo[repo.id] ?? []) {
      if (worktree.isArchived) {
        continue
      }
      const host = getWorktreeExecutionHostId(worktree, repo)
      const value = JSON.stringify([worktree.id, host])
      if (seen.has(value)) {
        continue
      }
      seen.add(value)
      options.push({
        value,
        worktreeId: worktree.id,
        executionHostId: host,
        label: worktree.isMainWorktree ? name : `${name} · ${worktree.displayName}`,
        context: worktree.branch.replace(/^refs\/heads\//, '')
      })
    }
  }
  for (const folder of catalog.folderWorkspaces) {
    if (folder.isArchived) {
      continue
    }
    const worktreeId = folderWorkspaceKey(folder.id)
    const host =
      folder.executionHostId ??
      (folder.connectionId ? toSshExecutionHostId(folder.connectionId) : undefined)
    const value = JSON.stringify([worktreeId, host ?? null])
    if (seen.has(value)) {
      continue
    }
    seen.add(value)
    options.push({
      value,
      worktreeId,
      executionHostId: host,
      label: folder.name,
      context: folder.folderPath
    })
  }
  return options
}

export function getSessionWorkspaceDetectionTarget(
  option: SessionWorkspaceOption | undefined,
  inherited: AgentDetectionTarget | undefined,
  localContextKey: string
): AgentDetectionTarget | undefined {
  if (!option) {
    return undefined
  }
  const host = parseExecutionHostId(option.executionHostId)
  if (host?.kind === 'ssh') {
    return { kind: 'ssh', connectionId: host.targetId }
  }
  if (host?.kind === 'runtime') {
    return { kind: 'runtime', environmentId: host.environmentId }
  }
  if (host?.kind === 'local' || (!option.executionHostId && inherited?.kind === 'local')) {
    return { kind: 'local', worktreeId: option.worktreeId, contextKey: localContextKey }
  }
  return option.executionHostId ? undefined : inherited
}
