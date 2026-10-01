// 대화 중심 시작 화면에서 프로젝트 추가와 새 세션 진입을 안내한다.
// 프로젝트 설정과 세션 실행은 기존 모달 흐름을 재사용한다.
import { FolderPlus, MessageSquare, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { openWorkspaceCreationComposerWithTourHandoff } from './contextual-tours/workspace-creation-tour-handoff'
import { Button } from './ui/button'

/** 입력: 없음; 반환: 프로젝트 유무에 따라 시작 행동을 제시하는 대화 시작 화면. */
export default function SessionLanding(): React.JSX.Element {
  useTranslation()
  const hasProjects = useAppStore(
    (state) => state.repos.length > 0 || state.folderWorkspaces.length > 0
  )

  /** 입력: 없음; 반환: 없음, 프로젝트 추가 또는 새 대화 작성 창을 연다. */
  function start(): void {
    if (hasProjects) {
      openWorkspaceCreationComposerWithTourHandoff({ asSession: true })
    } else {
      useAppStore.getState().openModal('add-repo')
    }
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8" data-session-landing>
      <div className="w-full max-w-lg space-y-6 text-center">
        <MessageSquare className="mx-auto size-7 text-muted-foreground" />
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">FubuKing</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {translate('components.newSession.welcome', 'What would you like to work on?')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {hasProjects
              ? translate(
                  'components.newSession.welcomeDescription',
                  'Choose a project and start a conversation with your coding agent.'
                )
              : translate(
                  'components.newSession.firstProject',
                  'Add a project folder to start your first conversation.'
                )}
          </p>
        </div>
        <Button onClick={start}>
          {hasProjects ? <Plus /> : <FolderPlus />}
          {hasProjects
            ? translate('components.sidebar.newSession', 'New session')
            : translate('components.newSession.addProject', 'Add a project')}
        </Button>
      </div>
    </div>
  )
}
