// Publisher validation only. Runtime matching uses Core ExtensionCompatibility.
const versionPattern = /^[0-9]+(?:\.[0-9]+)*$/;
const intervalPattern = /^([[(])([0-9]+(?:\.[0-9]+)*),([0-9]+(?:\.[0-9]+)*)([\])])$/;

export function validateCompatibility(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).sort().join("\0") !== "minecraft\0openallayApi") {
    throw new Error(`${label} must contain exactly minecraft and openallayApi`);
  }
  if (value.openallayApi !== "0.2") {
    throw new Error(`${label}.openallayApi must be the Skill API 0.2`);
  }
  const range = value.minecraft;
  if (typeof range !== "string" || range.trim() !== range) {
    throw new Error(`${label}.minecraft must be a canonical version selector`);
  }
  if (!versionPattern.test(range)) {
    const match = intervalPattern.exec(range);
    if (!match) {
      throw new Error(`${label}.minecraft requires an exact numeric version or finite Maven interval`);
    }
    const order = compareNumericVersions(match[2], match[3]);
    if (order > 0 || (order === 0 && (match[1] !== "[" || match[4] !== "]"))) {
      throw new Error(`${label}.minecraft interval is reversed or empty`);
    }
  }
  return { minecraft: range, openallayApi: value.openallayApi };
}

function compareNumericVersions(left, right) {
  const a = left.split(".").map(BigInt);
  const b = right.split(".").map(BigInt);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0n) - (b[index] ?? 0n);
    if (difference !== 0n) return difference > 0n ? 1 : -1;
  }
  return 0;
}
