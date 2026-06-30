const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function runHook({ cwd, payload }) {
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'guardrail-hooks.js')], {
    cwd,
    input: JSON.stringify(payload),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  return JSON.parse(result.stdout);
}

function writePolicy(cwd, content) {
  const policyDir = path.join(cwd, '.ai', 'policies');
  fs.mkdirSync(policyDir, { recursive: true });
  fs.writeFileSync(path.join(policyDir, 'guardrails.json'), JSON.stringify(content));
}

test('denies paths that escape the workspace via parent traversal', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'guardrails-workspace-'));
  writePolicy(cwd, {
    version: 1,
    rules: [
      {
        id: 'outside-workspace',
        effect: 'deny',
        tools: ['edit'],
        outsideWorkspace: true,
        paths: ['/tmp/should-not-matter']
      }
    ]
  });

  const decision = runHook({
    cwd,
    payload: {
      toolName: 'edit',
      toolArgs: { filePath: path.join(cwd, '..', 'escape.txt') },
      workspaceRoot: cwd
    }
  });

  assert.equal(decision.permissionDecision, 'deny');
});

test('denies symlink targets that resolve outside the workspace', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'guardrails-workspace-'));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardrails-outside-'));
  const linkPath = path.join(cwd, 'linked');
  fs.symlinkSync(outsideDir, linkPath, 'dir');

  writePolicy(cwd, {
    version: 1,
    rules: [
      {
        id: 'symlink-escape',
        effect: 'deny',
        tools: ['edit'],
        outsideWorkspace: true,
        paths: ['/tmp/should-not-matter']
      }
    ]
  });

  const decision = runHook({
    cwd,
    payload: {
      toolName: 'edit',
      toolArgs: { filePath: path.join(linkPath, 'secret.txt') },
      workspaceRoot: cwd
    }
  });

  assert.equal(decision.permissionDecision, 'deny');
});

test('normalizes tool names so policy rules can target stable actions', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'guardrails-workspace-'));
  writePolicy(cwd, {
    version: 1,
    rules: [
      {
        id: 'normalized-tool',
        effect: 'deny',
        tools: ['edit'],
        paths: [path.join(cwd, 'file.txt')]
      }
    ]
  });

  const decision = runHook({
    cwd,
    payload: {
      toolName: 'copilot.editFile',
      toolArgs: { filePath: path.join(cwd, 'file.txt') },
      workspaceRoot: cwd
    }
  });

  assert.equal(decision.permissionDecision, 'deny');
});
