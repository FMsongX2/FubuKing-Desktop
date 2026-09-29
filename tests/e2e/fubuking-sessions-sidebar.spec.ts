// The fork's own startup UI: the sessions sidebar, New session, and Chat | Terminal tabs.

import { randomUUID } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from './helpers/orca-app'
import { configureGoldenStubAgent, getGoldenStubAgentLaunchEnv } from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { waitForActivePaneHookDescriptor } from './helpers/terminal'

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

  await expect(orcaPage.getByText(SESSION_PROMPT, { exact: true })).toBeVisible()
  await expect(orcaPage.getByText(LAST_USER_TURN, { exact: true })).toBeVisible({
    timeout: 30_000
  })

  await terminal.click()
  await expect(terminal).toHaveAttribute('aria-pressed', 'true')
  await expect(chatRoot).toBeHidden()
  await chat.click()
  await expect(chatRoot).toBeVisible()

  await orcaPage.getByRole('button', { name: 'Show workspaces', exact: true }).click()
  await expect(orcaPage.locator('[data-worktree-sidebar]')).toBeVisible()
})
