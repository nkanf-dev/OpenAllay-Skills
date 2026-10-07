import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateCompatibility } from "./package-compatibility.mjs";

function entry(minecraft, openallayApi = "0.2") {
  return { minecraft, openallayApi };
}

test("accepts exact numeric selectors and finite Maven intervals", () => {
  for (const range of ["26.2", "1.12.2", "[1.12.2,26.3]", "(1.20.4,26.3]",
    "[1.16.5,26.2)", "(1.16.5,26.3)", "[26.3,26.3]", "[26.2,26.10]"]) {
    assert.deepEqual(validateCompatibility(entry(range), "test"), entry(range));
  }
});

test("rejects blank, wildcard, malformed, unbounded, reversed and empty selectors", () => {
  for (const range of [null, 26.2, "", " ", "*", "[]", "[1.12.2,26.3", "1.12.2,26.3",
    "[1.12.2,)", "(,26.3]", "[26.3,1.12.2]", "(26.3,26.3]", "[26.3,26.3)",
    "[26.3,26.3.0)", "[1.12.2,26.3] ", "26.2 || 26.3", "[1.12.2,1.16.5],[26.2,26.3]"]) {
    assert.throws(() => validateCompatibility(entry(range), "test"));
  }
});

test("keeps Skill API independent from Extension SDK and validates exact fields", () => {
  for (const invalid of [entry("26.2", "0.4"), entry("26.2", "[0.2,0.4]"), null, [],
    { minecraft: "26.2" }, { ...entry("26.2"), extra: "wrong" }]) {
    assert.throws(() => validateCompatibility(invalid, "test"));
  }
});

test("each Skill has explicit compatibility and its own unchanged or bumped version", () => {
  const compatibility = JSON.parse(readFileSync(new URL("../package-compatibility.json", import.meta.url)));
  const versions = JSON.parse(readFileSync(new URL("../package-versions.json", import.meta.url)));
  assert.deepEqual(Object.keys(compatibility).sort(), Object.keys(versions).sort());
  for (const [id, value] of Object.entries(compatibility)) {
    validateCompatibility(value, id);
    assert.equal(value.minecraft, "[1.12.2,26.3]");
  }
  assert.equal(versions["run-game-commands"], "0.2.2");
  assert.equal(versions["inspect-game-state"], "0.2.2");
  for (const id of ["diagnose-missing-recipe", "explain-machine-usage", "guide-ftb-progression", "search-guide-books"]) {
    assert.equal(versions[id], "0.2.1");
  }
});

test("published schema accepts the same current selector and API", () => {
  const schema = JSON.parse(readFileSync(new URL("../schema/catalog.schema.json", import.meta.url)));
  const fields = schema.$defs.package.properties.compatibility.properties;
  const matcher = new RegExp(fields.minecraft.pattern);
  assert.equal(matcher.test("[1.12.2,26.3]"), true);
  assert.equal(matcher.test("26.2"), true);
  assert.equal(matcher.test("*"), false);
  assert.equal(fields.openallayApi.const, "0.2");
  assert.equal(schema.properties.schemaVersion.const, 2);
});

test("command reference distinguishes native catalogs, host item grammar, and route availability", () => {
  const skill = readFileSync(new URL("../skills/run-game-commands/SKILL.md", import.meta.url), "utf8");
  const reference = readFileSync(new URL("../skills/run-game-commands/references/commands.md", import.meta.url), "utf8");
  assert.ok(skill.includes("captured native player command route"));
  assert.ok(skill.includes("strips surrounding"));
  assert.ok(skill.includes("exact supplied server command can be submitted"));
  assert.ok(!skill.includes("complete Brigadier tree"));
  assert.ok(reference.includes("native_client_command_partial"));
  assert.ok(reference.includes("1.20.5 and newer"));
  assert.ok(reference.includes("1.13 through 1.20.4 use item NBT"));
  assert.ok(reference.includes("command_path_unavailable"));
  assert.ok(!reference.includes("Do not use the removed legacy"));
});
