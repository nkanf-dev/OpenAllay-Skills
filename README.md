# OpenAllay Skills

This is the public catalog for community-distributed
[OpenAllay](https://github.com/nkanf-dev/OpenAllay) Skills.

Skills are focused instructions for a particular Minecraft task: diagnosing a
missing recipe, explaining a machine, following quest progression, searching a
guide book, or using an explicitly enabled experimental capability. OpenAllay's
core JavaScript object model is intentionally not duplicated here.

## Install in Minecraft

Open **OpenAllay Settings → Skills → Community**, refresh the catalog, select a
compatible Skill, and install it. You can also import a Skill directory or ZIP
from the same page.

Installed Skills remain ordinary Markdown packages under OpenAllay's
configuration directory. They can be inspected and locally overridden without
changing this repository.

## Repository layout

- `skills/<skill-name>/SKILL.md` contains Agent Skills-compatible instructions.
- `references/` contains progressively loaded supporting documents.
- `packages/` contains deterministic ZIP archives consumed by OpenAllay.
- `catalog.json` is the strict schema-1 catalog used by the game.
- `schema/catalog.schema.json` documents the catalog contract.

## Contributing

Each Skill must:

1. solve a genuinely vertical task rather than restating OpenAllay's core
   JavaScript API;
2. use a lowercase kebab-case directory matching its `name`;
3. declare its package version as the quoted string metadata key
   `openallay/version`, matching `package-versions.json`;
4. declare only tools that OpenAllay exposes;
5. keep executable scripts, network access, arbitrary paths, and permissions
   out of the package;
6. put optional deep material in `references/` and tell the Agent when to load
   it;
7. avoid benchmark-specific answers or examples that hard-code one test result.

After editing a Skill, bump its version in `package-versions.json` and run:

```bash
node scripts/build-catalog.mjs
node scripts/build-catalog.mjs --check
```

The quality workflow verifies package structure, deterministic archives,
checksums, catalog ordering, and the published JSON schema.

## License

OpenAllay Skills are distributed under the [MIT License](LICENSE).
