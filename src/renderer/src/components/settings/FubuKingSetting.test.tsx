import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import { useAppStore } from '@/store'
import { FubuKingSetting } from './FubuKingSetting'
import { SettingsSwitchRow } from './SettingsFormControls'

describe('FubuKing setting', () => {
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

  it('reads current overrides when toggled so another provider update is retained', () => {
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
    expect(updateSettings).toHaveBeenCalledWith({
      agentCmdOverrides: { codex: 'custom-codex', claude: 'fubuking claude --account default' }
    })
  })
})
