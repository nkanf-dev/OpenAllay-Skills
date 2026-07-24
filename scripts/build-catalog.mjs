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
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return crc >>> 0;
});
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

    const archiveName = `${id}-${version}.zip`;
    const archive = join(generatedPackages, archiveName);
    writeFileSync(archive, deterministicZip(join(skillRoot, id)));
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

function deterministicZip(root) {
  const files = walkFiles(root).map((path) => ({
    name: relative(root, path).replaceAll("\\", "/"),
    data: readFileSync(path),
  }));
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, file.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + file.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
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
