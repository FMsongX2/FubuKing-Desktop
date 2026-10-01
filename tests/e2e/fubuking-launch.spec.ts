// 격리된 Desktop에서 설정 스위치부터 실제 FubuKing CLI와 가짜 제공자 실행까지 검사한다.
// 실제 로그인 대신 임시 홈과 가짜 Claude를 사용한다.
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from './helpers/orca-app'
import { getGoldenStubAgentLaunchEnv } from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { waitForTerminalOutput } from './helpers/terminal'
import { quoteStartupArg } from '../../src/shared/tui-agent-startup-shell'

const binary = process.env.FUBUKING_E2E_BINARY
const directory = mkdtempSync(path.join(os.tmpdir(), 'fubuking-desktop-e2e-'))
const logPath = path.join(directory, 'launch.jsonl')
const stub = path.join(process.cwd(), 'tests/e2e/fixtures/golden-stub-agent/golden-stub-agent.js')

if (binary && process.platform !== 'win32') {
  symlinkSync(binary, path.join(directory, 'fubuking'))
  writeFileSync(
    path.join(directory, 'claude'),
    `#!/usr/bin/env node
const { appendFileSync } = require('node:fs')
const { spawnSync } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === '--version') {
  console.log('2.1.283 (Claude Code)')
  process.exit(0)
}
appendFileSync(${JSON.stringify(logPath)}, JSON.stringify({ args, paneKey: process.env.ORCA_PANE_KEY }) + '\\n')
const result = spawnSync(process.execPath, [${JSON.stringify(stub)}, ...args], { stdio: 'inherit' })
process.exit(result.status ?? 1)
`,
    { mode: 0o755 }
  )
}

const launchEnv = getGoldenStubAgentLaunchEnv()
launchEnv.PATH = [directory, launchEnv.PATH ?? process.env.PATH ?? ''].join(path.delimiter)
test.use({ upstreamUiDefaults: false, launchEnv })

/** 입력: 없음; 반환: 없음, 이 spec이 생성한 임시 제공자와 실행 기록만 제거한다. */
test.afterAll(() => rmSync(directory, { recursive: true, force: true }))

test('enables FubuKing in Settings and starts the provider with memory inside the same terminal', async ({
  orcaPage,
  electronApp
}) => {
  test.skip(
    !binary || process.platform === 'win32',
    'Set FUBUKING_E2E_BINARY to a built POSIX FubuKing CLI.'
  )
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  const isolatedHome = await electronApp.evaluate(({ app }) => app.getPath('home'))
  await orcaPage.evaluate(
    async (environment) => {
      await window.__store!.getState().updateSettings({
        agentDefaultEnv: { claude: environment }
      })
    },
    {
      HOME: isolatedHome,
      CLAUDE_CONFIG_DIR: path.join(isolatedHome, '.claude')
    }
  )
  await orcaPage.evaluate(() => {
    const state = window.__store!.getState()
    state.openSettingsTarget({ pane: 'agents', repoId: null })
    state.openSettingsPage()
  })
  const control = orcaPage.getByRole('switch', {
    name: 'Run Claude Code with FubuKing',
    exact: true
  })
  await expect(control).not.toBeChecked()
  await control.click()
  await expect(control).toBeChecked()
  await orcaPage.screenshot({ path: test.info().outputPath('fubuking-settings.png') })
  // 제공자 검색 경로는 로그인 셸을 통과한 뒤 실행 환경에 적용한다.
  await orcaPage.evaluate(
    async (prefix) => {
      const state = window.__store!.getState()
      const command = state.settings?.agentCmdOverrides.claude
      if (!command) {
        throw new Error('FubuKing launch command was not saved')
      }
      await state.updateSettings({ agentCmdOverrides: { claude: `${prefix} ${command}` } })
    },
    `env ${quoteStartupArg(`PATH=${launchEnv.PATH ?? ''}`, 'posix')}`
  )
  await orcaPage.evaluate(() => window.__store!.getState().closeSettingsPage())
  await orcaPage.getByRole('button', { name: 'New tab' }).click({ force: true })
  await orcaPage
    .getByRole('menuitem', { name: /^Claude(?:\s|$)/i })
    .first()
    .click({ force: true })
  const views = orcaPage.getByRole('group', { name: 'Session view' })
  await views.getByRole('button', { name: 'Terminal' }).click()
  await waitForTerminalOutput(orcaPage, 'GOLDEN_STUB_AGENT_READY')
  await expect
    .poll(() => {
      try {
        return readFileSync(logPath, 'utf8')
      } catch {
        return ''
      }
    })
    .toContain('--mcp-config')
  const launched = JSON.parse(readFileSync(logPath, 'utf8').trim().split('\n').at(-1)!)
  expect(launched.paneKey).toBeTruthy()
  expect(launched.args).toContain('mcp__fubuking')
  const configuration = JSON.parse(launched.args[launched.args.indexOf('--mcp-config') + 1])
  expect(configuration.mcpServers.fubuking.args).toEqual(['mcp', '--agent', 'claude-code'])
  await orcaPage.screenshot({ path: test.info().outputPath('fubuking-terminal.png') })
})
