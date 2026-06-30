#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

function allow() {
  process.stdout.write(
    JSON.stringify({
      permissionDecision: "allow"
    })
  );

  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      permissionDecision: "deny",
      permissionDecisionReason: reason
    })
  );

  process.exit(0);
}

function expandPath(inputPath) {
  if (typeof inputPath !== "string") {
    return inputPath;
  }

  return inputPath.replace(/^~/, os.homedir());
}

function canonicalize(inputPath) {
  const expanded = expandPath(inputPath);
  const resolved = path.resolve(expanded);

  try {
    return fs.realpathSync.native(resolved);
  } catch {
    let current = resolved;

    while (
      !fs.existsSync(current) &&
      path.dirname(current) !== current
    ) {
      current = path.dirname(current);
    }

    if (fs.existsSync(current)) {
      const parentRealPath =
        fs.realpathSync.native(current);
      const relative = path.relative(
        current,
        resolved
      );

      return path.resolve(parentRealPath, relative);
    }

    return resolved;
  }
}

function isDescendant(parentPath, childPath) {
  const relative = path.relative(
    parentPath,
    childPath
  );

  return (
    relative === "" ||
    (!relative.startsWith("..") &&
      !path.isAbsolute(relative))
  );
}

function normalizeToolAction(toolName) {
  if (typeof toolName !== "string") {
    return undefined;
  }

  const normalized = toolName.trim().toLowerCase();

  const aliases = {
    bash: "command",
    shell: "command",
    command: "command",
    create: "create",
    edit: "edit",
    delete: "delete",
    "copilot.editfile": "edit",
    "copilot.createfile": "create",
    "copilot.deletefile": "delete",
    "copilot.runcommand": "command",
    "copilot.bash": "command"
  };

  if (aliases[normalized]) {
    return aliases[normalized];
  }

  if (normalized.includes("edit")) {
    return "edit";
  }

  if (normalized.includes("create")) {
    return "create";
  }

  if (normalized.includes("delete")) {
    return "delete";
  }

  if (
    normalized.includes("command") ||
    normalized.includes("shell") ||
    normalized.includes("bash")
  ) {
    return "command";
  }

  return normalized;
}

function normalizePath(inputPath) {
  const expanded = expandPath(inputPath);

  return path.resolve(expanded);
}

/**
 * Supports:
 *
 * /foo/bar
 * /foo/*
 * /foo/**
 */
function matchesPath(target, pattern) {

  const normalizedTarget =
    normalizePath(target);

  const normalizedPattern =
    normalizePath(pattern);

  // exact match

  if (
    normalizedPattern ===
    normalizedTarget
  ) {
    return true;
  }

  // recursive

  if (
    normalizedPattern.endsWith("/**")
  ) {

    const root =
      normalizedPattern.slice(0, -3);

    return (
      normalizedTarget === root ||
      normalizedTarget.startsWith(
        root + path.sep
      )
    );
  }

  // single-level wildcard

  if (
    normalizedPattern.endsWith("/*")
  ) {

    const root =
      normalizedPattern.slice(0, -2);

    const relative =
      path.relative(
        root,
        normalizedTarget
      );

    return (
      relative &&
      !relative.startsWith("..") &&
      !relative.includes(path.sep)
    );
  }

  return false;
}

const stdin =
  fs.readFileSync(
    process.stdin.fd,
    "utf8"
  );

const payload =
  JSON.parse(stdin);

const toolName =
  payload.toolName ??
  payload.tool_name;

const normalizedToolAction =
  normalizeToolAction(toolName);

const toolArgs =
  payload.toolArgs ??
  payload.tool_input ??
  {};

const policyPath =
  path.resolve(
    ".ai/policies/guardrails.json"
  );

if (!fs.existsSync(policyPath)) {
  allow();
}

const policy =
  JSON.parse(
    fs.readFileSync(
      policyPath,
      "utf8"
    )
  );

const workspaceRoot =
  payload.workspaceRoot ??
  process.cwd();

const canonicalWorkspace =
  canonicalize(workspaceRoot);

for (const rule of policy.rules ?? []) {

  if (rule.outsideWorkspace === true) {
    const filePath =
      toolArgs.filePath ??
      toolArgs.path ??
      "";

    const canonicalTarget =
      canonicalize(filePath);

    if (
      !isDescendant(
        canonicalWorkspace,
        canonicalTarget
      )
    ) {
      deny(
        `Blocked by policy '${rule.id}'`
      );
    }
  }

  //
  // shell command checks
  //

  if (
    rule.tool === "bash" &&
    normalizedToolAction === "command"
  ) {

    const command =
      toolArgs.command ??
      toolArgs.input ??
      "";

    for (
      const pattern of
      rule.commandPatterns ?? []
    ) {

      const regex =
        new RegExp(
          pattern,
          "i"
        );

      if (
        regex.test(command)
      ) {

        deny(
          `Blocked by policy '${rule.id}'`
        );

      }
    }
  }

  //
  // file path checks
  //

  if (
    rule.tools?.includes(
      normalizedToolAction
    )
  ) {

    const filePath =
      toolArgs.filePath ??
      toolArgs.path ??
      "";

    for (
      const pattern of
      rule.paths ?? []
    ) {

      if (
        matchesPath(
          filePath,
          pattern
        )
      ) {

        deny(
          `Blocked by policy '${rule.id}'`
        );

      }
    }
  }
}

allow();
