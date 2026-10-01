// 새 대화에서 선택할 기존 프로젝트 폴더를 표시용 목록으로 만든다.
// 실행 호스트 정체성을 보존하며 폴더나 브랜치를 생성하지 않는다.
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

/** 입력: 호스트별 프로젝트 목록; 반환: 보관되지 않은 기존 작업 폴더와 실행 호스트가 묶인 선택지. */
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
