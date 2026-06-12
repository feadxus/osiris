# OSIRIS → Open-Source Palantir
### Architecture & Conversion Roadmap

> Turning the OSIRIS intelligence dashboard into a self-hosted, open-source equivalent of Palantir's **Foundry + Gotham + Apollo** stack, specialised for **unstructured data**.

---

## 1. Vision

OSIRIS today is an excellent geospatial intelligence *dashboard*: ~24k lines of Next.js 16 / React 19, 85+ keyless OSINT feeds, a MapLibre WebGL map, a DeepSeek AI engine, the CLAUSED ingestion pipeline, a 9-domain personal ontology with a force-directed graph, a correlation engine, and the Polybolos/Lattice SDK.

The goal is to evolve it from a *dashboard that displays data* into a *platform that integrates, governs, reasons over, and acts on data* — the thing Palantir actually sells.

The defining constraint we must fix first: **OSIRIS currently has no durable persistence.** Entities, pins, workspaces and the ontology all live in `localStorage` and flat files. Everything in this roadmap depends on replacing that with a real backbone.

---

## 2. The Palantir mapping

You named **Gotham** and **Apollo**, but the enabling layer is **Foundry** — the data backbone neither can exist without.

| Palantir layer | What it is | OSIRIS today | What we build |
|---|---|---|---|
| **Foundry** | Pipelines, datasets, durable ontology store | localStorage + flat files | Postgres (relational + `pgvector` + Apache AGE), MinIO, Meilisearch, a transform/pipeline engine |
| **Gotham** | Investigation & analysis *on* the ontology | force-graph + correlation engine + Gotham C2 panel | Declarative ontology engine, graph analytics, Cases, hybrid (semantic + graph + full-text) search |
| **Apollo** | Continuous, constraint-based delivery & orchestration | Polybolos SDK + Docker Compose + your Paperclip agents | Temporal workflows + Open Policy Agent + GitOps to deploy/manage connectors, agents, models, instances |

**The unstructured-data thesis:** ingest *anything* → store the raw blob → extract text (PDF parse / OCR / Whisper ASR) → chunk → embed → extract entities & relations (NER + LLM) → resolve against existing objects → write to the graph + vector index → query by *meaning* and by *link*. Foundry + Gotham own this loop; Apollo keeps the machinery that runs it healthy.

---

## 3. Target architecture

```
┌───────────────────────────────────────────────────────────────────┐
│  GOTHAM  (analysis)        Next.js UI: map · graph · timeline ·     │
│                            cases · hybrid search · C2 dashboard     │
├───────────────────────────────────────────────────────────────────┤
│  ONTOLOGY ENGINE   object/link/action types defined in YAML         │
│                    (declarative — add types without code)           │
├───────────────────────────────────────────────────────────────────┤
│  FOUNDRY  (backbone)                                                │
│   Postgres 16 ─ relational objects/links  + pgvector (semantic)     │
│              └─ Apache AGE (graph traversal & algorithms)           │
│   MinIO ─ raw blobs    Meilisearch ─ full-text    Redis ─ queue     │
│   Yente ─ self-hosted OpenSanctions                                 │
├───────────────────────────────────────────────────────────────────┤
│  UNSTRUCTURED PIPELINE  (Phase 2, durable workflows)                │
│   ingest → blob → extract (pdf/Tesseract/Whisper) → chunk →         │
│   embed (Ollama) → NER+LLM → resolve → write graph+vectors          │
├───────────────────────────────────────────────────────────────────┤
│  APOLLO  (orchestration)   Temporal + OPA policy + GitOps           │
│   manages: connectors · AI agents (Paperclip) · models · instances  │
└───────────────────────────────────────────────────────────────────┘
```

---

## 4. Recommended open-source stack

Every choice is keyless and self-hostable (fits your Jetson / Pi / Epyc setup):

| Need | Choice | Why |
|---|---|---|
| Relational store | **PostgreSQL 16** | One spine for everything |
| Semantic vectors | **pgvector** | No separate vector DB to operate |
| Graph + algorithms | **Apache AGE** | openCypher *inside* Postgres |
| Raw blobs | **MinIO** | S3-compatible, self-hosted |
| Full-text | **Meilisearch** | Fast, typo-tolerant, tiny |
| Queue / cache | **Redis** | Pairs with BullMQ in Node |
| Embeddings | **Ollama** (`nomic-embed-text`) | You already run Ollama — keyless, local |
| ASR (audio) | **Whisper** | You already run it in Home Assistant |
| OCR | **Tesseract** | Already in CLAUSED |
| Sanctions | **Yente** | Already in your plan; zero rate limits |
| Workflows (Apollo) | **Temporal** | Durable, retryable pipelines & rollouts |
| Policy (Apollo) | **Open Policy Agent** | Constraints as code |
| Deploy (Apollo) | **Argo CD** (GitOps) | Continuous delivery, the literal Apollo idea |

> If you ever want heavier graph algorithms out of the box, swap AGE for Neo4j Community — but AGE keeps you to one database, which is the leaner path.

