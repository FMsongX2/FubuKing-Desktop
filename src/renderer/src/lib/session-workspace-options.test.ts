import { describe, expect, it } from 'vitest'
import {
  buildSessionWorkspaceOptions,
  getSessionWorkspaceDetectionTarget
} from './session-workspace-options'
import { toRuntimeExecutionHostId, toSshExecutionHostId } from '../../../shared/execution-host'

describe('session workspace options', () => {
  it('qualifies legacy SSH projects with the canonical host identity', () => {
    const result = buildSessionWorkspaceOptions({
      repos: [{ id: 'project', path: '/repo', displayName: 'Project', connectionId: 'lab|server' }],
      worktreesByRepo: {
        project: [
          {
            id: 'main',
            displayName: 'Main',
            branch: 'main',
            isMainWorktree: true,
            isArchived: false
          }
        ]
      },
      folderWorkspaces: []
    })
    expect(result[0]?.executionHostId).toBe(toSshExecutionHostId('lab|server'))
  })

  it('encodes legacy folder hosts before writing a workspace route', () => {
    const result = buildSessionWorkspaceOptions({
      repos: [],
      worktreesByRepo: {},
      folderWorkspaces: [
        {
          id: 'docs',
          name: 'Docs',
          folderPath: '/docs',
          connectionId: 'lab|server',
          isArchived: false
        }
      ]
    })
    expect(result[0]?.executionHostId).toBe(toSshExecutionHostId('lab|server'))
  })

  it('lists each host-qualified workspace once when project rows are mirrored', () => {
    const result = buildSessionWorkspaceOptions({
      repos: [
        { id: 'project', path: '/repo', displayName: 'Project' },
        { id: 'project', path: '/repo', displayName: 'Project', executionHostId: 'ssh:server' }
      ],
      worktreesByRepo: {
        project: [
          {
            id: 'main',
            displayName: 'Main',
            branch: 'main',
            isMainWorktree: true,
            hostId: 'local',
            isArchived: false
          }
        ]
      },
      folderWorkspaces: []
    })
    expect(result).toHaveLength(1)
  })

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

describe('session workspace detection target', () => {
  const option = { value: 'selected', worktreeId: 'project::main', label: 'Main', context: '' }

  it('decodes SSH and paired-runtime IDs before reading detection caches', () => {
    expect(
      getSessionWorkspaceDetectionTarget(
        { ...option, executionHostId: toSshExecutionHostId('lab|server') },
        undefined,
        'host'
      )
    ).toEqual({ kind: 'ssh', connectionId: 'lab|server' })
    expect(
      getSessionWorkspaceDetectionTarget(
        { ...option, executionHostId: toRuntimeExecutionHostId('remote/one') },
        undefined,
        'host'
      )
    ).toEqual({ kind: 'runtime', environmentId: 'remote/one' })
  })

  it('keeps a selected local project on its own Windows or WSL detection context', () => {
    expect(
      getSessionWorkspaceDetectionTarget(
        { ...option, executionHostId: 'local' },
        { kind: 'runtime', environmentId: 'other' },
        'wsl:Ubuntu'
      )
    ).toEqual({ kind: 'local', worktreeId: option.worktreeId, contextKey: 'wsl:Ubuntu' })
  })

  it('does not probe locally when a hostless folder owner is unresolved', () => {
    expect(getSessionWorkspaceDetectionTarget(option, undefined, 'host')).toBeUndefined()
    expect(getSessionWorkspaceDetectionTarget(undefined, { kind: 'local' }, 'host')).toBeUndefined()
  })
})
