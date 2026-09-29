import type React from 'react'
import { MessageSquare, SquareTerminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

type NativeChatViewTabsProps = {
  isChatViewMode: boolean
  onToggleNativeChat?: () => void
}

// Chat | Terminal tabs over one agent session. Choosing the view already shown does nothing,
// so the toggle underneath only ever runs as a switch. Styled from terminal.css through the
// group's class, since primitives take only Tailwind classes.
export function NativeChatViewTabs({
  isChatViewMode,
  onToggleNativeChat
}: NativeChatViewTabsProps): React.JSX.Element {
  const show = (chat: boolean) => (event: React.MouseEvent) => {
    event.stopPropagation()
    if (chat !== isChatViewMode) {
      onToggleNativeChat?.()
    }
  }

  return (
    <div
      role="group"
      aria-label={translate('components.native-chat.viewTabs.label', 'Session view')}
      className="pane-title-view-tabs flex items-center gap-0.5"
    >
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-pressed={isChatViewMode}
        onClick={show(true)}
      >
        <MessageSquare />
        {translate('components.native-chat.viewTabs.chat', 'Chat')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-pressed={!isChatViewMode}
        onClick={show(false)}
      >
        <SquareTerminal />
        {translate('components.native-chat.viewTabs.terminal', 'Terminal')}
      </Button>
    </div>
  )
}
