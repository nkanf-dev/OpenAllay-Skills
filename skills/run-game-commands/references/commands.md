# Host command bridge

Use `roots: ["commands"]` in the `run_javascript` Tool input for command calls
below. Call the binding as `commands`; do not write `mc.commands`.
The binding requires both request command authority and a captured native
player command route.

## Match syntax to the current Minecraft version

Read `mc.game.runtime` with `roots: ["mc"]` when the exact host version is needed.
Use that version and the host's actual command descriptions and feedback.

- Minecraft 1.12.2 uses the pre-Brigadier command parser. Its captured catalog
  contains only permitted client-local top-level names and aliases. Nodes have
  `kind: "native_client_command_partial"`, top-level `usage`, and an alias
  `redirect` when present. It has no captured server argument tree.
- Brigadier hosts such as Minecraft 1.16.5 and newer expose the active client
  command tree, including argument paths transmitted by the server.
- Item components use the `/give` item argument's `[...]` form on Minecraft
  1.20.5 and newer. Component IDs and value grammar must match the exact host.
- Minecraft 1.13 through 1.20.4 use item NBT in the item argument rather than
  item components. Minecraft 1.12.2 uses its older `/give` positional syntax
  with separate count, data, and optional NBT arguments. Keep the syntax that
  belongs to the current host.

For ordinary items, use an unmodified item ID and the host's count syntax.
Resolve the recipient and item from the player's request. Do not add a sample
custom name, component, or NBT payload to a command that did not request one.
For customized items, obtain exact host syntax before composing the payload;
Brigadier path descriptions alone do not specify every nested value grammar.

If Minecraft returns unknown-item, malformed-NBT, unknown-component,
malformed-component, or command-context feedback, inspect that exact message
and available host syntax evidence. Change only the rejected part and retry
at most once. Permission feedback is terminal.

If the command contains JSON, NBT, component text, or both quote styles, use a
JavaScript template literal rather than manually escaping nested quote layers.
Preserve the player-supplied command text; escape backticks and `${` sequences
if they occur in a template literal.

## Discover focused command candidates

```javascript
var catalog = commands.list();
return catalog.nodes
  .filter(function (node) {
    return node.path.indexOf("examplemod") === 0;
  })
  .map(function (node) {
    return {
      path: node.path,
      kind: node.kind,
      argumentType: node.argumentType,
      executable: node.executable,
      redirect: node.redirect,
      usage: node.usage
    };
  });
```

On Brigadier hosts, `path` uses literal names and angle-bracket argument names,
for example `give <targets> <item>`. `children` contains the next path segments.
`redirect` contains the target path when the node redirects.
On Minecraft 1.12.2, `path` is a top-level client-local name or alias, and
`children` is empty. Server commands can still execute through the player's
connection when their exact syntax is supplied.

## Inspect one captured path

```javascript
return commands.describe("time set <time>");
```

This example requires that exact Brigadier path in `commands.list()`.
Use the exact `path` returned by the host catalog. `describe` does not parse a
concrete command line or guess aliases; an absent path raises
`command_path_unavailable`. On Minecraft 1.12.2, describe only a returned
top-level client-local name or alias.

Do not call `commands.list()` for an exact command the player supplied or for
known unambiguous vanilla syntax. Never return its complete `nodes` array to
the model; filter to the relevant literal or mod prefix in JavaScript.

## Run in order and read the feedback

Run only the commands the player requested. This example applies when the
player requested both changes:

```javascript
var first = commands.run("time set day");
var second = commands.run("/weather clear");
return {
  time: {
    state: first.state,
    messages: first.messages
  },
  weather: {
    state: second.state,
    messages: second.messages
  }
};
```

Each result has:

- `sequence`: request-local execution order, beginning at 1;
- `actorId`: the player whose connection executed it;
- `command`: text after stripping surrounding whitespace and one optional
  leading slash;
- `state`: `feedback` or `no_feedback`;
- `messages`: the ordered client-visible Minecraft feedback lines;
- `feedbackObserved`: whether at least one feedback line was captured;
- `durationMillis`: elapsed submission and feedback time.

`commands.run` is synchronous from JavaScript's point of view, but command
submission and feedback happen asynchronously with respect to the Minecraft
render thread. OpenAllay waits on its worker thread, so the script can use the
returned result immediately without promises or polling.

`commands.run` adds no OpenAllay allowlist, argument filter, or call-count cap.
Minecraft's native command parser, connection state, and player permission are
final. `messages` contains observable feedback; a feedback line may report a
parser or permission rejection. If a later command depends on the first one's
outcome, inspect that feedback before submitting it. Already submitted commands
are never rolled back.
