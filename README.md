# UniFi public documentation

Public product guides and API documentation for UniFi, built with Vite and MDX.

## Develop

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

The local preview runs at `http://localhost:3001`. Edit the MDX files for copy and `docs.json`
for navigation. The API endpoint pages come from `api-reference/openapi.json`.

## API reference environments

| Vite mode | Web app | API default |
| --- | --- | --- |
| `development`, `test`, `canvas` | `http://localhost:3334` | `http://localhost:3333` |
| `dev` | `https://dev.payunifi.com` | OpenAPI server |
| `production` | `https://payunifi.com` | OpenAPI server |

Set `VITE_WEB_APP_BASE_URL` and `VITE_API_BASE_URL` in the build environment or the matching
`.env.<mode>.local` file to override these public origins. For `docs.dev.payunifi.com`, set
`VITE_API_BASE_URL` to the API running in dev mode so the docs origin matches its CORS policy.
Each OpenAPI operation has a stable `x-playground-id` used by `/app/api/playground/<number>`.

## Build and check

```sh
npm run build
npm run check
npm run preview
```

The build generates static HTML, the search index, and the Cloudflare Pages assets in `dist/`. The check covers local links, anchors, images, and OpenAPI operation coverage.

## Deploy a preview

Run these commands from the public docs repository after authenticating Wrangler.

```sh
npm run build -- --mode dev
npm run check
wrangler pages deploy dist --project-name unifi-docs --branch feat/vite-docs
```

The Pages project uses `main` as its production branch. Deploying `feat/vite-docs` publishes a preview.
