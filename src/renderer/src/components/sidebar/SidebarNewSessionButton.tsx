import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { formatOptionalPrimaryShortcutLabel } from '@/hooks/useShortcutLabel'
import { translate } from '@/i18n/i18n'
import { openWorkspaceCreationComposerWithTourHandoff } from '../contextual-tours/workspace-creation-tour-handoff'

// The sessions sidebar's first row. Same action and shortcut as the header's New workspace,
// which this row replaces in the sessions view, so the creation tour points here instead.
const SidebarNewSessionButton = React.memo(function SidebarNewSessionButton(): React.JSX.Element {
  // Subscribe this memoized row to locale changes before using translate().
  useTranslation()
  const keybindings = useAppStore((s) => s.keybindings)
  const shortcutLabel = formatOptionalPrimaryShortcutLabel('workspace.create', keybindings)
  const openComposer = useCallback(() => {
    openWorkspaceCreationComposerWithTourHandoff({ asSession: true })
  }, [])

  return (
    <div className="shrink-0 px-2 pt-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        data-contextual-tour-target="workspace-create-control"
        onClick={openComposer}
      >
        <Plus />
        <span className="min-w-0 flex-1 truncate text-left">
          {translate('components.sidebar.newSession', 'New session')}
        </span>
        {shortcutLabel ? <span className="text-muted-foreground">{shortcutLabel}</span> : null}
      </Button>
    </div>
  )
})

export default SidebarNewSessionButton
