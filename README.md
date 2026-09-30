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

Larger files use the non-web `transfer-project-document` worker asynchronously. Both paths share the same transfer routine, private snapshot, duplicate protection, cleanup, and timing instrumentation. Both actions have a ten-minute execution limit. Runtime's blocking web-action response window remains 60 seconds; a timed-out inline action can continue processing and saving status. Gateway/server errors or network failures during start cause the browser to poll the same upload ID, never launch another transfer. A small file is not a guarantee of fast Workfront processing.

The UI shows filename-specific progress and errors beside the drop area. Batch uploads are sequential and successful documents refresh even if another file fails.

Upload records are bound to the initiating Workfront session and project. Private conditional-write claims prevent duplicate starts and workers. Successful transfers delete staged bytes; the hourly cleanup alarm deletes expired jobs and abandoned files after 24 hours. Failed bytes remain until expiry for investigation; automatic retries are deliberately disabled because a lost response after document creation can leave an uncertain outcome. Check Project Documents before retrying a timed-out transfer.

Deploy the updated actions, hourly alarm/rule, and frontend together with `aio app deploy`. Browser storage writes require CORS allowing the app origin, `PUT`, `Content-Type`, and `x-ms-blob-type`. An external presigned URL must be used by the browser; internal storage URLs work only inside Runtime. Storage SDK read/delete operations also require execution inside Runtime.

Run focused upload tests with `npm test -- --runInBand documentUploads`. These cover staging, ownership, size limits, duplicate claims, streaming handoff, cleanup, error responses, and inline error placement. Live Workfront transfer still requires a deployed extension and an authenticated Workfront session.

### Upload Timing Logs

Upload actions emit one-line JSON logs with `event: "WF_DOCUMENT_UPLOAD_TIMING"`. Existing Runtime log forwarding sends these to New Relic. Search for that keyword, then filter by `uploadId` to correlate the control action, asynchronous worker, and browser report. No separate timing database is maintained.

Each log includes `uploadId`, `projectId`, `fileSize` (bytes), `phase`, `durationMs`, `outcome` (`success` or `error`), `source` (`runtime` or `browser`), and the reporting Runtime `activationId`. Once the server selects a path, `transferMode` is `inline` or `async`. Browser reports also include `pollCount`. Timing logs exclude filenames, tokens, signed URLs, file contents, and response bodies.

Key phases are `prepare_total`, `start_setup`, `worker_invoke`, `queue_to_worker_entry`, `worker_setup`, `snapshot_copy`, `snapshot_verify`, `stream_open`, `workfront_upload`, `document_create`, `completion_status_write`, `cleanup`, and `worker_total`. More detailed control phases include storage initialization, project access, staging preparation, and queued-status writes.

Inline transfers use `inline_setup` and `inline_total` instead of worker setup/total and have no `worker_invoke` or `queue_to_worker_entry`. `start_total` and `browser_start` now include the full inline transfer; `pollCount` is zero when the completion response arrives normally.

The browser sends a single authenticated, non-blocking timing report after success or failure: `browser_prepare`, `browser_storage_upload`, `browser_start`, `browser_polling`, and `browser_total`. Reporting failures do not affect uploads. Browser reports are client-reported measurements and are best effort; they may be absent if preparation fails before an upload ID exists, connectivity is lost, or the page closes.

Durations within an action or browser use a monotonic clock. `queue_to_worker_entry` uses server wall-clock timestamps and includes queuing, invocation scheduling, and startup before worker entry; it is not an isolated cold-start measurement. `browser_polling` includes worker wait time, HTTP requests, and polling intervals, not just polling overhead. Total phases overlap their component phases: do not add totals to component durations. `browser_total` ends when completion is observed, before the document-list refresh; `worker_total` includes cleanup, which can finish after the browser observes success.

Example New Relic NRQL search (works even if JSON fields have not been extracted):

```sql
FROM Log SELECT *
WHERE message LIKE '%WF_DOCUMENT_UPLOAD_TIMING%'
SINCE 1 hour ago
LIMIT 100
```

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
