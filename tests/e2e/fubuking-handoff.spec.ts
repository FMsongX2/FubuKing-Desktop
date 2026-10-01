import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  focusActiveTerminalInput,
  waitForActivePanePtyId,
  waitForTerminalOutput
} from './helpers/terminal'
import { quoteStartupArg } from '../../src/shared/tui-agent-startup-shell'
import { runProcess } from '../../src/shared/child-process/run-process'

const binary = process.env.FUBUKING_E2E_BINARY
const fakeBinary = process.env.FUBUKING_E2E_FAKE_BINARY
const directory = mkdtempSync(path.join(os.tmpdir(), 'fubuking-gui-handoff-'))
const bin = path.join(directory, 'bin')
const statePath = path.join(directory, 'state')
mkdirSync(bin)
mkdirSync(statePath)
if (binary && fakeBinary && process.platform !== 'win32') {
  symlinkSync(binary, path.join(bin, 'fubuking'))
  for (const provider of ['claude', 'codex']) {
    symlinkSync(fakeBinary, path.join(bin, provider))
  }
}
const agentPath = [bin, '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(path.delimiter)
test.use({ upstreamUiDefaults: false, launchEnv: { PATH: agentPath } })

test.afterAll(() => rmSync(directory, { recursive: true, force: true }))

test.afterEach(async ({ electronApp: _electronApp }, info) => {
  if (info.status !== info.expectedStatus) {
    await info.attach('fake-cli-calls', {
      body: readFileSync(path.join(statePath, 'calls.jsonl')),
      contentType: 'application/json'
    })
  }
})

test('keeps one terminal through consent, account resume, and Claude to Codex handoff', async ({
  orcaPage,
  electronApp
}) => {
  test.skip(
    !binary || !fakeBinary || process.platform === 'win32',
    'Set built FubuKing and its POSIX handoff fixture binaries.'
  )
  if (!binary) {
    throw new Error('FubuKing binary unavailable')
  }
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  const home = await electronApp.evaluate(({ app }) => app.getPath('home'))
  const env = {
    PATH: agentPath,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_DATA_HOME: path.join(home, '.local/share'),
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    CODEX_HOME: path.join(home, '.codex'),
    FUBUKING_FAKE_STATE: statePath
  }
  const login = await runProcess({
    program: binary,
    args: ['login', 'claude', 'second'],
    env,
    cwd: directory
  })
  expect(login.code, login.stderr).toBe(0)
  const callsPath = path.join(statePath, 'calls.jsonl')
  const second = JSON.parse(readFileSync(callsPath, 'utf8').trim().split('\n').at(-1)!).home
  for (const profile of [env.CLAUDE_CONFIG_DIR, second, env.CODEX_HOME]) {
    mkdirSync(profile, { recursive: true })
    writeFileSync(path.join(profile, 'fake-plan'), 'limit')
  }
  await orcaPage.evaluate(
    async ({ env, command }) => {
      await window.__store!.getState().updateSettings({
        defaultTuiAgent: 'claude',
        agentCmdOverrides: { claude: command },
        agentDefaultEnv: { claude: env }
      })
    },
    {
      env,
      command: `env ${Object.entries(env)
        .map(([key, value]) => quoteStartupArg(`${key}=${value}`, 'posix'))
        .join(' ')} fubuking claude --account default`
    }
  )
  await orcaPage.getByRole('button', { name: /^New session/ }).click()
  const dialog = orcaPage.getByRole('dialog', { name: 'New session' })
  await dialog
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Verify the handoff pipeline')
  await dialog.getByRole('button', { name: /^Start session/ }).click()
  await expect(dialog).toBeHidden()
  await orcaPage
    .getByRole('group', { name: 'Session view' })
    .getByRole('button', { name: 'Terminal' })
    .click()
  const pty = await waitForActivePanePtyId(orcaPage)
  await waitForTerminalOutput(orcaPage, 'resume this session on claude account `second`?', 30_000)
  await focusActiveTerminalInput(orcaPage)
  await orcaPage.keyboard.press('Enter')
  await waitForTerminalOutput(orcaPage, 'Continue in Codex on codex account `default`', 30_000)
  await focusActiveTerminalInput(orcaPage)
  await orcaPage.keyboard.press('Enter')
  await expect
    .poll(
      async () => {
        const calls = readFileSync(callsPath, 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
        return calls.at(-1)?.program
      },
      { timeout: 15_000 }
    )
    .toBe('codex')
  await expect
    .poll(() => orcaPage.evaluate((id) => window.api.pty.confirmForegroundProcess(id), pty), {
      intervals: [50, 100, 200],
      timeout: 8_000
    })
    .toBe('codex')
  expect(await waitForActivePanePtyId(orcaPage)).toBe(pty)
  await waitForTerminalOutput(orcaPage, 'no other account has room', 30_000)
})
