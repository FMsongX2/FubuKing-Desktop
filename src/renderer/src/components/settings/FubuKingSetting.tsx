import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  FUBUKING_AGENTS,
  getFubuKingLaunchCommand,
  updateFubuKingLaunchCommands,
  type FubuKingAgent
} from '../../../../shared/fubuking-launch'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { SettingsSubsectionHeader, SettingsSwitchRow } from './SettingsFormControls'

type FubuKingSettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
}

function createSettingsWriteQueue(): (write: () => Promise<void>) => Promise<void> {
  let pending: Promise<void> = Promise.resolve()
  return (write) => {
    pending = pending.catch(() => {}).then(write)
    return pending
  }
}

const enqueueSettingsWrite = createSettingsWriteQueue()

export function FubuKingSetting({ settings, updateSettings }: FubuKingSettingProps) {
  const overrides = settings.agentCmdOverrides ?? {}

  function toggleAgent(agent: FubuKingAgent, enabled: boolean): void {
    void enqueueSettingsWrite(async () => {
      const current = useAppStore.getState().settings?.agentCmdOverrides ?? overrides
      const next = updateFubuKingLaunchCommands(current, agent, enabled)
      if (next !== current) {
        await updateSettings({ agentCmdOverrides: next })
      }
    }).catch((error) => console.error('FubuKing settings update failed', error))
  }

  return (
    <section className="space-y-3">
      <SettingsSubsectionHeader
        title="FubuKing"
        description={translate(
          'components.settings.fubuking.description',
          'Run Claude Code or Codex with shared repository memory. Usage-limit handoffs ask in the Terminal tab.'
        )}
      />
      <p className="text-xs text-muted-foreground">
        {translate(
          'components.settings.fubuking.installDescription',
          'Install the FubuKing CLI on the execution host before enabling. New sessions start with the account selected here; additional handoff accounts use FubuKing login.'
        )}{' '}
        <a
          href="https://github.com/FMsongX2/FubuKing#quick-start"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          {translate('components.settings.fubuking.installLink', 'Installation guide')}
        </a>
      </p>
      {FUBUKING_AGENTS.map((agent) => {
        const current = overrides[agent]?.trim()
        const enabled = current === getFubuKingLaunchCommand(agent)
        const custom = Boolean(current && current !== agent && !enabled)
        const label =
          agent === 'claude'
            ? translate('components.settings.fubuking.claude', 'Run Claude Code with FubuKing')
            : translate('components.settings.fubuking.codex', 'Run Codex with FubuKing')
        return (
          <SettingsSwitchRow
            key={agent}
            label={label}
            checked={enabled}
            disabled={custom}
            description={
              custom
                ? translate(
                    'components.settings.fubuking.customCommand',
                    'A custom launch command is configured. Reset it below to enable FubuKing.'
                  )
                : undefined
            }
            onChange={() => toggleAgent(agent, !enabled)}
          />
        )
      })}
      {FUBUKING_AGENTS.some(
        (agent) => overrides[agent]?.trim() === getFubuKingLaunchCommand(agent)
      ) ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'components.settings.fubuking.handoffLimitations',
            'After a handoff, continue in Terminal. Synchronizing Chat history and account usage after handoffs is still under development.'
          )}
        </p>
      ) : null}
    </section>
  )
}
