#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const skillRoot = join(repository, "skills");
const packageRoot = join(repository, "packages");
const versions = strictObject(
  JSON.parse(readFileSync(join(repository, "package-versions.json"), "utf8")),
  "package-versions.json",
);
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const executableExtensions = new Set([
  "sh", "bash", "zsh", "fish", "command", "bat", "cmd", "ps1", "exe", "dll",
  "dylib", "so", "class", "jar", "py", "pyc", "js", "mjs", "cjs",
]);
const allowedTools = new Set([
  "openallay:run_javascript",
  "openallay:load_skill",
]);
const generatedAt = catalogTimestamp();
const temporary = mkdtempSync(join(tmpdir(), "openallay-skills-"));

try {
  const generatedPackages = join(temporary, "packages");
  mkdirSync(generatedPackages);
  const ids = readdirSync(skillRoot)
    .filter((name) => statSync(join(skillRoot, name)).isDirectory())
    .sort();
  const entries = [];

  if (Object.keys(versions).sort().join("\0") !== ids.join("\0")) {
    fail("package-versions.json must contain exactly one version for every Skill");
  }

  for (const id of ids) {
    validateId(id, "Skill directory");
    validateSkill(id);
    const version = versions[id];
    if (typeof version !== "string" || version.trim() === "") {
      fail(`Invalid version for ${id}`);
    }

    const staging = join(temporary, "staging", id);
    mkdirSync(staging, { recursive: true });
    cpSync(join(skillRoot, id), staging, { recursive: true });
    normalizeTimes(staging);

    const archiveName = `${id}-${version}.zip`;
    const archive = join(generatedPackages, archiveName);
    const files = walkFiles(staging).map((path) => relative(staging, path)).sort();
    const zipped = spawnSync("zip", ["-X", "-q", archive, ...files], {
      cwd: staging,
      encoding: "utf8",
    });
    if (zipped.status !== 0) {
      fail(`Unable to build ${archiveName}: ${zipped.stderr || zipped.stdout}`);
    }
    const sha256 = createHash("sha256").update(readFileSync(archive)).digest("hex");
    entries.push({
      id,
      version,
      archive:
        `https://raw.githubusercontent.com/nkanf-dev/OpenAllay-Skills/main/packages/${archiveName}`,
      sha256,
      compatibility: {
        minecraft: "26.2",
        openallayApi: "0.2",
      },
      source:
        `https://github.com/nkanf-dev/OpenAllay-Skills/tree/main/skills/${id}`,
    });
  }

  const catalog = `${JSON.stringify({
    schemaVersion: 1,
    kind: "skill",
    generatedAt,
    packages: entries,
  }, null, 2)}\n`;

  if (check) {
    compareText(join(repository, "catalog.json"), catalog);
    compareDirectory(packageRoot, generatedPackages);
  } else {
    rmSync(packageRoot, { recursive: true, force: true });
    mkdirSync(packageRoot, { recursive: true });
    for (const name of readdirSync(generatedPackages).sort()) {
      cpSync(join(generatedPackages, name), join(packageRoot, name));
    }
    writeFileSync(join(repository, "catalog.json"), catalog);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

function validateSkill(id) {
  const root = join(skillRoot, id);
  const entry = join(root, "SKILL.md");
  if (!existsSync(entry)) {
    fail(`${id} is missing SKILL.md`);
  }
  const markdown = readFileSync(entry, "utf8").replaceAll("\r\n", "\n");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]+)$/.exec(markdown);
  if (!match) {
    fail(`${id}/SKILL.md has invalid frontmatter`);
  }
  const scalars = new Map();
  for (const line of match[1].split("\n")) {
    if (line.trim() === "" || /^\s/.test(line)) {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator <= 0) {
      fail(`${id}/SKILL.md has invalid frontmatter line: ${line}`);
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2
      && ((value.startsWith("\"") && value.endsWith("\""))
        || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    scalars.set(key, value);
  }
  if (scalars.get("name") !== id) {
    fail(`${id}/SKILL.md name must match its directory`);
  }
  if (!scalars.get("description")) {
    fail(`${id}/SKILL.md requires a description`);
  }
  for (const tool of (scalars.get("allowed-tools") ?? "").split(/[\s,]+/)) {
    if (tool && !allowedTools.has(tool)) {
      fail(`${id}/SKILL.md declares unsupported tool ${tool}`);
    }
  }

  for (const path of walkFiles(root)) {
    const local = relative(root, path).replaceAll("\\", "/");
    if (
      local !== "SKILL.md"
      && !local.startsWith("references/")
      && !local.startsWith("assets/")
    ) {
      fail(`${id} contains unsupported file ${local}`);
    }
    const extension = local.includes(".") ? local.slice(local.lastIndexOf(".") + 1) : "";
    if (executableExtensions.has(extension.toLowerCase())) {
      fail(`${id} contains executable file ${local}`);
    }
    if (local.startsWith("references/") && !match[2].includes(local)) {
      fail(`${id}/SKILL.md must explain when to load ${local}`);
    }
  }
}

function validateId(value, label) {
  if (!idPattern.test(value)) {
    fail(`${label} is invalid: ${value}`);
  }
}

function walkFiles(root) {
  const files = [];
  for (const name of readdirSync(root).sort()) {
    const path = join(root, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walkFiles(path));
    } else if (stat.isFile()) {
      files.push(path);
    } else {
      fail(`Unsupported filesystem entry ${path}`);
    }
  }
  return files;
}

function normalizeTimes(root) {
  const epoch = new Date("1980-01-01T00:00:00.000Z");
  for (const path of walkFiles(root)) {
    utimesSync(path, epoch, epoch);
  }
  const directories = [root];
  for (const path of readdirSync(root).map((name) => join(root, name))) {
    if (statSync(path).isDirectory()) {
      directories.push(...walkDirectories(path));
    }
  }
  for (const path of directories.reverse()) {
    utimesSync(path, epoch, epoch);
  }
}

function walkDirectories(root) {
  const directories = [root];
  for (const name of readdirSync(root).sort()) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) {
      directories.push(...walkDirectories(path));
    }
  }
  return directories;
}

function catalogTimestamp() {
  const result = spawnSync(
    "git",
    ["log", "-1", "--format=%cI", "--", "skills", "package-versions.json"],
    { cwd: repository, encoding: "utf8" },
  );
  const value = result.status === 0 ? result.stdout.trim() : "";
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.valueOf())) {
    return "2026-07-25T00:00:00.000Z";
  }
  return parsed.toISOString();
}

function compareText(path, expected) {
  if (!existsSync(path) || readFileSync(path, "utf8") !== expected) {
    fail(`${relative(repository, path)} is stale; run node scripts/build-catalog.mjs`);
  }
}

function compareDirectory(actual, expected) {
  const actualNames = existsSync(actual) ? readdirSync(actual).sort() : [];
  const expectedNames = readdirSync(expected).sort();
  if (actualNames.join("\0") !== expectedNames.join("\0")) {
    fail("packages/ is stale; run node scripts/build-catalog.mjs");
  }
  for (const name of expectedNames) {
    const left = readFileSync(join(actual, name));
    const right = readFileSync(join(expected, name));
    if (!left.equals(right)) {
      fail(`packages/${name} is stale; run node scripts/build-catalog.mjs`);
    }
  }
}

function strictObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be a JSON object`);
  }
  return value;
}

function fail(message) {
  throw new Error(message);
}
