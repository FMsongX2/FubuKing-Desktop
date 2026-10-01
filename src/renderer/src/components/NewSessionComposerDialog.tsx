// 기존 프로젝트에서 첫 메시지로 새 에이전트 대화를 시작한다.
// 실행과 상태 수명은 기존 세션 런처와 호스트가 소유한다.
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowUp, FolderPlus } from 'lucide-react'
import { useAppStore } from '@/store'
import { useTranslation } from 'react-i18next'
import { translate } from '@/i18n/i18n'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { selectExecutionHostDisplayLabel } from '@/lib/execution-host-display-label'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { buildSessionWorkspaceOptions } from '@/lib/session-workspace-options'
import {
  pickQuickWorkspaceAgent,
  resolveQuickWorkspaceAgentSelection
} from '@/lib/quick-workspace-agent-selection'
import {
  useAgentDetectionTargetForWorktree,
  parseAgentDetectionTargetKey
} from '@/hooks/useAgentDetectionTarget'
import { useDetectedAgents } from '@/hooks/useDetectedAgents'
import { isTuiAgentEnabled } from '../../../shared/tui-agent-selection'
import type { TuiAgent } from '../../../shared/tui-agent'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select'
import AgentCombobox from './agent/AgentCombobox'
import AgentSettingsDialog from './agent/AgentSettingsDialog'

/** 입력: 닫기 함수; 반환: 기존 작업 폴더와 에이전트를 선택하는 새 대화 작성 창. */
export function NewSessionComposerDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  useTranslation()
  const repos = useAppStore((state) => state.repos)
  const worktreesByRepo = useAppStore((state) => state.worktreesByRepo)
  const folderWorkspaces = useAppStore((state) => state.folderWorkspaces)
  const settings = useAppStore((state) => state.settings)
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const activeHost = useAppStore((state) => state.activeWorkspaceExecutionHostId)
  const options = useMemo(
    () => buildSessionWorkspaceOptions({ repos, worktreesByRepo, folderWorkspaces }),
    [repos, worktreesByRepo, folderWorkspaces]
  )
  const [selectedValue, setSelectedValue] = useState<string | null>(
    () =>
      options.find(
        (option) =>
          option.worktreeId === activeWorktreeId &&
          (!activeHost || option.executionHostId === activeHost)
      )?.value ?? null
  )
  const selected =
    selectedValue === null ? options[0] : options.find((option) => option.value === selectedValue)
  const inheritedTarget = useAgentDetectionTargetForWorktree(selected?.worktreeId ?? null)
  const target = selected
    ? selected.executionHostId
      ? parseAgentDetectionTargetKey(selected.executionHostId)
      : inheritedTarget
    : undefined
  const { detectedIds, isLoading } = useDetectedAgents(target)
  const [agentOverride, setAgentOverride] = useState<TuiAgent | null | undefined>(undefined)
  const preferred = pickQuickWorkspaceAgent(
    settings?.defaultTuiAgent,
    detectedIds,
    settings?.disabledTuiAgents
  )
  const { quickAgent: agent } = resolveQuickWorkspaceAgentSelection({
    quickAgentOverride: agentOverride,
    preferredQuickAgent: preferred,
    detectedAgentIds: detectedIds,
    disabledTuiAgents: settings?.disabledTuiAgents
  })
  const agents = getAgentCatalog().filter(
    (entry) =>
      isTuiAgentEnabled(entry.id, settings?.disabledTuiAgents) && detectedIds?.includes(entry.id)
  )
  const [prompt, setPrompt] = useState('')
  const messageRef = useRef<HTMLTextAreaElement | null>(null)
  const [agentSettingsOpen, setAgentSettingsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const canSubmit = Boolean(
    selected && agent && prompt.trim() && target && detectedIds && !isLoading && !submitting
  )

  /** 입력: 없음; 반환: 없음, 선택한 호스트의 기존 폴더에 첫 메시지와 함께 새 세션을 장전한다. */
  function submit(): void {
    if (!canSubmit || !selected || !agent || submittingRef.current) {
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      const state = useAppStore.getState()
      const current = buildSessionWorkspaceOptions(state).find(
        (option) => option.value === selected.value
      )
      if (!current) {
        throw new Error(
          translate(
            'components.newSession.projectUnavailable',
            'The selected project is no longer available.'
          )
        )
      }
      state.setActiveView('terminal')
      state.setSidebarBody('agents')
      state.setActiveWorktree(current.worktreeId, current.executionHostId)
      const result = launchAgentInNewTab({
        agent,
        worktreeId: current.worktreeId,
        prompt,
        launchSource: 'shortcut'
      })
      if (!result) {
        throw new Error(
          translate('components.newSession.launchFailed', 'Could not start the session.')
        )
      }
      if (result.surface.kind === 'local-terminal') {
        state.setTabCustomTitle(result.surface.tabId, prompt.trim().split('\n')[0].slice(0, 80))
      }
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  /** 입력: 없음; 반환: 없음, 기존 프로젝트 추가 흐름으로 전환한다. */
  function addProject(): void {
    useAppStore.getState().openModal('add-repo')
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submittingRef.current) {
          onClose()
        }
      }}
    >
      <DialogContent
        className="sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          if (submittingRef.current) {
            event.preventDefault()
          }
        }}
        onOpenAutoFocus={(event) => {
          if (messageRef.current) {
            event.preventDefault()
            messageRef.current.focus()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{translate('components.sidebar.newSession', 'New session')}</DialogTitle>
          <DialogDescription>
            {translate(
              'components.newSession.description',
              'Start a conversation in an existing project.'
            )}
          </DialogDescription>
        </DialogHeader>
        {options.length === 0 ? (
          <Button variant="outline" onClick={addProject}>
            <FolderPlus />
            {translate('components.newSession.addProject', 'Add a project')}
          </Button>
        ) : (
          <>
            <Textarea
              ref={messageRef}
              aria-label={translate('components.newSession.message', 'Message')}
              placeholder={translate(
                'components.newSession.placeholder',
                'What would you like to work on?'
              )}
              rows={5}
              value={prompt}
              disabled={submitting}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing &&
                  event.keyCode !== 229
                ) {
                  event.preventDefault()
                  submit()
                }
              }}
            />
            <div className="space-y-3">
              <Select
                value={selected?.value ?? ''}
                onValueChange={setSelectedValue}
                disabled={submitting}
              >
                <SelectTrigger
                  className="w-full min-w-0"
                  aria-label={translate('components.newSession.project', 'Project')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                      {option.context ? ` · ${option.context}` : ''}
                      {option.executionHostId && option.executionHostId !== 'local'
                        ? ` · ${selectExecutionHostDisplayLabel(useAppStore.getState(), option.executionHostId)}`
                        : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <AgentCombobox
                    agents={agents}
                    value={agent}
                    onValueChange={setAgentOverride}
                    allowNarrowTrigger
                    allowBlankTerminal={false}
                    onOpenManageAgents={() => setAgentSettingsOpen(true)}
                  />
                </div>
                <Button
                  onClick={submit}
                  disabled={!canSubmit}
                  aria-label={translate(
                    'components.newWorkspaceComposer.startSession',
                    'Start session'
                  )}
                >
                  <ArrowUp />
                  {translate('components.newWorkspaceComposer.startSession', 'Start session')}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {translate(
                'components.newSession.keyboardHint',
                'Enter to start · Shift+Enter for a new line'
              )}
            </p>
          </>
        )}
      </DialogContent>
      <AgentSettingsDialog open={agentSettingsOpen} onOpenChange={setAgentSettingsOpen} />
    </Dialog>
  )
}
