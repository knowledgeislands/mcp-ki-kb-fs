# Publishing

This package is published to npm under the `@knowledgeislands` scope as
`@knowledgeislands/mcp-kb`.

## One-time setup

You only need to do these once per machine.

### 1. Create / sign in to an npm account

```bash
npm login
```

This opens a browser for OAuth. Verify with:

```bash
npm whoami
```

### 2. Make sure the `@knowledgeislands` org exists on npm

If it doesn't:

```bash
# Create the org (web only — npm CLI cannot create orgs)
open https://www.npmjs.com/org/create
```

Add yourself as a member (or owner). Public scoped packages don't require a
paid plan.

### 3. Enable 2FA (recommended)

```bash
npm profile enable-2fa auth-and-writes
```

You'll be prompted for the OTP on every publish.

## Publish workflow

### 1. Make sure the working tree is clean

```bash
git status
```

Commit or stash everything before publishing — `npm publish` packages
whatever's on disk, not what's committed.

### 2. Bump the version

Use one of:

```bash
npm version patch   # 1.0.0 → 1.0.1   (bug fixes)
npm version minor   # 1.0.0 → 1.1.0   (new features, backwards compatible)
npm version major   # 1.0.0 → 2.0.0   (breaking changes)
```

`npm version` updates `package.json`, creates a git commit, and tags it
(`v1.0.1`). Push the tag with `git push --follow-tags`.

### 3. Publish

```bash
npm publish
```

This automatically runs `prepublishOnly` (which runs `npm run build`) so
`dist/` is fresh before the tarball is built.

If 2FA is on, you'll be asked for an OTP.

### 4. Verify

```bash
npm view @knowledgeislands/mcp-kb
```

Or visit <https://www.npmjs.com/package/@knowledgeislands/mcp-kb>.

## Dry run

Before the real publish, inspect exactly what will ship:

```bash
npm pack --dry-run
```

This prints the tarball file list, package size, and total file count without
actually publishing or producing a tarball. Cross-check against `files` in
`package.json` (currently `["dist"]`).

## Unpublishing

npm allows unpublish only within 72 hours of publish, and only when no other
package depends on the version. Generally prefer **deprecation** over
unpublish:

```bash
npm deprecate @knowledgeislands/mcp-kb@1.2.3 "use 1.2.4 — fixes <issue>"
```

For real removal within the 72-hour window:

```bash
npm unpublish @knowledgeislands/mcp-kb@1.2.3
```

## What gets published

The `files` field in `package.json` is the allowlist. npm always also includes
`package.json`, `README.md`, `LICENSE`, and any executables listed in `bin`.

Everything else (sources under `src/`, tests, configs, `node_modules/`,
`.tsbuildinfo`, etc.) is excluded automatically.

## Release checklist

- [ ] All changes merged to `main`
- [ ] CI is green on `main`
- [ ] `CHANGELOG.md` updated (if present)
- [ ] `npm pack --dry-run` shows the expected files
- [ ] `npm version <patch|minor|major>` to bump + tag
- [ ] `git push --follow-tags`
- [ ] `npm publish`
- [ ] Verify on <https://www.npmjs.com/package/@knowledgeislands/mcp-kb>
- [ ] Create a GitHub Release from the new tag (optional)
