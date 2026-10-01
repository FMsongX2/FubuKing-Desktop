import {
  Search,
  MoreHorizontal,
  FolderPlus,
  CalendarClock,
  ListTodo,
  Smartphone
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import SidebarNewSessionButton from './SidebarNewSessionButton'

export function SessionSidebarNav(): React.JSX.Element {
  useTranslation()
  const showTasks = useAppStore((state) => state.settings?.showTasksButton !== false)
  const showAutomations = useAppStore((state) => state.settings?.showAutomationsButton !== false)
  const showMobile = useAppStore((state) => state.settings?.showMobileButton !== false)

  function search(): void {
    useAppStore.getState().setAgentsShowSearch(true)
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>('[data-session-search-input]')?.focus()
    )
  }

  return (
    <div className="shrink-0 space-y-1 pt-2" data-session-sidebar-navigation>
      <SidebarNewSessionButton />
      <div className="flex items-center gap-1 px-2">
        <Button variant="ghost" size="sm" className="min-w-0 flex-1 justify-start" onClick={search}>
          <Search />
          {translate('components.sidebar.searchSessions', 'Search sessions')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={translate('components.sidebar.moreFeatures', 'More features')}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() =>
                useAppStore
                  .getState()
                  .openModal('new-workspace-composer', { telemetrySource: 'sidebar' })
              }
            >
              <FolderPlus />
              {translate('components.sidebar.newWorkspace', 'New workspace')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => useAppStore.getState().openModal('add-repo')}>
              <FolderPlus />
              {translate('components.newSession.addProject', 'Add a project')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => useAppStore.getState().openModal('worktree-palette')}>
              <Search />
              {translate('components.sidebar.searchProjects', 'Search projects and files')}
            </DropdownMenuItem>
            {showTasks || showAutomations || showMobile ? <DropdownMenuSeparator /> : null}
            {showTasks ? (
              <DropdownMenuItem onSelect={() => useAppStore.getState().openTaskPage()}>
                <ListTodo />
                {translate('components.sidebar.tasks', 'Tasks')}
              </DropdownMenuItem>
            ) : null}
            {showAutomations ? (
              <DropdownMenuItem onSelect={() => useAppStore.getState().openAutomationsPage()}>
                <CalendarClock />
                {translate('components.sidebar.automations', 'Automations')}
              </DropdownMenuItem>
            ) : null}
            {showMobile ? (
              <DropdownMenuItem onSelect={() => useAppStore.getState().openMobilePage()}>
                <Smartphone />
                {translate('components.sidebar.mobile', 'Mobile')}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
