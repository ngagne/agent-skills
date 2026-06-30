# Copilot Guardrails

This folder provides a lightweight policy framework for blocking risky agent actions before they reach the local shell or filesystem.

## What is included

- [guardrail-hooks.js](guardrail-hooks.js) – a Node.js hook that inspects tool calls and returns an allow/deny decision.
- [policies/guardrails.json](policies/guardrails.json) – a sample policy with workspace-safety defaults.
- [schemas/guardrails.schema.json](schemas/guardrails.schema.json) – a JSON Schema for validating policy files.
- [tests/guardrail-hooks.test.js](tests/guardrail-hooks.test.js) – regression tests for traversal, symlink escape, and tool normalization cases.

## How it works

The hook reads a policy file from the workspace at .ai/policies/guardrails.json.

If the file is missing, the hook defaults to allowing the action. If a policy exists, it evaluates each rule against the incoming tool request.

The current implementation now:

- resolves the workspace root from the hook payload first and falls back to the current working directory
- canonicalizes workspace and target paths with fs.realpathSync.native() when possible
- blocks file operations that escape the workspace through parent traversal or symlink resolution when a rule sets outsideWorkspace to true
- normalizes tool names to stable actions such as edit, create, delete, and command so policy rules remain resilient as Copilot tool payloads evolve
- supports command-pattern matching for shell actions and path-pattern matching for file actions

## Default policy behavior

The sample policy currently blocks:

- file edits, creates, and deletes outside the current workspace
- writes to sensitive home-directory files such as .zshrc, .bashrc, .ssh, and .aws
- edits under system locations like /etc, /usr, and /System
- shell commands that start with sudo
- shell commands that use rm -rf

## Usage

1. Copy or symlink the sample policy into your workspace:

   ```text
   .ai/policies/guardrails.json
   ```

2. Ensure the hook is wired into your agent or tool execution environment so it receives tool requests.
3. Adjust the rules in the policy file to match your own safety requirements.
4. Validate the policy JSON against the schema when editing it.
5. Run the regression tests locally with:

   ```bash
   node --test tests/guardrail-hooks.test.js
   ```

## Example policy shape

```json
{
  "version": 1,
  "rules": [
    {
      "id": "workspace-only",
      "description": "Prevent the agent from modifying files outside the current workspace.",
      "effect": "deny",
      "tools": ["edit", "create", "delete"],
      "outsideWorkspace": true
    },
    {
      "id": "deny-home-dotfiles",
      "description": "Prevent modification of shell and credential files",
      "effect": "deny",
      "tools": ["edit", "create"],
      "paths": ["~/.ssh/**", "~/.aws/**"]
    }
  ]
}
```

## Notes

- Deny decisions are emitted as JSON with permissionDecision and permissionDecisionReason.
- The schema supports allow, deny, and approval effects, although the current hook primarily enforces deny behavior.
- This folder is intended as a practical starting point for adding guardrails to agent-driven workflows.
