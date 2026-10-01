import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { quoteStartupArg } from '../../src/shared/tui-agent-startup-shell'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from './helpers/orca-app'
import { configureGoldenStubAgent, getGoldenStubAgentLaunchEnv } from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { waitForActivePaneHookDescriptor, waitForTerminalOutput } from './helpers/terminal'
import { runProcess } from '../../src/shared/child-process/run-process'

test.use({ upstreamUiDefaults: false, launchEnv: getGoldenStubAgentLaunchEnv() })

const SESSION_PROMPT = 'Move the session list to the left'
const LAST_USER_TURN = 'Keep the right-hand tabs as they are.'

function claudeTranscript(sessionId: string): string {
  const rows = [
    ['user', `${SESSION_PROMPT} and open sessions in Chat first.`],
    ['assistant', 'The sidebar now opens on Sessions, grouped by project.'],
    ['user', LAST_USER_TURN],
    ['assistant', 'Left untouched.']
  ]
  const start = Date.now() - rows.length * 1_000
  return `${rows
    .map(([role, text], index) =>
      JSON.stringify({
        sessionId,
        uuid: `${sessionId}-${index}`,
        timestamp: new Date(start + index * 1_000).toISOString(),
        type: role,
        message: { role, model: 'claude-opus-4', content: [{ type: 'text', text }] }
      })
    )
    .join('\n')}\n`
}

test('opens on sessions, starts agent tabs in Chat, and keeps Terminal one click away', async ({
  orcaPage
}) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)

  await expect(orcaPage.locator('[data-sidebar-section-title="sessions"]')).toHaveText('Sessions')
  await expect(orcaPage.getByText('No sessions yet.', { exact: true })).toBeVisible()

  await orcaPage.getByRole('button', { name: /^New session/ }).click()
  const composer = orcaPage.getByRole('dialog', { name: 'New session' })
  await expect(composer).toBeVisible()
  await expect(composer.getByRole('button', { name: /^Start session/ })).toBeVisible()
  await expect(composer.getByRole('textbox', { name: 'Message', exact: true })).toBeFocused()
  await orcaPage.screenshot({
    path: test.info().outputPath('new-session.png'),
    animations: 'disabled'
  })
  await orcaPage.keyboard.press('Escape')
  await expect(composer).toBeHidden()

  await configureGoldenStubAgent(orcaPage, { agent: 'claude' })
  await orcaPage.getByRole('button', { name: 'New tab' }).click({ force: true })
  await orcaPage
    .getByRole('menuitem', { name: /^Claude(?:\s|$)/i })
    .first()
    .click({ force: true })

  const views = orcaPage.getByRole('group', { name: 'Session view' })
  const chat = views.getByRole('button', { name: 'Chat' })
  const terminal = views.getByRole('button', { name: 'Terminal' })
  const chatRoot = orcaPage.locator('[data-native-chat-root="true"]')
  await expect(chat).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 })
  await expect(chatRoot).toBeVisible()

  await expect(orcaPage.locator('[data-session-titlebar]')).toBeVisible()

  const descriptor = await waitForActivePaneHookDescriptor(orcaPage)
  const sessionId = `fubuking-${randomUUID()}`
  const transcriptPath = path.join(
    mkdtempSync(path.join(os.tmpdir(), 'fubuking-e2e-transcript-')),
    `${sessionId}.jsonl`
  )
  writeFileSync(transcriptPath, claudeTranscript(sessionId))
  await orcaPage.evaluate(
    ({ paneKey, worktreeId, prompt, id, transcriptPath }) => {
      window.__store
        ?.getState()
        .setAgentStatus(
          paneKey,
          { state: 'done', prompt, agentType: 'claude' },
          'Claude',
          undefined,
          { worktreeId },
          { providerSession: { key: 'session_id', id, transcriptPath } }
        )
    },
    {
      paneKey: descriptor.paneKey,
      worktreeId: descriptor.worktreeId,
      prompt: SESSION_PROMPT,
      id: sessionId,
      transcriptPath
    }
  )

  await expect(orcaPage.getByRole('button', { name: SESSION_PROMPT, exact: true })).toBeVisible()
  await expect(orcaPage.locator('[data-session-titlebar]')).toHaveText(SESSION_PROMPT)
  await expect(orcaPage.getByText(LAST_USER_TURN, { exact: true })).toBeVisible({
    timeout: 30_000
  })
  await orcaPage.screenshot({
    path: test.info().outputPath('conversation.png'),
    animations: 'disabled'
  })
  await orcaPage.evaluate(async () => window.__store!.getState().updateSettings({ theme: 'dark' }))
  await expect(orcaPage.locator('html')).toHaveClass(/dark/)
  await orcaPage.screenshot({
    path: test.info().outputPath('conversation-dark.png'),
    animations: 'disabled'
  })

  await terminal.click()
  await expect(terminal).toHaveAttribute('aria-pressed', 'true')
  await expect(chatRoot).toBeHidden()
  await chat.click()
  await expect(chatRoot).toBeVisible()

  await orcaPage.getByRole('button', { name: 'Show workspaces', exact: true }).click()
  await expect(orcaPage.locator('[data-worktree-sidebar]')).toBeVisible()
})

