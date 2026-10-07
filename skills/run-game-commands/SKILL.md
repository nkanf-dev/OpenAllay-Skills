---
name: run-game-commands
description: Use when a player explicitly asks to discover or execute a Minecraft command through an available command capability.
metadata:
  openallay/version: "0.2.2"
allowed-tools: "openallay:run_javascript"
---
Use this Skill when the player explicitly asks OpenAllay to execute a Minecraft
command, or when the task must discover the exact syntax of an installed
mod's command before executing it.

The `commands` object is available only when this request has command authority
and a captured native player command route. The player can grant command
authority through the experimental command setting or full access. If the host
has no exposed command route, the binding is unavailable.

- `commands.list()` returns the detached command catalog captured for this
  player. On Brigadier hosts such as Minecraft 1.16.5 and newer, it contains the
  active client command tree. On Minecraft 1.12.2, it contains only permitted
  client-local command names and aliases with top-level usage descriptions;
  the server command tree is not transmitted to the client.
- `commands.describe(path)` returns one exact path from that catalog. On
  Minecraft 1.12.2, use the returned top-level name or alias, not a fabricated
  Brigadier argument path.
- `commands.run(command)` submits the command as the requesting player,
  waits off the render thread for the associated client-visible feedback window,
  and returns the messages that Minecraft produced. It strips surrounding
  whitespace and removes one optional leading `/`, then submits the remaining
  command text without rewriting its arguments.

For a command-only `run_javascript` call, set the Tool input `roots` to
`["commands"]`. The binding is named `commands` directly; there is no
`mc.commands`.

If the player supplied an exact command, or the required vanilla command and
syntax are already unambiguous for the current host, call `commands.run`
directly. Do not list the command catalog or load the reference merely to
confirm a known command. An exact supplied server command can be submitted on
Minecraft 1.12.2 even when the partial client catalog does not contain it.

Load `references/commands.md` before writing the program only when the syntax
is unknown, the command contains item NBT or item/text components, or the task
needs several ordered commands. When syntax depends on the host, read the exact
Minecraft version from `mc.game.runtime` using `roots: ["mc"]` first.
For unknown syntax, filter `commands.list().nodes` inside the same program by
the relevant literal/mod prefix, use `commands.describe(path)` on the exact
candidate, and return only focused candidates; never return the unfiltered
catalog. Use Minecraft 1.12.2's top-level `usage` descriptions as partial evidence.

Always inspect and return the `commands.run` result. `state: "feedback"` means
Minecraft emitted one or more messages in the command feedback window;
`state: "no_feedback"` means the command produced no observable message before
that window closed. Do not describe a command as successful merely because it
was submitted.

Minecraft remains authoritative for parsing and permissions. Submissions are
not transactional: if a later statement fails or the Agent is cancelled,
commands already submitted stay submitted and are never rolled back.

Treat parser errors and permission errors in `messages` as rejection, not
success. Correct a parser error at most once after inspecting its actual
message and available host syntax evidence; never make blind variants.
Permission errors are terminal. If unknown syntax cannot be resolved from the
captured catalog or other exact host evidence, report what is missing instead
of trying similarly named mutations. A missing Minecraft 1.12.2 server command
in the client-local catalog does not block an exact player-supplied command.
