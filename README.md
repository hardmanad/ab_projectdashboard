# Workfront Project Dashboard — Adobe App Builder UIX Extension

An Adobe App Builder extension that adds a **Project Dashboard** main menu item to Adobe Workfront. It provides a two-column project dashboard with a filterable project list on the left and a detail panel on the right showing project metadata, comments, and documents — all read from the Workfront REST API v20.0 via a server-side proxy action.

## Prerequisites

- **Node.js** v18 or later and npm
- **Adobe I/O CLI** (`npm install -g @adobe/aio-cli`)
- An **Adobe Developer Console** organization with App Builder entitlement
- A **Workfront** instance (the extension reads projects from your Workfront org)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Connect to your Adobe Developer Console project

Create (or reuse) an App Builder project in [Adobe Developer Console](https://developer.adobe.com/console) with:
- A workspace (e.g. `Stage`)
- **Adobe Workfront** API service added to the workspace
- An **OAuth Server-to-Server** credential

Then run:

```bash
aio app use
```

This command generates your `.env` and `.aio` files with all the runtime credentials and IMS context variables for your project. See `.env.example` and `.aio.example` for the expected structure.

### 3. Set `AIO_STATIC_HOST` in `.env`

After `aio app use` completes, your `.env` will contain `AIO_runtime_namespace`. Add the following line, substituting that namespace value:

```bash
AIO_STATIC_HOST=YOUR_NAMESPACE.adobeio-static.net
```

For example, if `AIO_runtime_namespace=12345-myproject-stage`, then:

```bash
AIO_STATIC_HOST=12345-myproject-stage.adobeio-static.net
```

This tells the frontend where to reach the deployed proxy action. It is the only variable not generated automatically by `aio app use`.

### 4. Register the extension in Workfront

Deploy the app at least once so Workfront can discover the extension:

```bash
aio app deploy
```

Then open your Workfront instance. The **Project Dashboard** menu item will appear in the left navigation.

## Local Development

```bash
aio app run
```

Starts the UI at `http://localhost:9080`. Actions are deployed to Adobe I/O Runtime (not run locally). The `AIO_STATIC_HOST` in your `.env` must already point to a valid deployed namespace for API calls to work.

To run actions locally as well:

```bash
aio app dev
```

See the [aio app run vs aio app dev docs](https://developer.adobe.com/app-builder/docs/guides/development/#aio-app-dev-vs-aio-app-run) for details.

## Testing

```bash
aio app test          # unit tests
aio app test --e2e    # end-to-end tests
npm run lint          # lint source and actions
```

## Document Uploads

Custom Documents uploads raw files directly to private App Builder Files storage using a ten-minute, write-only presigned URL. Runtime requests contain metadata and upload IDs, never base64 file contents. The initial per-file limit is 100 MB; it is an application limit, not the aggregate Files storage quota or a guarantee of Workfront tenant limits.

Files up to 5 MB (5,242,880 bytes) transfer inline inside the `upload-project-document` start action. It reuses the initialized Files SDK and authorized job, snapshots and streams the staged file to Workfront API v20.0, and attaches the returned handle to the Project. The completed document is returned directly, avoiding another Runtime invocation and normal completion polling. The cutoff is enforced by `INLINE_FILE_SIZE_LIMIT` on the server, not a client hint.

Larger files use the non-web `transfer-project-document` worker asynchronously. Both paths share the same transfer routine, private snapshot, duplicate protection, and cleanup. Both actions have a ten-minute execution limit. Runtime's blocking web-action response window remains 60 seconds; a timed-out inline action can continue processing and saving status. Gateway/server errors or network failures during start cause the browser to poll the same upload ID, never launch another transfer. A small file is not a guarantee of fast Workfront processing.

The UI shows filename-specific progress and errors beside the drop area. Batch uploads are sequential and successful documents refresh even if another file fails.

Upload records are bound to the initiating Workfront session and project. Private conditional-write claims prevent duplicate starts and workers. Successful transfers delete staged bytes; the hourly cleanup alarm deletes expired jobs and abandoned files after 24 hours. Failed bytes remain until expiry for investigation; automatic retries are deliberately disabled because a lost response after document creation can leave an uncertain outcome. Check Project Documents before retrying a timed-out transfer.

Deploy the updated actions, hourly alarm/rule, and frontend together with `aio app deploy`. Browser storage writes require CORS allowing the app origin, `PUT`, `Content-Type`, and `x-ms-blob-type`. An external presigned URL must be used by the browser; internal storage URLs work only inside Runtime. Storage SDK read/delete operations also require execution inside Runtime.

Run focused upload tests with `npm test -- --runInBand documentUploads`. These cover staging, ownership, size limits, duplicate claims, streaming handoff, cleanup, error responses, and inline error placement. Live Workfront transfer still requires a deployed extension and an authenticated Workfront session.

## Deploy & Cleanup

```bash
aio app deploy    # build and deploy actions + static assets
aio app undeploy  # remove the deployed app
```

## Config Files

### `.env`

Contains runtime credentials and secrets. **Never commit this file.**
Copy `.env.example` to `.env` and populate it, or let `aio app use` generate it for you.

### `.aio`

Contains project and workspace metadata written by `aio app use`. **Never commit this file.**
See `.aio.example` for the expected structure.

### `app.config.yaml`

Defines the extension entry point and action configuration. Safe to commit — contains no secrets.

### `src/workfront-ui-1/web-src/src/config.json`

Intentionally empty (`{}`). The proxy action URL is derived at runtime from `AIO_STATIC_HOST` (set in `.env`) or from the current page hostname as a fallback.

## Project Structure

```
src/workfront-ui-1/
├── actions/
│   └── workfront-proxy/    # Server-side proxy to Workfront API (avoids CORS)
└── web-src/src/
    ├── components/         # React Spectrum UI components
    ├── services/
    │   └── workfrontApi.js # All Workfront API calls (via proxy)
    └── utils/              # Date formatting, URL building
```

## Temporary Context Diagnostics

Diagnostics are now disabled (`CONTEXT_DIAGNOSTICS_ENABLED = false`): no attribute reports or diagnostic change listeners are created on any page. The capture procedure below is retained for reference and requires explicitly re-enabling the switch.

The declared SDK is `@adobe/uix-guest` `^0.10.0`; the locally installed version inspected for these diagnostics is `0.10.5`. The integration iframe uses `register({ metadata, methods })`, and the dashboard, Project Details, and Custom Documents views use `attach({ id: extensionId })`.

This SDK exposes `sharedContext.get(key)`, but no public method to enumerate keys. Initial diagnostics therefore use a guarded read of the private `sharedContext._map` as a temporary, version-dependent fallback. If it is unavailable, the report explicitly says `unavailable`; this does not mean the host context is empty. The supported `contextchange` event exposes a plain context object at `event.detail.context`, not `event.context`. Diagnostics subscribe immediately after connection and remove listeners on unmount.

Reports include every top-level context field name and its type (`typeof`, with distinct `null` and `array` labels). Expand the `children` list on `auth` and `user` to inspect nested field names and types, also included in change reports. Nested objects are traversed up to five levels, with circular references marked and getters left unevaluated (`accessor`). Array elements, credentials, hostnames, IDs, personal values, and raw connection/event/error objects are not logged. Other top-level objects are not traversed. SDK debug mode is not enabled.

1. Validate with `npx jest --runInBand test/contextDiagnostics.test.js` and `aio app build --no-actions --web-assets --web-optimize`.
2. Deploy through your usual configured App Builder workflow. Open Workfront browser DevTools before loading the extension; enable **Info** messages and **Preserve log**, and disable any selected-frame-only filter.
3. Filter the console by `[Workfront context diagnostics]`. Open Project Dashboard, Project Details, and Custom Documents. Reports identify the source (`registration`, `project-dashboard`, `project-tab`, or `custom-documents`) and phase (`initial` or `contextchange`), plus the available `get` and change-listener APIs.
4. Switch projects or trigger another host context update. Capture the filtered reports. Depending on Workfront navigation, a frame may reload and emit a new `initial` report instead of receiving `contextchange`; event support alone does not guarantee a host update.
5. After capture, set `CONTEXT_DIAGNOSTICS_ENABLED` to `false` in [contextDiagnostics.js](src/workfront-ui-1/web-src/src/utils/contextDiagnostics.js), rebuild, and redeploy to silence all temporary reports.

Real host field names and change delivery require a deployed Workfront session; local tests use synthetic context only. Share only the filtered diagnostics, not unrelated application or host logs.
