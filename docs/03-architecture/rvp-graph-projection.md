# RVP graph projection

## Purpose

Build a deterministic graph projection from official RVP open data without creating a second source of truth for OVU.

The operational OVU catalog stays in the existing M01 tables:

- `M01RvpVersion`
- `M01RvpUzlovyBod`
- `M01RvpOvu`
- `M01LodickaOvuLink`

The graph projection is a derived layer for version diffing, visualisation, and future semantic search.

## Baseline

The current baseline is RVP `2025-06-24` from `full_mp` JSON:

- NKOD dataset: `https://data.gov.cz/datová-sada?iri=https%3A%2F%2Fdata.gov.cz%2Fzdroj%2Fdatové-sady%2F45768455%2F1562413075`
- JSON distribution: `https://opendata.npi.cz/download/rvp/data_final_rvp_zv_full_mp_20250624.json`
- SHA-256: `084296c87704aff64132eadc35e14b9ce070167b67d3fee79ecb46939957d1c8`

The next known dataset, `2025-08-21`, should be used as a test fixture for diff behaviour, not as a replacement of the baseline.

## Source shape

The `full_mp` JSON has five top-level branches:

- `obecneCasti`
- `zakladniGramotnosti`
- `klicoveKompetence`
- `prurezovaTemata`
- `vzdelavaciOblasti`

OVU are spread across four of them, not only across `vzdelavaciOblasti`.

The 2025-06-24 source contains:

- `475` OVU
- `327` uzlové body
- `109` `ZV3` uzlové body
- `109` `ZV5` uzlové body
- `109` `ZV9` uzlové body

Because uzlový bod codes are intentionally repeated, `sourcePath` is the stable identifier for uzlové body. OVU are identified by `kod`.

## Normalized artifacts

Run:

```bash
npm run rvp:normalize -- --version 2025-06-24
npm run rvp:normalize -- --version 2025-08-21
```

By default the script writes ignored artifacts under `.tmp/rvp-normalized/<version>`:

- `manifest.json` - source metadata, hash, validation counts, output summary
- `entities.jsonl` - one graph node per line
- `edges.jsonl` - one graph edge per line
- `ovu.jsonl` - compact OVU catalog for review and search
- `raw/source.json` - original source JSON

Pass `--out <dir>` to write artifacts somewhere else for review or commit.

Compare two normalized versions with JSON output:

```bash
npm run rvp:diff -- --from .tmp/rvp-normalized/2025-06-24 --to .tmp/rvp-normalized/2025-08-21
```

Or write a human-readable Markdown report:

```bash
npm run rvp:diff -- --from .tmp/rvp-normalized/2025-06-24 --to .tmp/rvp-normalized/2025-08-21 --format markdown --out .tmp/rvp-normalized/diff-2025-06-24--2025-08-21.md
```

## Entity identity

The projection uses these stable keys:

- OVU: `rvp:ovu:<kod>`
- uzlový bod: `rvp:uzlovyBod:<sourcePath>`
- structural RVP containers: `rvp:<entityType>:<sourcePath>`
- methodical support levels: `rvp:metodickaUroven:<sourcePath>`
- illustrations: `rvp:ilustrace:<sourcePath>`
- RVP values: `rvp:hodnota:<value>`

For OVU, normalized nodes include `sourceTable=app_m01_rvp_ovu` and `sourceLookup.kod`, so they can be matched back to the existing M01 table without duplication. Uzlové body include `sourceTable=app_m01_rvp_uzlovy_bod` plus `graphSourcePath`, `kod`, and `nazev`; before DB backfill we should reconcile this path with the existing importer source-path format.

## Edge types

The first projection emits these edge types:

- `contains` - RVP hierarchy
- `ovu_precedes` - previous OVU relation
- `ovu_related` - related OVU relation
- `ovu_follows` - following OVU relation
- `has_method_level` - OVU to methodical support level
- `has_illustration` - methodical support level to illustration
- `has_value` - OVU to RVP value

Some `ovu_precedes` and `ovu_follows` targets point outside the ZV dataset, for example to `PV1` codes. Those edges are retained with `targetExists=false` and an `external:ovu:<kod>` target key.

## Diff strategy

Version diffs should compare normalized artifacts, not raw JSON files:

