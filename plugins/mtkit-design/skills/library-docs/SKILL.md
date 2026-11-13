---
name: library-docs
description: Verify a version-sensitive public library or SDK API with Context7 before answering or implementing.
---

Identify the library and version from the request, manifest, or lockfile. Call Context7's `resolve-library-id` unless you already have the exact ID. Then call `query-docs` with the API, version, and behavior you need. Compare examples with installed types when the retrieved docs target a different version.

Use the library's official documentation and local types if Context7 is unavailable. For private `@mtkit/*` packages, use installed types, package documentation, and the team's repository. Send only public dependency names and generalized API questions to Context7. Answer in the user's language and mention material version mismatches.
