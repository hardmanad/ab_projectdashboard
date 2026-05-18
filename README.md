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