1. Compare `entities.jsonl` by `stableKey`.
2. Compare `edges.jsonl` by `stableKey`.
3. Classify added, removed, and changed entities through `contentHash` and `structureHash`.
4. Classify changed relationships through edge additions/removals.
5. Project OVU changes to lodičky through existing `M01LodickaOvuLink`.

Raw JSON remains useful as an audit snapshot, but JSONL artifacts are the human-reviewable and machine-diffable format.


## DB projection

When the normalized artifacts are accepted, they can be backfilled into derived graph tables:

- `app_m01_rvp_graph_node`
- `app_m01_rvp_graph_edge`

These tables are not a second OVU catalog. They are a rebuildable projection for API/UI queries. The source of truth remains `M01RvpVersion`, `M01RvpOvu`, `M01RvpUzlovyBod`, and `M01LodickaOvuLink`.

Apply the `20260514160000_m01_rvp_graph_projection` migration before running the backfill. On GX10, DB/runtime variables live in `/data/projects/svetoplavci-app/secrets/env.local`; the `npm run rvp:graph:backfill` script sources that file automatically when repo `.env.local` is absent.

Run a dry run first:

```bash
npm run rvp:graph:backfill -- --input .tmp/rvp-normalized/2025-06-24 --dry-run
```

Then rebuild the projection for an existing RVP version:

```bash
npm run rvp:graph:backfill -- --input .tmp/rvp-normalized/2025-06-24 --replace
```

The target `M01RvpVersion` must already exist. The backfill does not create a new RVP version and does not import a new `M01RvpOvu` catalog. OVU graph nodes resolve `source_id` by `M01RvpOvu.kod` inside the matching RVP version.


## Read API and management view

The first read slice over the persisted graph is available in two places:

- `GET /api/m01/rvp/graph?svp=<svpVersionId>&q=<query>&limit=<n>` returns the selected SVP/RVP context, graph counts, confirmed lodička-to-OVU links, OVU graph context rows, and edge-type counts.
- `/portal/lodicky/sprava/vazby` renders the same data for managers as an interactive force-directed graph using `react-force-graph-2d`: lodičky -> confirmed OVU -> RVP context, plus heatmap coverage and a placeholder semantic layer.

The API and page intentionally expose only confirmed links from `M01LodickaOvuLink`. Future AI-assisted matches should be introduced as suggestions in a separate table and displayed as a secondary layer.

## Lodička relationship visualisation and suggestions

The application should distinguish three relationship layers:

- Confirmed relationships live in `M01LodickaOvuLink`. They are curated by lodička managers and remain the operational truth.
- RVP graph context comes from `M01RvpGraphNode` and `M01RvpGraphEdge`. It explains vertical and horizontal surroundings of an OVU, but it is still a derived projection of official RVP data.
- Suggested relationships belong to M08 AI knowledge base. They are AI-assisted candidates for human review, never automatic replacements for confirmed links.

The suggested workflow:

1. Build M08 knowledge items for OVU and lodičky from the M01 source tables and RVP graph projection.
2. Enrich OVU items with full vertical paths, horizontal graph neighbors, grade/stage context, and RVP version.
3. Enrich lodička items with title, description, subject/area, grade/stage context, SVP version, and confirmed OVU links.
4. Sync chunks into the rebuildable Qdrant collection `svetoplavci_m01_rvp_lodicky_v1`.
5. Use vector search plus structured filters to shortlist candidate OVU for each lodička.
6. Ask an LLM to judge only the shortlisted candidates and return a short reason, confidence, and relationship type.
7. Show confirmed links, RVP graph context, and suggested links separately in the UI.
8. Let a manager accept, reject, or ignore each suggestion.

This follows the AI stack knowledge-base pattern: PostgreSQL remains the source of truth and audit store; Qdrant is an external rebuildable vector index, not a second catalog. The detailed M08 design is documented in `docs/04-modules/M08-ai-vrstva/README.md`.

A future suggestion model should include at least:

- RVP version id
- SVP version id
- lodička id
- OVU id / graph node id
- retrieval/index model version
- score and contributing signals
- LLM reason
- suggestion status (`pending`, `accepted`, `rejected`, `ignored`)
- reviewer and review timestamp

Graph UI should render confirmed relationships as primary/solid links and suggestions as secondary/dashed links with score and reason available in detail. Accepting a suggestion should create or update `M01LodickaOvuLink`; rejecting it should only update the suggestion state.
