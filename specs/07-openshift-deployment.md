# 07 — OpenShift Deployment

Normative for deployment artifacts, on-cluster builds, and runtime
wiring. Gameplay (02), draft/boons (03), input (04), presentation (05),
and tech layout (06) are unchanged — this spec only defines how the
static `dist/` bundle gets built and served on any OpenShift 4.x cluster.

## Goals (locked)

- **Portable:** only core APIs — `build.openshift.io/v1 BuildConfig`,
  `image.openshift.io/v1 ImageStream`, `apps/v1 Deployment`, `v1 Service`,
  `route.openshift.io/v1 Route`. No operators, no Helm, no cluster-specific CRDs.
- **On-cluster builds:** `BuildConfig --strategy=docker` tracking git
  (`johwes/monster-invaders`, branch `main`). No local image builds required.
- **Hardened-only bases:** `registry.redhat.io/hi/*` exclusively.
  Builder compiles the bundle, nginx serves it — the game itself runs
  entirely in the player's browser (static files, no server-side logic).
- **Route:** default generated hostname, `edge` TLS with
  `insecureEdgeTerminationPolicy: Redirect`.
- **Source of truth for the bundle** stays `npm run build` (`tsc && vite build`).

## Why two images

- `hi/nodejs:24-builder` is the factory: runs `npm ci` + `npm run build`
  to compile `src/*.ts` into `dist/`. Thrown away after the build.
- `hi/nginx` is the waiter: serves `dist/` on `:8080`. There is no Node
  server entrypoint in this repo (`dist/` = `index.html` + `assets/`),
  so a Node runtime would have nothing to execute.

## Pinned images (verified 2026-09-17 via `oc image info`)

| Stage | Reference |
|-------|-----------|
| Builder | `registry.redhat.io/hi/nodejs:24-builder@sha256:935b21686ec6adfc0efb1cbd304baa4fe42567aac3b0346b9803618033fbdab8` |
| Runtime | `registry.redhat.io/hi/nginx:latest@sha256:19e9f607ea41c26470dcd10d6fc3b483ff3fe88701f9584e4228b62e17b26fe1` |

Tags float; digests pin. Re-pin with `oc image info <ref>` when refreshing.
Inspected filesystem facts (do not re-assume): nginx binary
`/usr/bin/nginx`, docroot `/usr/share/nginx/html`, main conf
`/etc/nginx/nginx.conf` (unprivileged: `pid /tmp/nginx.pid`, no `user`
directive), default server `/etc/nginx/conf.d/default.conf` already
`listen 8080`; builder provides `/usr/bin/node` + `/usr/bin/npm`, `/app` exists.

Prerequisite: the cluster must pull `registry.redhat.io` (global pull
secret with Red Hat entitlement — verified present on the dev cluster
since `oc image info` resolves both refs). If pulls fail, fix the pull
secret; do not swap in non-hardened bases without updating this spec.

## Dockerfile (multi-stage, repo root)

```dockerfile
FROM registry.redhat.io/hi/nodejs:24-builder@sha256:935b… AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM registry.redhat.io/hi/nginx:latest@sha256:19e9… 
COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["-g", "daemon off;"]
```

Rules: `CMD ["-g", "daemon off;"]` only (the base image's entrypoint is
already the nginx binary — passing the binary path breaks startup);
`EXPOSE 8080` documents the port; `.dockerignore` excludes `node_modules/`, `dist/` from context.

## nginx server block (`deploy/nginx/default.conf`)

Replaces the stock `conf.d/default.conf`. Keeps base conventions
(`listen 8080`, `root /usr/share/nginx/html`):

- `location / { try_files $uri $uri/ /index.html; }` — SPA fallback.
- `location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }` —
  vite emits hashed filenames, safe to cache forever.
- `gzip on` for `text/css` + `application/javascript`.
- Security headers: `X-Content-Type-Options nosniff`, `X-Frame-Options DENY`,
  `Referrer-Policy no-referrer`.
- No `user` directive, nothing listening below 1024 — arbitrary-UID safe.

## OpenShift objects (`deploy/openshift/`, namespace-agnostic)

All applied with `oc apply -f deploy/openshift/ -n <project>`.
App name: `wizards-ward`.

| File | Kind | Key fields |
|------|------|-----------|
| `imagestream.yaml` | `ImageStream wizards-ward` | none (filled by build output) |
| `buildconfig.yaml` | `BuildConfig wizards-ward` | `source.git { uri: https://github.com/johwes/monster-invaders.git, ref: main }`, `strategy.dockerStrategy { dockerfilePath: Dockerfile }`, `output.to { kind: ImageStreamTag, name: "wizards-ward:latest" }`, triggers `ConfigChange` (+ `ImageChange` on output), build resources requests `500m/1Gi` limits `2/4Gi` (inside `compute-build` quota) |
| `deployment.yaml` | `Deployment wizards-ward` | 1 replica; image `image-registry.openshift-image-registry.svc:5000/<project>/wizards-ward:latest` with `<project>` substituted at apply (see procedure); `ports: [{ containerPort: 8080 }]`; probes `GET /` (readiness 5s/5s, liveness 30s/10s); resources requests `10m/64Mi` limits `500m/512Mi` (inside `compute-deploy` quota + `LimitRange` defaults); `securityContext: { seccompProfile: { type: RuntimeDefault } }` (no UID set — OpenShift assigns it) |
| `service.yaml` | `Service wizards-ward` | `ports: [{ port: 8080, targetPort: 8080 }]`, selector `app: wizards-ward` |
| `route.yaml` | `Route wizards-ward` | `to: { kind: Service, name: wizards-ward }`, `port: { targetPort: 8080 }`, `tls: { termination: edge, insecureEdgeTerminationPolicy: Redirect }`, no `host` (generated) |

## Apply procedure

```sh
oc new-project <project>            # or: oc project <project>
oc apply -f deploy/openshift/ -n $(oc project -q)   # then substitute <project> in deployment image, re-apply
oc start-build wizards-ward --follow -n $(oc project -q)
oc rollout status deploy/wizards-ward
curl -sk https://$(oc get route wizards-ward -o jsonpath='{.spec.host}')/ | head
```

The `<project>` placeholder in `deployment.yaml` is substituted with the
target namespace before apply (one `sed`/manual edit). Rationale: plain
`Deployment` cannot reference an `ImageStreamTag` by short name; the
in-cluster integrated registry hostname
`image-registry.openshift-image-registry.svc:5000` is standard on every
OpenShift 4.x, keeping the manifest portable.

## Acceptance checklist (on-cluster)

- [ ] `oc start-build` completes from a clean `main` clone (no local artifacts).
- [ ] Pod runs as arbitrary UID (no SCC errors), `readinessProbe` green.
- [ ] `https://<generated-host>/` returns 200, body references `/assets/`.
- [ ] Hard refresh + navigation to `/` re-serves `index.html` (SPA fallback).
- [ ] `/assets/*` responds `Cache-Control: public, immutable`.
- [ ] Game boots in the route URL: menu → incursion 1 playable; `ww.highScore`/`ww.muted` persist across reload.
- [ ] Rebuild after a content commit changes the bundle and rolls out.
