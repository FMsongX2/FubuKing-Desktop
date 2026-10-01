// 실제 스토어로 에이전트 시작 시 창 선택과 최초 메시지 표시를 검사한다.
// 실행 명령 장전과 표시용 메시지 저장이 각각 한 번만 일어나는지 확인한다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID, getDefaultSettings } from '../../../shared/constants'
import { createTestStore, makeWorktree, seedStore } from '../store/slices/store-test-helpers'
import { createStoreCascadesMockApi } from '../store/slices/store-cascades-test-harness'

const storeBox = vi.hoisted(() => {
  const box: { store: unknown } = { store: null }
  return box
})

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn(), message: vi.fn() }
}))

vi.mock('@/store', () => ({
  get useAppStore() {
    return storeBox.store
  }
}))

createStoreCascadesMockApi()

const MAIN_WORKTREE_ID = 'repo1::/path/wt1'

/** 입력: 없음; 반환: 편집기 탭이 선택된 테스트 스토어. */
function seedMainWindowOnEditor(): ReturnType<typeof createTestStore> {
  const store = createTestStore()
  storeBox.store = store
  seedStore(store, {
    settings: getDefaultSettings('/tmp'),
    worktreesByRepo: {
      repo1: [makeWorktree({ id: MAIN_WORKTREE_ID, repoId: 'repo1', path: '/path/wt1' })]
    },
    activeWorktreeId: MAIN_WORKTREE_ID
  })
  const mainTerminal = store.getState().createTab(MAIN_WORKTREE_ID)
  // The main window is showing a non-terminal tab, as in the report.
  store.getState().setActiveTabType('editor', MAIN_WORKTREE_ID)
  expect(store.getState().activeTabId).toBe(mainTerminal.id)
  return store
}

describe('launchAgentInNewTab main-window surface', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows an argv launch request immediately without queueing a second submission', async () => {
    const store = seedMainWindowOnEditor()
    const queue = vi.fn(store.getState().queueTabStartupCommand)
    store.setState({ queueTabStartupCommand: queue })
    const { launchAgentInNewTab } = await import('./launch-agent-in-new-tab')
    const result = launchAgentInNewTab({
      agent: 'claude',
      worktreeId: MAIN_WORKTREE_ID,
      prompt: 'Inspect the renderer'
    })
    if (result?.surface.kind !== 'local-terminal') {
      throw new Error('Expected a terminal launch')
    }
    const tabId = result.surface.tabId
    expect(queue).toHaveBeenCalledTimes(1)
    expect(store.getState().pendingStartupByTabId[tabId]?.command).toContain('Inspect the renderer')
    expect(store.getState().nativeChatLaunchPromptByTabId[tabId]).toMatchObject({
      agent: 'claude',
      text: 'Inspect the renderer',
      createdAt: expect.any(Number)
    })
  })

  it('selects a floating launch in the floating panel without moving the main window', async () => {
    const store = seedMainWindowOnEditor()
    const before = store.getState()
    const { launchAgentInNewTab } = await import('./launch-agent-in-new-tab')

    const result = launchAgentInNewTab({
      agent: 'opencode',
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID
    })

    expect(result?.surface.kind).toBe('local-terminal')
    const tabId = result?.surface.kind === 'local-terminal' ? result.surface.tabId : null
    const state = store.getState()
    expect(state.activeTabType).toBe('editor')
    expect(state.activeTabId).toBe(before.activeTabId)
    expect(state.activeTabTypeByWorktree[MAIN_WORKTREE_ID]).toBe('editor')
    // Why: the floating panel renders the group's active tab, so the launch still lands selected there.
    const floatingGroup = state.groupsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]?.[0]
    expect(floatingGroup?.activeTabId).toBe(tabId)
    expect(state.activeTabIdByWorktree[FLOATING_TERMINAL_WORKTREE_ID]).toBe(tabId)
    expect(state.activeTabTypeByWorktree[FLOATING_TERMINAL_WORKTREE_ID]).toBe('terminal')
  })

  it('still brings a launch in the active worktree to the front', async () => {
    const store = seedMainWindowOnEditor()
    const { launchAgentInNewTab } = await import('./launch-agent-in-new-tab')

    const result = launchAgentInNewTab({ agent: 'opencode', worktreeId: MAIN_WORKTREE_ID })

    const tabId = result?.surface.kind === 'local-terminal' ? result.surface.tabId : null
    expect(tabId).not.toBeNull()
    expect(store.getState().activeTabType).toBe('terminal')
    expect(store.getState().activeTabId).toBe(tabId)
  })
})
