import React from 'react'
import { useAppStore } from '@/store'
import { getTabDragLabel } from './tab-bar-item-model'
import { findTabAgentEntry } from '../native-chat/native-chat-tab-agent-entry'
import { isNativeChatTabWideFallbackSafe } from '../native-chat/native-chat-leaf-routing'
import { useTabStripOverflowNavigation } from './tab-strip-overflow-navigation'
import { useTabStripDragScrollHandlers } from './tab-strip-drag-scroll'
import type { TabBarProps } from './tab-bar-props'
import type { TabBarItem } from './tab-bar-item-model'
import { useTabBarRuntimeModel } from './use-tab-bar-runtime-model'
import { useTabBarCreateMenuController } from './use-tab-bar-create-menu-controller'
import { useTabBarItemProjection } from './use-tab-bar-item-projection'
import { renderTabBarSurface } from './tab-bar-surface'
import { useActiveClientHostedBrowserRowId } from '@/lib/pane-manager/client-hosted-browser-row-state'

function SessionTitle({
  item,
  generated
}: {
  item: TabBarItem
  generated: boolean
}): React.JSX.Element {
  const prompt = useAppStore((state) => {
    if (item.type !== 'terminal') {
      return ''
    }
    const layout = state.terminalLayoutsByTabId[item.data.id]
    if (layout?.chatLeafId) {
      return state.agentStatusByPaneKey[`${item.data.id}:${layout.chatLeafId}`]?.prompt ?? ''
    }
    return isNativeChatTabWideFallbackSafe(layout)
      ? (findTabAgentEntry(state.agentStatusByPaneKey, item.data.id)?.prompt ?? '')
      : ''
  })
  const stable =
    item.type === 'terminal' &&
    (item.data.customTitle || item.data.aiVaultTitle || (generated && item.data.generatedTitle))
  const title = stable || !prompt ? getTabDragLabel(item, generated) : prompt.trim().split('\n')[0]
  return <span className="truncate text-sm font-medium">{title}</span>
}

function TabBarInner(props: TabBarProps): React.JSX.Element {
  const {
    worktreeId,
    groupId,
    terminalOnly = false,
    onNewTerminalTab,
    onNewTerminalWithShell,
    onNewBrowserTab,
    onNewSimulatorTab,
    onNewFileTab,
    onOpenFileTab,
    onPinFile
  } = props
  const runtime = useTabBarRuntimeModel({ worktreeId, groupId })
  const createMenu = useTabBarCreateMenuController({
    worktreeId,
    resolvedGroupId: runtime.resolvedGroupId,
    terminalOnly,
    mobileEmulatorEnabled: runtime.mobileEmulatorEnabled,
    managedBrowserCreationEnabled: runtime.managedBrowserCreationEnabled,
    mobileEmulatorCreationEnabled: runtime.mobileEmulatorCreationEnabled,
    workspaceHasSimulatorTab: runtime.workspaceHasSimulatorTab,
    showWindowsShellMenu: runtime.showWindowsShellMenu,
    projectRuntimeShellMenuMode: runtime.projectRuntimeShellMenuMode,
    defaultWindowsShell: runtime.defaultWindowsShell,
    defaultWindowsPowerShellImplementation: runtime.defaultWindowsPowerShellImplementation,
    windowsTerminalCapabilities: runtime.windowsTerminalCapabilities,
    agentLaunchOptions: runtime.agentLaunchOptions,
    onNewTerminalTab,
    onNewTerminalWithShell,
    onNewBrowserTab,
    onNewSimulatorTab,
    onNewFileTab,
    onOpenFileTab
  })
  const itemProjection = useTabBarItemProjection({
    props,
    resolvedGroupId: runtime.resolvedGroupId,
    unifiedTabs: runtime.unifiedTabs,
    unifiedTabByVisibleId: runtime.unifiedTabByVisibleId,
    generatedTabTitlesEnabled: runtime.generatedTabTitlesEnabled,
    statusByRelativePath: runtime.statusByRelativePath
  })
  const togglePinned = (item: TabBarItem): void => {
    // pinTab/unpinTab mirror the change to the host for remote-server tabs.
    if (item.isPinned) {
      runtime.unpinTab(item.unifiedTabId)
      return
    }
    if (item.type === 'editor' && onPinFile) {
      onPinFile(item.data.id, item.unifiedTabId)
      return
    }
    runtime.pinTab(item.unifiedTabId)
  }
  const tabStripNavigation = useTabStripOverflowNavigation({
    activeVisibleTabId: itemProjection.activeVisibleTabId,
    layoutKey: itemProjection.tabStripLayoutKey,
    tabCount: itemProjection.orderedItems.length,
    worktreeId
  })
  const tabStripDragScroll = useTabStripDragScrollHandlers(tabStripNavigation.scrollTabStrip, {
    start: tabStripNavigation.tabStripOverflowState.canScrollStart,
    end: tabStripNavigation.tabStripOverflowState.canScrollEnd
  })
  // Read here, not just where the rows render: the real tabs have to know when a row took over.
  const activeClientHostedBrowserRowId = useActiveClientHostedBrowserRowId({
    worktreeId,
    groupId: runtime.resolvedGroupId,
    groupActiveTabId: props.groupActiveTabId ?? null
  })

  const sessionsSidebar = useAppStore((state) => state.sidebarBody === 'agents')
  const active = itemProjection.orderedItems.find(
    (item) => item.id === itemProjection.activeVisibleTabId
  )
  const activeUnifiedTab = active ? runtime.unifiedTabByVisibleId.get(active.id) : undefined
  const showSession =
    sessionsSidebar &&
    !activeClientHostedBrowserRowId &&
    (active?.type === 'agent-session' ||
      (active?.type === 'terminal' && activeUnifiedTab?.viewMode === 'chat'))
  const surface = renderTabBarSurface({
    props,
    runtime,
    createMenu,
    itemProjection,
    tabStripNavigation,
    tabStripDragScroll,
    activeClientHostedBrowserRowId,
    togglePinned
  })
  return (
    <>
      {showSession && active ? (
        <div className="flex h-10 min-w-0 flex-1 items-center px-4" data-session-titlebar>
          <SessionTitle item={active} generated={runtime.generatedTabTitlesEnabled} />
        </div>
      ) : null}
      <div className={showSession ? 'hidden' : 'contents'} aria-hidden={showSession || undefined}>
        {surface}
      </div>
    </>
  )
}

export default React.memo(TabBarInner)
