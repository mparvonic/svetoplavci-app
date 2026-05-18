-- M01 RVP graph projection: derived nodes/edges for diffing, visualization, and semantic search.
-- The operational OVU catalog remains app_m01_rvp_ovu.

CREATE TABLE "app_m01_rvp_graph_node" (
    "id" TEXT NOT NULL,
    "rvp_version_id" TEXT NOT NULL,
    "stable_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "source_path" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT,
    "body_text" TEXT,
    "source_table" TEXT,
    "source_id" TEXT,
    "source_lookup" JSONB,
    "metadata" JSONB,
    "structured_payload" JSONB,
    "content_hash" TEXT,
    "structure_hash" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_m01_rvp_graph_node_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app_m01_rvp_graph_edge" (
    "id" TEXT NOT NULL,
    "rvp_version_id" TEXT NOT NULL,
    "stable_key" TEXT NOT NULL,
    "edge_type" TEXT NOT NULL,
    "from_node_id" TEXT,
    "to_node_id" TEXT,
    "from_stable_key" TEXT NOT NULL,
    "to_stable_key" TEXT NOT NULL,
    "target_code" TEXT,
    "target_exists" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_m01_rvp_graph_edge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_m01_rvp_graph_node_version_stable_key" ON "app_m01_rvp_graph_node"("rvp_version_id", "stable_key");
CREATE INDEX "app_m01_rvp_graph_node_version_type_idx" ON "app_m01_rvp_graph_node"("rvp_version_id", "entity_type");
CREATE INDEX "app_m01_rvp_graph_node_version_code_idx" ON "app_m01_rvp_graph_node"("rvp_version_id", "code");
CREATE INDEX "app_m01_rvp_graph_node_source_idx" ON "app_m01_rvp_graph_node"("source_table", "source_id");

CREATE UNIQUE INDEX "app_m01_rvp_graph_edge_version_stable_key" ON "app_m01_rvp_graph_edge"("rvp_version_id", "stable_key");
CREATE INDEX "app_m01_rvp_graph_edge_version_type_idx" ON "app_m01_rvp_graph_edge"("rvp_version_id", "edge_type");
CREATE INDEX "app_m01_rvp_graph_edge_from_node_idx" ON "app_m01_rvp_graph_edge"("from_node_id");
CREATE INDEX "app_m01_rvp_graph_edge_to_node_idx" ON "app_m01_rvp_graph_edge"("to_node_id");
CREATE INDEX "app_m01_rvp_graph_edge_from_stable_idx" ON "app_m01_rvp_graph_edge"("rvp_version_id", "from_stable_key");
CREATE INDEX "app_m01_rvp_graph_edge_to_stable_idx" ON "app_m01_rvp_graph_edge"("rvp_version_id", "to_stable_key");

ALTER TABLE "app_m01_rvp_graph_node"
  ADD CONSTRAINT "app_m01_rvp_graph_node_rvp_version_id_fkey"
  FOREIGN KEY ("rvp_version_id") REFERENCES "app_m01_rvp_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_m01_rvp_graph_edge"
  ADD CONSTRAINT "app_m01_rvp_graph_edge_rvp_version_id_fkey"
  FOREIGN KEY ("rvp_version_id") REFERENCES "app_m01_rvp_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_m01_rvp_graph_edge"
  ADD CONSTRAINT "app_m01_rvp_graph_edge_from_node_id_fkey"
  FOREIGN KEY ("from_node_id") REFERENCES "app_m01_rvp_graph_node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_m01_rvp_graph_edge"
  ADD CONSTRAINT "app_m01_rvp_graph_edge_to_node_id_fkey"
  FOREIGN KEY ("to_node_id") REFERENCES "app_m01_rvp_graph_node"("id") ON DELETE SET NULL ON UPDATE CASCADE;
