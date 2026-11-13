# Select tools for the task

At the start of a frontend task, call MTKit Catalog's `recommend_tools` with `task` set to a short summary of the requested outcome and relevant stack. Include constraints that affect the choice, such as review only, a supplied mockup, or keyboard testing. Keep private source, credentials, and internal URLs in the project.

Use recommendations that fit the request and are available in the current client. Load the selected installed skills and call the relevant configured MCP tools when the work calls for them. Keep any review-only restriction. If a missing skill or tool blocks the task, explain the gap and request its `plan_install` for the current client. Treat the result as setup instructions and follow the user's scope for installation.

Reuse recommendations already obtained for the same task when following another workflow. If MTKit Catalog is unavailable or returns no useful recommendation, select relevant installed skills using the [frontend skill guide](frontend-skills.md) and continue with the tools available in the client.