test('starts a conversation in the selected project without creating a worktree', async ({
  orcaPage,
  seededRepoPath
}) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await configureGoldenStubAgent(orcaPage, { agent: 'claude' })
  const before = await runProcess({
    program: 'git',
    args: ['worktree', 'list', '--porcelain'],
    cwd: seededRepoPath
  })
  expect(before.code).toBe(0)
  await orcaPage.getByRole('button', { name: /^New session/ }).click()
  const dialog = orcaPage.getByRole('dialog', { name: 'New session' })
  const message = dialog.getByRole('textbox', { name: 'Message', exact: true })
  await expect(message).toBeFocused()
  await message.fill('Review the rendering pipeline')
  await expect(dialog.getByRole('button', { name: /^Start session/ })).toBeEnabled()
  await message.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(orcaPage.locator('[data-session-titlebar]')).toHaveText(
    'Review the rendering pipeline'
  )
  await expect(
    orcaPage
      .locator('[data-native-chat-root="true"]')
      .getByText('Review the rendering pipeline', { exact: true })
  ).toBeVisible()
  await expect(
    orcaPage.getByRole('group', { name: 'Session view' }).getByRole('button', { name: 'Chat' })
  ).toHaveAttribute('aria-pressed', 'true')
  const after = await runProcess({
    program: 'git',
    args: ['worktree', 'list', '--porcelain'],
    cwd: seededRepoPath
  })
  expect(after.code).toBe(0)
  expect(after.stdout).toBe(before.stdout)
  await orcaPage.getByRole('button', { name: 'More features', exact: true }).click()
  await expect(orcaPage.getByRole('menuitem', { name: 'Tasks', exact: true })).toBeVisible()
})

test.describe('first project', () => {
  test.use({ seedTestRepo: false })
  test('shows a conversation landing with a direct project action', async ({ orcaPage }) => {
    await waitForSessionReady(orcaPage)
    await expect(orcaPage.locator('[data-session-landing]')).toBeVisible()
    await expect(
      orcaPage
        .locator('[data-session-landing]')
        .getByRole('button', { name: 'Add a project', exact: true })
    ).toBeVisible()
    await expect(orcaPage.getByRole('button', { name: 'More features', exact: true })).toBeVisible()
    await orcaPage.screenshot({
      path: test.info().outputPath('first-project.png'),
      animations: 'disabled'
    })
  })
})

test('keeps composition and blank messages from submitting and launches once on repeated Enter', async ({
  orcaPage
}) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await configureGoldenStubAgent(orcaPage, { agent: 'claude' })
  const count = () =>
    orcaPage.evaluate(() => Object.values(window.__store!.getState().tabsByWorktree).flat().length)
  const before = await count()
  await orcaPage.getByRole('button', { name: /^New session/ }).click()
  const dialog = orcaPage.getByRole('dialog', { name: 'New session' })
  const message = dialog.getByRole('textbox', { name: 'Message', exact: true })
  await message.fill('   ')
  await expect(dialog.getByRole('button', { name: /^Start session/ })).toBeDisabled()
  await message.fill('검증할 메시지')
  await message.dispatchEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 229,
    isComposing: true
  })
  await expect(dialog).toBeVisible()
  expect(await count()).toBe(before)
  await message.press('Shift+Enter')
  await expect(message).toHaveValue('검증할 메시지\n')
  await message.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })
    )
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })
    )
  })
  await expect(dialog).toBeHidden()
  expect(await count()).toBe(before + 1)
})

