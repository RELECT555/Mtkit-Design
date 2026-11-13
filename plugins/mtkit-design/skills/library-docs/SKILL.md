---
name: library-docs
description: Look up and verify version-sensitive API usage for a public frontend library or SDK. Use for questions about supported APIs, migration, or React and TypeScript examples that depend on the installed version.
---

For a standalone public-library question, use MTKit Catalog's `recommend_tools` when available with the public library name and the API question. If project setup has not yet been checked in this session, request `bootstrap_project` for the current client. A documentation-only question does not authorize writing project rules; follow setup guidance in-session. Identify the library and version from the request, manifest, or lockfile. Call Context7's `resolve-library-id` unless you already have the exact ID. Then call `query-docs` with the API, version, and behavior you need. Compare examples with installed types when the retrieved docs target a different version.

Use the library's official documentation and local types if Context7 is unavailable. For private `@mtkit/*` packages, use installed types, package documentation, and the team's repository. Send only public dependency names and generalized API questions to Context7. Answer in the user's language and mention material version mismatches.
