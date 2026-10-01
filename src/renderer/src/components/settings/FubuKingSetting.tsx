// FubuKing 실행을 제공자별로 켜고 끄는 설정을 표시한다.
// 기존 명령 설정만 갱신하며 사용자 지정 명령과 실행 중 세션은 보존한다.
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

/** 입력: 현재 설정과 갱신 함수; 반환: FubuKing 설치 안내와 제공자별 실행 스위치. */
export function FubuKingSetting({ settings, updateSettings }: FubuKingSettingProps) {
  const overrides = settings.agentCmdOverrides ?? {}

  /** 입력: 제공자와 활성화 여부; 반환: 없음, 최신 명령 설정에 해당 제공자 변경만 반영한다. */
  function toggleAgent(agent: FubuKingAgent, enabled: boolean): void {
    const current = useAppStore.getState().settings?.agentCmdOverrides ?? overrides
    const next = updateFubuKingLaunchCommands(current, agent, enabled)
    if (next !== current) {
      void updateSettings({ agentCmdOverrides: next })
    }
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
