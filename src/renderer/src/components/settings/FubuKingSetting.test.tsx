import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { useAppStore } from '@/store'
import { FubuKingSetting } from './FubuKingSetting'
import { SettingsSwitchRow } from './SettingsFormControls'

describe('FubuKing setting', () => {
  it('keeps both provider commands when persistence of the first switch is delayed', async () => {
    const settings = getDefaultSettings('/tmp')
    useAppStore.setState({ settings })
    const first = Promise.withResolvers<void>()
    let writes = 0
    const updateSettings = vi.fn(async (updates: Partial<GlobalSettings>) => {
      if (++writes === 1) {
        await first.promise
      }
      useAppStore.setState((state) => ({
        settings: { ...(state.settings ?? settings), ...updates }
      }))
    })
    const tree = FubuKingSetting({ settings, updateSettings })
    const rows = React.Children.toArray(tree.props.children)
      .flatMap((child) => (Array.isArray(child) ? child : [child]))
      .filter((child) => React.isValidElement(child) && child.type === SettingsSwitchRow)
    for (const row of rows) {
      if (React.isValidElement<{ onChange: () => void }>(row)) {
        row.props.onChange()
      }
    }
    await Promise.resolve()
    first.resolve()
    await vi.waitFor(() =>
      expect(useAppStore.getState().settings?.agentCmdOverrides).toEqual({
        claude: 'fubuking claude --account default',
        codex: 'fubuking codex --account default'
      })
    )
  })

  it('renders installation guidance and leaves custom commands disabled', () => {
    const settings = getDefaultSettings('/tmp')
    settings.agentCmdOverrides = {
      claude: 'custom-claude',
      codex: 'fubuking codex --account default'
    }
    const markup = renderToStaticMarkup(
      <FubuKingSetting settings={settings} updateSettings={vi.fn()} />
    )
    expect(markup).toContain('Installation guide')
    expect(markup).toContain('Terminal tab')
    expect(markup).toContain('A custom launch command is configured')
    expect(markup).toContain('aria-checked="true"')
    expect(markup).toContain('disabled=""')
  })

  it('reads current overrides when toggled so another provider update is retained', async () => {
    const settings = getDefaultSettings('/tmp')
    const updateSettings = vi.fn()
    const tree = FubuKingSetting({ settings, updateSettings })
    const rows = React.Children.toArray(tree.props.children)
      .flatMap((child) => (Array.isArray(child) ? child : [child]))
      .filter((child) => React.isValidElement(child) && child.type === SettingsSwitchRow)
    expect(rows).toHaveLength(2)
    useAppStore.setState({
      settings: { ...settings, agentCmdOverrides: { codex: 'custom-codex' } }
    })
    const row = rows.find((child) => React.isValidElement(child) && child.key?.includes('claude'))
    expect(React.isValidElement<{ onChange: () => void }>(row)).toBe(true)
    if (React.isValidElement<{ onChange: () => void }>(row)) {
      row.props.onChange()
    }
    await vi.waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({
        agentCmdOverrides: { codex: 'custom-codex', claude: 'fubuking claude --account default' }
      })
    )
  })
})
