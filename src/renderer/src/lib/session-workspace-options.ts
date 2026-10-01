import type { Repo } from '../../../shared/repo-types'
import type { Worktree } from '../../../shared/worktree/types'
import type { FolderWorkspace } from '../../../shared/folder-workspace-types'
import type { ExecutionHostId } from '../../../shared/execution-host'
import { folderWorkspaceKey } from '../../../shared/workspace-scope'

export type SessionWorkspaceOption = {
  value: string
  worktreeId: string
  executionHostId?: ExecutionHostId
  label: string
  context: string
}

type SessionWorkspaceCatalog = {
  repos: readonly Pick<Repo, 'id' | 'displayName' | 'path' | 'executionHostId'>[]
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
  for (const repo of catalog.repos) {
    const name = repo.displayName || repo.path.split(/[\\/]/).pop() || repo.path
    for (const worktree of catalog.worktreesByRepo[repo.id] ?? []) {
      if (worktree.isArchived) {
        continue
      }
      const host = worktree.hostId ?? repo.executionHostId ?? undefined
      options.push({
        value: JSON.stringify([worktree.id, host ?? null]),
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
      (folder.connectionId ? (`ssh:${folder.connectionId}` as const) : undefined)
    options.push({
      value: JSON.stringify([worktreeId, host ?? null]),
      worktreeId,
      executionHostId: host,
      label: folder.name,
      context: folder.folderPath
    })
  }
  return options
}
