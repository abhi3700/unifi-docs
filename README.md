# UniFi public documentation

Public product guides and API documentation for UniFi, built with Vite and MDX.

## Develop

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Edit the existing MDX files and use `docs.json` to update the section order and navigation. Endpoint pages are generated from `api-reference/openapi.json` and use the same paths as the Mintlify reference.

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
npm run build
npm run check
wrangler pages deploy dist --project-name unifi-docs --branch feat/vite-docs
```

The Pages project uses `main` as its production branch. Deploying `feat/vite-docs` publishes a preview.
