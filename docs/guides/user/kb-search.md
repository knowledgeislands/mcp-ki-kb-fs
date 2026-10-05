# Searching a knowledge base

Use `kb_search` to retrieve a few relevant local notes from one declared `kb`. It is available at the default read access level, but each KB needs explicitly provisioned derived search state and a trusted operator-owned loopback daemon. The tool never installs models, builds an index or starts that daemon on demand.

## Bind prepared search state

Follow the [tools operator guide](../../../../tools-ki/docs/guides/user/kb-search.md) to register the KB with one explicit unique search boundary, provision pinned local models, create a current sanitized index generation and configure its one-KB daemon. The [mapping specification](../../../../tools-ki/docs/specs/kb-search.md) owns the generated state contract.

Add the optional environment binding alongside the ordinary KB declaration, then restart this MCP server:

```json
{
  "MCP_KI_KB_FS_KNOWLEDGE_BASES": "{\"alpha\":\"/absolute/kb/alpha\"}",
  "MCP_KI_KB_FS_SEARCH_BINDINGS": "{\"alpha\":{\"registry_id\":\"registered-alpha\",\"state_directory\":\"/absolute/ki/state\"}}"
}
```

The alias is a client selector; `registry_id` is the stable owner-registered KB identity. Neither is inferred from a folder name. Existing file tools need no search binding. Search requires canonical KB declaration and zones; migrate retired zone configuration explicitly as described in [scoping](scoping-a-knowledge-base.md).

## Retrieve and inspect

Choose `query` for lexical plus semantic retrieval and reranking, `search` for lexical retrieval, or `vsearch` for vector retrieval. Optional `zone` names a canonical zone, even when its actual folder has a different name. `path_prefix` restricts results to a safe KB-relative subtree. Start with the default five results; the maximum is fifty.

Returned paths and line windows refer to current authorized local Markdown. Read the selected note with `kb_read` before treating a short snippet as complete context. Results are a bounded candidate set, not exhaustive. A mirror label describes declared provenance and text shape, not independent verification of a binary or private source store.

## Recover from unavailable search

A missing binding, model, endpoint, changed declaration, stale source/projection or failed audit append produces an unavailable/error result. Ask the operator to inspect or refresh explicit derived state. The agent can use literal grep and targeted reads through its QUERY workflow while search remains unavailable; this server does not silently switch retrieval methods.

Search preserves canonical KB/registry authority. The daemon may write disposable retrieval caches, so read-only does not promise zero cache maintenance. Loopback alone does not authenticate local clients; expose the governed MCP tool rather than a raw qmd daemon. Enabled `writes`/`all` audit logs record search outcomes without query text, snippets or document paths; `off` retains its explicit opt-out. See the [accepted search contract](../../specs/kb-search.md) for the precise protocol, audit limits and evidence.