---

## 5. What ships in this package (Phase 0 files)

```
osiris-foundation/
├── docker-compose.foundation.yml   # Postgres+AGE+pgvector, MinIO, Meilisearch, Redis, Yente
├── .env.example
├── db/
│   ├── Dockerfile                  # builds Apache AGE on the pgvector image
│   └── init/
│       ├── 00_extensions.sql       # pgvector, AGE, pg_trgm, pgcrypto
│       ├── 10_ontology_schema.sql  # entities, relationships, chunks, cases, sources, audit
│       ├── 20_graph.sql            # AGE graph 'osiris_graph'
│       └── 30_indexes.sql          # HNSW vector, trgm fuzzy, JSONB, geo
└── ontology/
    ├── _meta.yaml                  # the declarative format
    ├── object-types.yaml           # 14 object types (your 9 domains + Polybolos)
    └── link-types.yaml             # link types + governed write-back actions
```

**Bring it up:**
```bash
cd osiris-foundation
cp .env.example .env        # edit the passwords
docker compose -f docker-compose.foundation.yml up -d --build
```

The DB image build compiles Apache AGE (a one-time ~3–5 min step). After boot, `osiris` database has the `vector`, `age`, `pg_trgm` extensions, the full `ontology` schema, the `osiris_graph` graph, and all search indexes.

---

## 6. Phased roadmap

### Phase 0 — Foundation *(this package, 1–2 wks)*
Stand up the backbone. No user-facing change yet — you're laying the floor.
- [x] Postgres + pgvector + AGE, MinIO, Meilisearch, Redis, Yente
- [x] Relational ontology schema + AGE graph + indexes
- [x] Declarative ontology YAML
- [ ] Thin data-access layer `src/lib/store/` (pg client, MinIO client, Meili client)
- [ ] Migrate `intel-pins`, `workspaces`, ontology off `localStorage` → Postgres

### Phase 1 — Foundry / ontology engine *(2–4 wks)*
- [ ] YAML loader → upserts `object_types` / `link_types` on boot
- [ ] Generic `/api/ontology` CRUD driven by the type registry
- [ ] On every entity/relationship write, mirror a node/edge into `osiris_graph`
- [ ] MinIO wiring for blob storage + `ingest_sources` provenance rows

### Phase 2 — Unstructured pipeline *(2–4 wks)*
- [ ] Refactor CLAUSED into a Temporal (or BullMQ) workflow with discrete stages
- [ ] Whisper for audio, keep Tesseract/pdf-parse; chunk + Ollama embeddings → `chunks`
- [ ] LLM relation extraction → entities + relationships with `source_id` lineage
- [ ] Entity resolution: fuzzy match (trgm) + embedding similarity → `same_as` merge

### Phase 3 — Gotham analysis *(3–4 wks)*
- [ ] `EntityGraphPanel` queries real graph: expand / shortest-path / neighborhood
- [ ] Graph algorithms: centrality, community detection (Louvain/Leiden)
- [ ] **Investigations/Cases** primitive (saved entity sets + notes + timeline)
- [ ] **Hybrid search**: fuse Meili full-text + pgvector semantic + AGE graph neighbors
- [ ] Generalise correlation engine from 7 hardcoded rules → user-defined rules over the ontology

### Phase 4 — Apollo orchestration *(3–5 wks)*
- [ ] Temporal + OPA stood up
- [ ] Model connectors / agents / deployments as managed products with environments
- [ ] Connect your **Paperclip** agents as Apollo-managed workers
- [ ] GitOps (Argo CD): a config change rolls out continuously under policy
- [ ] Encode your Atlantide authority boundaries as OPA policy (internal autonomy; live deploys need approval)

---

## 7. Governance (build this *alongside* features, not after)

A real Palantir clone is a serious surveillance capability. The credibility — and the ethics — live in the governance layer:

- **Immutable audit log** (`ontology.audit_log`) — every read/write/action, never updated or deleted.
- **Data lineage** — every entity carries `source_id`; you can always answer "where did this claim come from?"
- **Access control** — role-gated actions (viewer / analyst / admin), extending your existing `auth.ts`.
- **PII handling** — fields flagged `pii` in the YAML are masked by default and audited on read.

Keep this ahead of the collection features. It's what makes the platform usable for legitimate clients (Atlantide's tender work included) rather than a liability.

---

## 8. Quick decision notes

- **One database vs many:** we deliberately keep relational + vector + graph in a single Postgres to cut operational load. Split out only when scale forces it.
- **Relational is canonical; the graph is a mirror.** Property/full-text queries hit Postgres tables; traversal/algorithms hit AGE. The app keeps them in sync on write.
- **Embeddings dimension is 768** (`nomic-embed-text`). If you move to `bge-m3`, change `vector(768)` → `vector(1024)` in `10_ontology_schema.sql` before first boot.

---

*Generated as the Phase 0 starting point. Next concrete step: bring up the stack, then build the `src/lib/store/` data-access layer and the YAML loader (Phase 1).*
