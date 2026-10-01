import { useAppStore } from '@/store'
import { requestContextualTourWhenReady } from './request-contextual-tour-when-ready'

// asSession: opened from a New session control, so the composer is labeled as starting a session.
export function openWorkspaceCreationComposerWithTourHandoff(options?: {
  asSession?: boolean
}): void {
  const state = useAppStore.getState()
  const hasProjects = state.repos.length > 0

  const shouldHandoffFromAgentSessionsTour =
    hasProjects &&
    state.activeContextualTourId === 'workspace-agent-sessions' &&
    state.activeContextualTourStepIndex === 1

  if (shouldHandoffFromAgentSessionsTour && state.activeContextualTourSource) {
    // Why: clicking the highlighted create button is the final tour action.
    // Clear it synchronously so the composer tour request is not blocked by
    // a modal-cancellation effect that may run after the handoff retry window.
    state.detachContextualTourSource('workspace-agent-sessions', state.activeContextualTourSource)
    state.completeContextualTour('workspace-agent-sessions')
  }

  state.openModal('new-workspace-composer', {
    telemetrySource: 'sidebar',
    ...(options?.asSession ? { asSession: true } : {}),
    ...(shouldHandoffFromAgentSessionsTour
      ? { contextualTourSource: 'workspace_creation_modal' }
      : {})
  })

  if (!shouldHandoffFromAgentSessionsTour || options?.asSession) {
    return
  }

  if (state.contextualToursSeenIds.includes('workspace-creation')) {
    return
  }

  requestContextualTourWhenReady({
    id: 'workspace-creation',
    source: 'workspace_creation_modal',
    wasFeaturePreviouslyInteracted: false,
    waitForActiveTourToClear: true,
    shouldContinue: () => useAppStore.getState().activeModal === 'new-workspace-composer'
  })
}
