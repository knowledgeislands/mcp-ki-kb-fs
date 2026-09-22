# Working on the code

Getting a clone to a state where you can run the server, change it, and know the change is sound. Every command here is one the repository actually declares — check `package.json` if you need the authoritative list.

## Toolchain

`mise.toml` pins the toolchain: Node at `lts` and Bun at `1.4.1`, with Bun also pinned through `packageManager` in `package.json`. If you use [mise](https://mise.jdx.dev), `mise install` gets you both; otherwise you need Bun 1.3 or later for the development loop and Node 22 or later to run the compiled output.

Bun drives the loop; Node runs `dist/`. That split is deliberate — the published artefact must work for anyone whose MCP client launches it with plain `node`.

```bash
git clone https://github.com/knowledgeislands/mcp-ki-kb-fs.git
cd mcp-ki-kb-fs
bun install
```

`bun install` runs `prepare`, which installs the husky hooks. Skipping it means your commits bypass formatting and commit-message checks that CI will not.

## Running it

```bash
bun run ki:server:mcp:dev      # watch mode, straight from TypeScript source
bun run ki:server:mcp:inspect  # MCP Inspector against the source
bun run ki:server:mcp:start    # build, then run the compiled dist/ with node
bun run build                  # tsc -p tsconfig.build.json
```

The first two set `NODE_ENV=development`, which is what makes Bun load `.env.development` — copy `.env.example` and put your knowledge-base declaration there. A client-launched server never sees a `.env` file, so anything you rely on locally has to be reproduced in the client's `env` block. [Installing the server](../user/installing-the-server.md) covers that side.

The Inspector is the fastest way to see what a schema change actually publishes, since the schemas on the wire are generated from the zod objects rather than transcribed anywhere.

## Tests

```bash
bun run test           # vitest run
bun run test:watch     # vitest in watch mode
bun run test:coverage  # vitest run --coverage
```

Use `bun run test`, not `bun test` — the latter invokes Bun's own runner rather than Vitest and will not do what you want.

Tests are co-located: `index.test.ts` beside `index.ts`. They build a `Config` literal, or call `loadConfig` with an explicit environment object, and pass it in; nothing mutates `process.env`. Filesystem tests point a base's `rootPath` at a per-process temporary directory and clean up around each case. `fileParallelism` is off, so files run in sequence.

Beyond the per-module suites, three tests carry the invariants rather than the units, and they are the ones to extend when you change containment:

- `src/main/files/cross-base.test.ts` — two bases side by side on disk; asserts neither can reach the other.
- `src/main/files/repository-contract.test.ts` — declares _this repository_ as a knowledge base and asserts the allow-list opens exactly its three context files, that `package.json` stays refused, and that the root is not listable.
- `scripts/smoke.ts`, via `bun run ki:test:smoke` — builds `dist/`, boots it over real stdio with two declared bases, and asserts the wire surface, the negotiated `2026-07-28` revision, and the retained legacy handshake. It is the only place the protocol profile itself is proven, because the SDK owns that machinery and there is no local literal to assert against.

### The coverage contract

`vitest.config.ts` sets all four V8 thresholds to 100, so anything included must be fully covered. Three groups are excluded, each for a stated reason: the generated client, the pure wiring in `src/mcp-server/index.ts` and `src/tools/**/index.ts` — every line of which is a `registerTool` call, and which the smoke test covers at the wire instead — and the pure-data annotation presets.

The practical consequence is that a new branch in `src/main/` or `src/utils/` needs its test in the same change. Reports land in `reports/coverage`.

## Gates

There is no aggregate lint script. Formatting and linting run through the pre-commit hook, and you can invoke the same tools directly:

```bash
bunx @biomejs/biome check --write   # TypeScript, JavaScript, JSON
bunx rumdl check --fix              # Markdown
bunx syncpack format --check        # package.json field order and shape
bunx knip                           # unused files, exports, dependencies
```

The division is strict and worth respecting: rumdl owns Markdown entirely, Biome owns TypeScript, JavaScript, and JSON, and the two file domains do not overlap. Do not add a second Markdown formatter.

`lint-staged` applies the first two to staged files on every commit, `syncpack` runs at pre-commit, and `commitlint` checks the message. Because the hooks write, let them be the formatting pass rather than running a formatter by hand mid-edit.

Governance gates come from the KI CLI:

```bash
ki repo audit --repo .                    # every declared skill
ki repo audit --skill ki-guides --repo .  # one skill
```

`.ki.toml` declares which skills apply, so a documentation change is checked by `ki-guides` and `ki-authoring`, and a roadmap record by `ki-work-roadmap`. A clean pass from a skill that does not govern what you changed is not verification.

## What CI runs

The workflow installs the toolchain with mise, runs `bun install --frozen-lockfile`, installs a pinned isolated KI CLI and bootstraps it, then runs:

1. `ki repo audit --repo .`
2. `bun run test`
3. `bun run test:coverage`
4. `bun run ki:test:smoke`

So the minimum before pushing is those four, in that order. Type errors surface through `bun run build`, which `ki:test:smoke` performs first.

## Conventions

**TypeScript ES modules.** `"type": "module"`, and internal imports carry `.js` extensions (`from '../../main/notes/index.js'`) so `tsc` emits valid JavaScript. Top-level declarations are arrow functions: `export const foo = () => …`.

**Configuration is injected.** Nothing below the entry point reads `process.env`. Take a `Config`, or the slice you need, as the first argument. [Architecture](architecture.md) covers why.

**Paths go through the guards.** Any input that reaches the filesystem goes through `resolveWithinRoot` and `assertRealPathWithinRoot`, then the zone and protected-path checks. Never join a caller-supplied path onto a root by hand.

**Errors and results.** Behaviour in `src/main/` throws plain `Error`s; the tool layer converts with `errorResult` and wraps success with `jsonResult`. Error text is a contract with people — the user guides quote several messages verbatim, so changing one is a documentation change too.

**Annotations are honest.** `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` decide whether a tool is registered at all. Pick a preset from `src/utils/annotations.ts` that is true of your tool.

**Conventional Commits.** [CONTRIBUTING.md](../../../CONTRIBUTING.md) carries the type table and what a pull request should include.
