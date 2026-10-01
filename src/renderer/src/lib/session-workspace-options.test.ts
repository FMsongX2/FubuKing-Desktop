import { describe, expect, it } from 'vitest'
import { buildSessionWorkspaceOptions } from './session-workspace-options'

describe('session workspace options', () => {
  it('lists existing branches without including archived workspaces', () => {
    const result = buildSessionWorkspaceOptions({
      repos: [{ id: 'project', path: '/repo', displayName: 'Project' }],
      worktreesByRepo: {
        project: [
          {
            id: 'main',
            displayName: 'Main',
            branch: 'refs/heads/main',
            isMainWorktree: true,
            isArchived: false
          },
          {
            id: 'feature',
            displayName: 'Feature',
            branch: 'feature',
            isMainWorktree: false,
            isArchived: false
          },
          { id: 'old', displayName: 'Old', branch: 'old', isMainWorktree: false, isArchived: true }
        ]
      },
      folderWorkspaces: []
    })
    expect(
      result.map(({ worktreeId, label, context }) => ({ worktreeId, label, context }))
    ).toEqual([
      { worktreeId: 'main', label: 'Project', context: 'main' },
      { worktreeId: 'feature', label: 'Project · Feature', context: 'feature' }
    ])
  })

  it('keeps host-qualified folder identities and excludes archived folders', () => {
    const result = buildSessionWorkspaceOptions({
      repos: [],
      worktreesByRepo: {},
      folderWorkspaces: [
        {
          id: 'docs',
          name: 'Docs',
          folderPath: '/srv/docs',
          isArchived: false,
          connectionId: 'server'
        },
        { id: 'old', name: 'Old', folderPath: '/old', isArchived: true }
      ]
    })
    expect(result).toEqual([
      {
        value: JSON.stringify(['folder:docs', 'ssh:server']),
        worktreeId: 'folder:docs',
        executionHostId: 'ssh:server',
        label: 'Docs',
        context: '/srv/docs'
      }
    ])
  })

  it('does not collapse the same workspace locator on different hosts', () => {
    const workspace = {
      id: 'project::/repo',
      displayName: 'Main',
      branch: 'main',
      isMainWorktree: true,
      isArchived: false
    }
    const result = buildSessionWorkspaceOptions({
      repos: [{ id: 'project', path: '/repo', displayName: 'Project' }],
      worktreesByRepo: {
        project: [
          { ...workspace, hostId: 'local' },
          { ...workspace, hostId: 'ssh:server' }
        ]
      },
      folderWorkspaces: []
    })
    expect(new Set(result.map((option) => option.value)).size).toBe(2)
    expect(result.map((option) => option.executionHostId)).toEqual(['local', 'ssh:server'])
  })
})
