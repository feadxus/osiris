# Osiris Ota Pressure Matrix

## Scope

- Repo: `simplifaisoul/osiris`
- Contract: [`ota.yaml`](./ota.yaml)
- GitHub matrix: [`.github/workflows/test-ota-contract-matrix.yml`](./.github/workflows/test-ota-contract-matrix.yml)
- Evidence sources: `README.md`, `DOCKER.md`, `Dockerfile`, `docker-compose.yml`, `package.json`, `tsconfig.json`, `src/app/api/health/route.ts`

This pressure slice covers the repo-owned npm workflow, host-native Next.js runtime, Ota-managed container runtime, and documented Docker Compose self-host path. It does not invent a test surface because `package.json` does not define one. It also keeps lint visible but out of the default verification path because the current upstream lint baseline is red.

## Coverage Matrix

| Surface | Repo truth | Ota mapping | GitHub pressure lane |
| --- | --- | --- | --- |
| Node runtime | Dockerfile uses `node:22-alpine`; dependency engines reject Node 23 | Native/container Node tasks require `^22.13.0` | GitHub uses Node 22 |
| Install | `npm install` in README; `package-lock.json` present | `task: install` uses `npm ci` | All OS dry-run; Ubuntu full proof through `verify` and runtime proofs |
| Lint | `npm run lint`, but baseline currently fails | `task: lint` stays visible but outside `verify` | Listed/dry-run only until upstream lint is fixed |
| Typecheck | No script; `tsconfig.json` present | `task: typecheck` uses `npm exec -- tsc --noEmit` | Ubuntu full proof through `verify` |
| Build | `npm run build`; Dockerfile also builds | `task: build`, `workflow: prod` | All OS dry-run; Ubuntu full proof through `verify` |
| Tests | No `test` script in `package.json` | Not modeled | Explicitly out of scope until upstream adds a canonical test command |
| Native dev app | `npm run dev` | `workflow: app`, `task: dev` | All OS dry-run; Ubuntu runtime proof |
| Native production app | `npm run build` then `npm run start` | `workflow: prod`, `task: start` | All OS dry-run |
| Ota-managed container dev app | Node 22 app in container backend | `workflow: app:container` | Ubuntu dry-run; container verification task proof |
| Ota-managed container production app | Node 22 app in container backend after build | `workflow: prod:container` | Ubuntu dry-run |
| Docker Compose self-host | `docker compose up -d` in README/DOCKER.md | `workflow: docker`, `task: dev:docker` | Ubuntu dry-run and runtime proof |
| App readiness | `/` serves HTML | `surface: app` | Runtime proof on Ubuntu |
| API readiness | `/api/health` returns `status: operational` | `surface: health` | Runtime proof on Ubuntu |

## Current Contract Corrections

- `package-lock.json` is protected, not writable. Readiness agents should not silently rewrite dependency resolution.
- `.env`, `.env.template`, `.env.example`, Docker topology, docs, and `ota.yaml` are protected.
- Optional `.env` creation remains available as `task: setup:env`, but it is not part of runtime workflows because Osiris works without API keys and Docker Compose marks `.env` optional.
- Local Ota state directories are ignored in `.gitignore`.
- The contract declares `metadata.ota.minimum_version: "1.6.15"` because it uses newer Ota schema features.
- The nonexistent `npm test` surface was removed instead of being modeled as an intentionally failing task.
- `verify` now proves typecheck and build only; lint is a separate visible task because this repo currently has 258 lint errors and 30 warnings.
- Node is pinned to the Node 22 line because the dependency tree emits engine warnings on Node 23.

## Ota Gaps Exposed

| Gap | Severity | Observed in Osiris | Why it matters | Discuss before fixing |
| --- | --- | --- | --- | --- |
| Generated-write effects are not first-class | Product maturity | Declaring `effects.writes: [node_modules]` or `.next` on agent-safe tasks fails validation unless those generated paths are added to `agent.writable_paths` | That conflates generated/cache output with source-edit authority. A mature schema likely needs generated/cache side effects separate from source writes. | Yes |
| Networked dependency hydration warning is too blunt | Product UX | `install` is correctly locked to `npm ci` and safe for agents to run, but `effects.network: true` still produces an agent-safe warning | Package-manager installs are network-dependent but often acceptable in readiness workflows. Ota may need a narrower network policy or effect type, such as dependency fetch, instead of permanent warning noise. | Yes |
| Container runtime proof misclassifies ephemeral cleanup | Runtime proof correctness | `ota proof runtime --workflow app:container --container` observed `/` and `/api/health` returning 200, then reported failure after the ephemeral container was killed with exit 137 | Ota should not treat its own post-readiness cleanup as an app crash. Until fixed, the GitHub matrix proves container execution with `ota run --container verify` rather than hard-failing on this false negative. | Yes |

## Local Evidence

- `ota validate --json` currently succeeds with one advisory: `install` is agent-safe and network-dependent.
- `ota up --workflow app --dry-run --json` correctly blocks on this local host because Node is 23.11.0 and the contract requires Node `^22.13.0`.
- `ota run verify --dry-run --json` correctly blocks on this local host for the same Node version reason.
- With PATH pinned to Node 22.22.3, `ota up --workflow app --dry-run --json` and `ota run verify --dry-run --json` are runnable.
- `ota up --workflow docker --dry-run --json` is runnable locally without requiring host Node.
- `ota doctor --workflow app --json` before startup is bounded and correctly reports the app/health surface as not ready.
- `ota run typecheck` and `ota run build` pass locally on Node 23, but the contract correctly requires Node 22 for clean engine compatibility.
- `ota run --native verify` passes locally when the PATH is pinned to Node 22.22.3.
- `ota run --container verify` passes locally on `node:22-alpine`.
- `ota proof runtime --workflow app:container --container` reached live HTTP readiness, then failed due to the Ota lifecycle issue above.
