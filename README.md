# OpenAllay Skills

Community workflows and reference material for
[OpenAllay](https://github.com/nkanf-dev/OpenAllay), your AI companion in Minecraft.

Use Skills to diagnose missing recipes, understand machines, follow quest
progression, search guide books, and inspect your game. Skills add focused
instructions to the Agent. OpenAllay loads their supporting references when
needed.

## Install and update in Minecraft

1. Install [the latest OpenAllay release](https://github.com/nkanf-dev/OpenAllay/releases/latest)
   for your Minecraft version and loader. Follow its installation instructions
   for the required Java runtime and loader-specific setup.
2. Open **OpenAllay Settings → Skills → Community**.
3. Select **Refresh community**, choose a compatible package, and select
   **Install Skill**. Select **Update Skill** when an update is available.
4. Use the **Installed** tab to enable a Skill and inspect its instructions.

To import your own package, enter its local ZIP or directory path in the
Community page and select **Import**. A package directory contains `SKILL.md`
at its root, with optional `references/` and `assets/` directories.

Installed packages live at `config/openallay/skills/<skill-name>/`. Built-in
and Extension-provided Skills stay in their original packages. Select
**Create local override** to edit a local copy. Deleting the override restores
its bundled instructions. Valid changes apply to future requests.

## Write a Skill

Choose one task that needs domain knowledge or several related steps. State
when the Agent should load the Skill, which evidence to use, and when to load
each reference. Use the actual game data and APIs available in the player's
instance. Keep Minecraft-version-specific command syntax in focused references.

Each package uses this layout:

```text
skills/<skill-name>/
  SKILL.md
  references/
  assets/
```

`SKILL.md` starts with YAML frontmatter containing `name` and `description`.
The name uses lowercase kebab-case and matches its directory. The description
explains when to use the Skill. Community packages also declare their quoted
package version under `metadata.openallay/version`, matching
`package-versions.json`.

Use only the Tools declared by the framework. `allowed-tools` can name
`openallay:run_javascript` and `openallay:load_skill`. Skills provide Markdown
instructions and supporting assets. Host and Extension APIs perform operations
under the player's enabled settings and Minecraft permissions.

OpenAllay's **Skill API 0.2** and **Extension API 0.4.0** are separate contracts.
Skill catalog compatibility uses the Skill API. Extension SDK versions belong
to Extension JARs. Skill package versions are independent of OpenAllay releases.

## Repository layout

- `skills/<skill-name>/SKILL.md`: Agent Skills-compatible instructions.
- Package-local `references/`: progressively loaded supporting documents.
- `packages/`: deterministic ZIP archives consumed by OpenAllay.
- `package-metadata.json`: player-facing names, descriptions, and publishers.
- `package-versions.json`: independently released Skill package versions.
- `package-compatibility.json`: each Skill's Minecraft selector and Skill API requirement.
- `catalog.json`: the community catalog used by the game.
- `schema/catalog.schema.json`: the public catalog contract.

## Contributing

1. Write a focused workflow instead of repeating the core JavaScript API.
2. Match the directory name, frontmatter `name`, and catalog package ID.
3. Add concise names and descriptions to `package-metadata.json`.
4. Set the package's supported Minecraft selector in `package-compatibility.json`.
   Publisher metadata uses an exact numeric version or one finite Maven interval,
   such as `[1.12.2,26.3]`, covered by the workflow's actual host APIs. Core checks
   the selector with its shared compatibility parser. Keep the Skill API
   requirement at `0.2`. State version-specific syntax and optional integration
   requirements in the instructions.
5. Keep executable files, credentials, and arbitrary filesystem paths out of
   the package.
6. Link each reference from `SKILL.md` and explain when to load it.
7. Check examples against real host data. Use the player's task and instance
   instead of hard-coded benchmark answers.
8. After changing package content, update its quoted `openallay/version` and
   its entry in `package-versions.json`, then regenerate and check packages:

```bash
node scripts/build-catalog.mjs
node scripts/build-catalog.mjs --check
```

The quality workflow checks package structure, deterministic archives,
checksums, catalog ordering, and the published JSON schema. README-only changes
leave package versions and archives unchanged.

## License

OpenAllay Skills are distributed under the [MIT License](LICENSE).
