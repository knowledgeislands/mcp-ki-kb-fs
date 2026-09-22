# Developer guides

For anyone changing this repository's code: how the layers fit together, which invariants every change has to preserve, and how to run the loop and its gates locally.

Start with [the architecture](architecture.md) if you are new to the codebase, and [working on the code](working-on-the-code.md) when you already know where your change goes and want to get it green. [CONTRIBUTING.md](../../../CONTRIBUTING.md) holds the contribution contract itself — commit format, and what a pull request is expected to carry.

## Contents

- [Architecture](architecture.md) — the four layers, what each is allowed to know, the containment and access-gate invariants, and where a new tool has to be touched.
- [Working on the code](working-on-the-code.md) — toolchain, the dev loop, the test and coverage contract, the gates, and what CI runs.

## What is distinctive here

Three things about this server are worth knowing before reading any file, because they explain choices that would otherwise look arbitrary.

**Configuration is injected, never read ambiently.** Nothing below the entry point reads `process.env`. `loadConfig()` produces a validated `Config` once, at startup, and every function takes what it needs as an argument. That is what makes the test suite able to build a configuration literal instead of mutating the environment, and it is why a configuration change requires a restart.

**The authorisation boundary is data, not code.** Which knowledge bases exist, which folders inside them are reachable, and which tools are registered at all are decided from that one validated `Config`. No tool accepts a filesystem path, so no handler can be persuaded into one.

**The tool layer is deliberately thin.** It holds argument schemas, annotations, and envelope wrapping, and nothing else — which is why it is excluded from coverage and covered by a wire-level smoke test instead. Behaviour lives in `src/main/`, where it can be tested without a protocol.

## Related material

The user-facing side of the same system is under [user guides](../user/README.md), and it is worth reading before changing behaviour — the rejection messages documented there are a contract with people, not just strings.

Why the design is as it is belongs in [decision records](../../decisions/README.md); what is planned belongs in [the roadmap](../../roadmap/).