test('does not launch when every detected agent is disabled', async ({ orcaPage }) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await orcaPage.evaluate(async () => {
    const state = window.__store!.getState()
    await state.updateSettings({ disabledTuiAgents: state.detectedAgentIds ?? [] })
  })
  await orcaPage.getByRole('button', { name: /^New session/ }).click()
  const dialog = orcaPage.getByRole('dialog', { name: 'New session' })
  await dialog
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Do not start an unavailable agent')
  await expect(dialog.getByRole('button', { name: /^Start session/ })).toBeDisabled()
  await orcaPage.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('opens the session filter and keeps optional navigation flags authoritative', async ({
  orcaPage
}) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await orcaPage.getByRole('button', { name: 'Search sessions', exact: true }).click()
  await expect(orcaPage.locator('[data-session-search-input]')).toBeFocused()
  await orcaPage.evaluate(async () =>
    window.__store!.getState().updateSettings({
      showTasksButton: false,
      showAutomationsButton: false,
      showMobileButton: false
    })
  )
  await orcaPage.getByRole('button', { name: 'More features', exact: true }).click()
  await expect(orcaPage.getByRole('menuitem', { name: 'Tasks', exact: true })).toHaveCount(0)
  await expect(orcaPage.getByRole('menuitem', { name: 'Automations', exact: true })).toHaveCount(0)
  await expect(orcaPage.getByRole('menuitem', { name: 'Mobile', exact: true })).toHaveCount(0)
  await expect(orcaPage.getByRole('menuitem', { name: 'New workspace', exact: true })).toBeVisible()
  await expect(orcaPage.getByRole('menuitem', { name: 'Add a project', exact: true })).toBeVisible()
})

test('starts a session in a non-Git folder and keeps that folder as its execution directory', async ({
  orcaPage,
  registerPostElectronShutdownCleanup
}) => {
  const folder = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'fubuking-folder-session-')))
  registerPostElectronShutdownCleanup(async () => rmSync(folder, { recursive: true, force: true }))
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await configureGoldenStubAgent(orcaPage, { agent: 'claude' })
  const proofFile = path.join(folder, 'agent-cwd.txt')
  const workspace = await orcaPage.evaluate(
    async ({ folderPath, command }) => {
      const state = window.__store!.getState()
      await state.updateSettings({ agentCmdOverrides: { claude: command } })
      const group = await window.api.projectGroups.create({
        name: 'Folder session',
        parentPath: folderPath
      })
      await state.fetchProjectGroups()
      const workspace = await state.createFolderWorkspace({
        name: 'Folder session',
        folderPath,
        projectGroupId: group.id
      })
      if (!workspace) {
        throw new Error('Folder workspace was not created')
      }
      const id = `folder:${workspace.id}`
      state.setActiveWorktree(id, 'local')
      return id
    },
    {
      folderPath: folder,
      command: `pwd > ${quoteStartupArg(proofFile, 'posix')}; golden-stub-agent`
    }
  )
  await orcaPage.getByRole('button', { name: /^New session/ }).click()
  const dialog = orcaPage.getByRole('dialog', { name: 'New session' })
  await dialog.getByRole('textbox', { name: 'Message', exact: true }).fill('Inspect this folder')
  await dialog.getByRole('button', { name: /^Start session/ }).click()
  await expect(dialog).toBeHidden()
  expect(await orcaPage.evaluate(() => window.__store!.getState().activeWorktreeId)).toBe(workspace)
  await orcaPage
    .getByRole('group', { name: 'Session view' })
    .getByRole('button', { name: 'Terminal' })
    .click()
  await waitForTerminalOutput(orcaPage, 'GOLDEN_STUB_AGENT_READY')
  expect(realpathSync(readFileSync(proofFile, 'utf8').trim())).toBe(folder)
  expect(existsSync(path.join(folder, '.git'))).toBe(false)
})
