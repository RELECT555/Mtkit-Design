# Add MTKit to an application

## Configure the Azure Artifacts feed

Add the scope mapping to the project's `.npmrc` next to `package.json`. Preserve any existing registry configuration. A new project can use both lines below.

```ini
registry=https://registry.npmjs.org/
@mtkit:registry=https://pkgs.dev.azure.com/medipalprojects/_packaging/mt-packages/npm/registry/
```

For first-time integration, verify access and package metadata at the documented versions. Run the second command only when the app needs the canvas grid. If a package is already installed, use the version in the project's lockfile.

```sh
npm view @mtkit/ui@1.1.1 version peerDependencies exports
npm view @mtkit/data-grid-table@1.1.8 version peerDependencies exports
```

On Windows, a developer can authenticate from the application root with `vsts-npm-auth`. Install the helper only if it is missing.

```powershell
npm install -g vsts-npm-auth --registry https://registry.npmjs.org/
vsts-npm-auth -C .npmrc -R
```

If npm returns `E401` and the helper does not replace expired credentials, the developer can repeat authentication with `-F`. For manual authentication, use a PAT scoped to `Packaging: Read` and follow the [user-level npm configuration instructions](https://learn.microsoft.com/en-us/azure/devops/artifacts/npm/npmrc?tabs=other&view=azure-devops). Store credentials in user configuration or CI secrets.

## Install compatible packages

`@mtkit/ui@1.1.1` documents `react` and `react-dom` peer dependencies at `^19`. Check the actual peer dependencies before installing. Treat a React major-version migration as a separate change. If the feed is inaccessible, report which package and checks are blocked. If you continue with existing components for a prototype, identify what still needs to be integrated.

```sh
npm install --save-exact @mtkit/ui@1.1.1
# Add only when the screen needs the canvas grid:
npm install --save-exact @mtkit/data-grid-table@1.1.8
```

Use the project's package manager and lockfile. Confirm component props and exports against the installed package's types and examples.

## Import the components and styles

```tsx
import { Button, Card, CardHeader, CardTitle } from "@mtkit/ui";
```

The ESM entry point loads CSS. Use `@mtkit/ui/styles.css` explicitly if the build strips the automatic CSS import or you use the UMD bundle without a bundler. If theme variables conflict, inspect the applied declarations in the browser. Load app-wide styles before the first MTKit import when MTKit should win matching `:root` or `.dark` declarations.

```tsx
import { DataGridTable } from "@mtkit/data-grid-table";
import "@mtkit/data-grid-table/styles.css";
```

Column configuration and UI controls come from `@mtkit/ui`. The canvas, queries, formulas, relations, view state, and Excel import/export belong to `@mtkit/data-grid-table`.
