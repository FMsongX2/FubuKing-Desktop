import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'

const roots = []
const branch = 'codex/orca-v1.4.218'
const workflow = parse(
  readFileSync(
    new URL('../../.github/workflows/fubuking-upstream-sync.yml', import.meta.url),
    'utf8'
  )
)
const publish = workflow.jobs.update.steps.find((step) => step.name === 'Open draft update PR').run

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'fubuking-sync-recovery-'))
  roots.push(root)
  const source = join(root, 'source')
  const remote = join(root, 'remote.git')
  const bin = join(root, 'bin')
  mkdirSync(source)
  mkdirSync(bin)
  execFileSync('git', ['init', '--bare', remote], { stdio: 'pipe' })
  execFileSync('git', ['init', source], { stdio: 'pipe' })
  const git = (...args) =>
    execFileSync('git', args, { cwd: source, encoding: 'utf8', stdio: 'pipe' }).trim()
  git('symbolic-ref', 'HEAD', 'refs/heads/main')
  git('config', 'user.name', 'Fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  git('remote', 'add', 'origin', remote)
  writeFileSync(join(source, 'app.txt'), 'validated source\n')
  git('add', 'app.txt')
  git('commit', '-m', 'base')
  git('checkout', '-b', branch)
  git('commit', '--allow-empty', '-m', 'validated merge')
  const record = join(root, 'pr-created')
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\nprintf created > "$PR_LOG"\n', { mode: 0o755 })
  return { root, source, remote, bin, git, record }
}

function runPublish(world) {
  return spawnSync('bash', ['-euc', publish], {
    cwd: world.source,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${world.bin}:${process.env.PATH ?? ''}`,
      GH_TOKEN: 'fixture-token',
      GITHUB_REPOSITORY: 'fixture/repo',
      RELEASE_TAG: 'v1.4.218',
      RELEASE_REVISION: world.git('rev-parse', 'main'),
      UPDATE_BRANCH: branch,
      RUNNER_TEMP: world.root,
      PR_LOG: world.record
    }
  })
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe.skipIf(process.platform === 'win32')('FubuKing sync publish recovery', () => {
  it('publishes one validated branch and creates its PR', () => {
    const world = fixture()
    const result = runPublish(world)
    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(world.record)).toBe(true)
  })

  it('reuses an identical published tree when the previous PR request failed', () => {
    const world = fixture()
    world.git('push', 'origin', branch)
    const existing = world.git('rev-parse', 'HEAD')
    world.git('checkout', 'main')
    world.git('checkout', '-B', branch)
    world.git('commit', '--allow-empty', '-m', 'new validation of the same tree')
    expect(world.git('rev-parse', 'HEAD')).not.toBe(existing)
    const result = runPublish(world)
    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(world.record)).toBe(true)
    expect(world.git('ls-remote', 'origin', `refs/heads/${branch}`)).toContain(existing)
  })

  it('keeps different existing branch contents and stops before creating a PR', () => {
    const world = fixture()
    writeFileSync(join(world.source, 'app.txt'), 'manual repair\n')
    world.git('commit', '-am', 'manual repair')
    world.git('push', 'origin', branch)
    const existing = world.git('rev-parse', 'HEAD')
    world.git('checkout', 'main')
    world.git('checkout', '-B', branch)
    const result = runPublish(world)
    expect(result.status).not.toBe(0)
    expect(existsSync(world.record)).toBe(false)
    expect(world.git('ls-remote', 'origin', `refs/heads/${branch}`)).toContain(existing)
  })
})
