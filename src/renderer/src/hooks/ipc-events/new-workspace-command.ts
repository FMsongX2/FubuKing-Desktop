import { buildLinearIssueLinkedWorkItem } from '@/lib/linear-linked-work-item'
import type { LinkedWorkItemSummary } from '@/lib/new-workspace'
import { getLinearIssueWorkspaceName } from '../../../../shared/workspace-name'
import type { AppState } from '../../store/types'

type NewWorkspaceShortcutModalData = {
  telemetrySource: 'shortcut'
  asSession?: true
  prefilledName?: string
  linkedWorkItem?: LinkedWorkItemSummary
}

export function buildNewWorkspaceShortcutModalData(
  state: Pick<AppState, 'activeView' | 'taskPageData' | 'sidebarBody'>
): NewWorkspaceShortcutModalData {
  const linearIssue =
    state.activeView === 'tasks' ? (state.taskPageData.openLinearIssue ?? null) : null
  if (!linearIssue) {
    // Why asSession: the sessions sidebar shows this shortcut on its New session row.
    return state.sidebarBody === 'agents'
      ? { telemetrySource: 'shortcut', asSession: true }
      : { telemetrySource: 'shortcut' }
  }

  return {
    telemetrySource: 'shortcut',
    prefilledName: getLinearIssueWorkspaceName(linearIssue),
    // Cmd+N from a Linear issue mirrors its Start-workspace action with source context.
    linkedWorkItem: buildLinearIssueLinkedWorkItem(linearIssue)
  }
}

export function openNewWorkspaceFromShortcut(
  state: Pick<AppState, 'activeModal' | 'activeView' | 'taskPageData' | 'sidebarBody' | 'openModal'>
): void {
  if (state.activeModal === 'new-workspace-composer') {
    return
  }
  state.openModal('new-workspace-composer', buildNewWorkspaceShortcutModalData(state))
}
