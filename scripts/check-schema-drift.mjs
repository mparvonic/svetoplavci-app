#!/usr/bin/env node

import { Client } from "pg";

const connectionString = process.env.POSTGRES_PRISMA_URL;
if (!connectionString) {
  console.error("[db:check:schema] POSTGRES_PRISMA_URL is not set.");
  process.exit(1);
}

const REQUIRED_COLUMNS = [
  {
    table: "app_school_event",
    columns: [
      "kiosk_display_number",
      "kiosk_display_color",
      "visibility",
      "lifecycle_status",
      "time_override_lock",
      "published_at",
      "registration_closed_at",
    ],
  },
  {
    table: "app_school_event_offer_group",
    columns: ["selection_mode", "max_selections_per_person", "allow_no_selection"],
  },
  {
    table: "app_person",
    columns: ["nickname", "chip_uid", "chip_hid", "first_name"],
  },
  {
    table: "app_m01_svp_version",
    columns: [
      "label",
      "status",
      "based_on_rvp_version_id",
      "parent_svp_version_id",
      "effective_from",
      "effective_to",
      "is_current",
    ],
  },
  {
    table: "app_m01_lodicka",
    columns: [
      "svp_version_id",
      "predmet_id",
      "podpredmet_id",
      "oblast_id",
      "kod",
      "nazev",
      "popis",
      "typ",
      "rocnik_od",
      "rocnik_do",
      "stupen",
      "garant_person_id",
      "is_deleted",
    ],
  },
  {
    table: "app_m01_osobni_sada_lodicek",
    columns: ["person_id", "svp_version_id", "stupen", "status", "activated_at", "archived_at"],
  },
  {
    table: "app_m01_osobni_lodicka",
    columns: [
      "osobni_sada_id",
      "lodicka_id",
      "kod_osobni_lodicky",
      "current_stupen",
      "current_stav_label",
      "current_hodnota",
      "datum_stavu",
      "last_event_id",
      "is_deleted",
    ],
  },
  {
    table: "app_m01_osobni_lodicka_event",
    columns: [
      "osobni_lodicka_id",
      "stupen",
      "stav_label",
      "hodnota",
      "datum_stavu",
      "changed_by_person_id",
      "source",
      "source_row_id",
      "is_invalidated",
      "invalidated_at",
      "invalidated_reason",
      "invalidated_by_event_id",
      "source_created_at",
      "source_modified_at",
    ],
  },
  {
    table: "app_m01_rvp_version",
    columns: ["source_url", "source_format", "dataset_version", "is_active"],
  },
  {
    table: "app_m01_rvp_ovu",
    columns: ["rvp_version_id", "uzlovy_bod_id", "kod", "zneni", "hodnoty"],
  },
  {
    table: "app_school_period",
    columns: [
      "school_year_id",
      "kind",
      "code",
      "name",
      "period_order",
      "start_date",
      "end_date",
      "is_active",
      "metadata",
    ],
  },
];

const REQUIRED_CONSTRAINTS = new Map([
  [
    "app_school_period",
    [
      "app_school_period_date_check",
      "app_school_period_no_overlap",
      "app_school_period_order_check",
      "app_school_period_school_year_id_fkey",
    ],
  ],
]);

const REQUIRED_INDEXES = new Map([
  [
    "app_m01_osobni_lodicka_event",
    ["app_m01_osobni_lodicka_event_latest_lookup_idx"],
  ],
  [
    "app_school_period",
    [
      "app_school_period_school_year_code_key",
      "app_school_period_school_year_kind_idx",
      "app_school_period_school_year_order_key",
      "app_school_period_school_year_range_idx",
    ],
  ],
]);

const REQUIRED_ENUMS = new Map([
  ["M01SvpZmenaType", ["PATCH", "MINOR", "MAJOR"]],
  ["M01SvpVersionStatus", ["DRAFT", "APPROVED", "ACTIVE", "ARCHIVED"]],
  ["M01LodickaTyp", ["INDIVIDUALNI", "HROMADNA"]],
  ["M01Stupen", ["I_STUPEN", "II_STUPEN"]],
  ["M01OsobniSadaStatus", ["ACTIVE", "ARCHIVED"]],
  ["M01MigraceRuleTyp", ["AUTO_1_1", "AUTO_N_1", "AUTO_1_N", "MANUAL", "NOVA"]],
  ["M01MigracePlanStatus", ["DRAFT", "APPROVED", "SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "CANCELED"]],
  ["M01MigraceRunStatus", ["RUNNING", "COMPLETED", "FAILED", "CANCELED"]],
]);

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const rows = await client.query(
      `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      `,
      [REQUIRED_COLUMNS.map((item) => item.table)],
    );

    const byTable = new Map();
    for (const row of rows.rows) {
      const table = String(row.table_name);
      const column = String(row.column_name);
      if (!byTable.has(table)) byTable.set(table, new Set());
      byTable.get(table).add(column);
    }

    const missing = [];
    for (const item of REQUIRED_COLUMNS) {
      const present = byTable.get(item.table) ?? new Set();
      for (const column of item.columns) {
        if (!present.has(column)) {
          missing.push(`${item.table}.${column}`);
        }
      }
    }

    const constraintRows = await client.query(
      `
      SELECT c.conname, t.relname AS table_name
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = ANY($1::text[])
      `,
      [[...REQUIRED_CONSTRAINTS.keys()]],
    );

    const constraintsByTable = new Map();
    for (const row of constraintRows.rows) {
      const table = String(row.table_name);
      const constraint = String(row.conname);
      if (!constraintsByTable.has(table)) constraintsByTable.set(table, new Set());
      constraintsByTable.get(table).add(constraint);
    }

    for (const [table, constraints] of REQUIRED_CONSTRAINTS.entries()) {
      const present = constraintsByTable.get(table) ?? new Set();
      for (const constraint of constraints) {
        if (!present.has(constraint)) missing.push(`constraint ${table}.${constraint}`);
      }
    }

    const indexRows = await client.query(
      `
      SELECT tablename AS table_name, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
      `,
      [[...REQUIRED_INDEXES.keys()]],
    );

    const indexesByTable = new Map();
    for (const row of indexRows.rows) {
      const table = String(row.table_name);
      const index = String(row.indexname);
      if (!indexesByTable.has(table)) indexesByTable.set(table, new Set());
      indexesByTable.get(table).add(index);
    }

    for (const [table, indexes] of REQUIRED_INDEXES.entries()) {
      const present = indexesByTable.get(table) ?? new Set();
      for (const index of indexes) {
        if (!present.has(index)) missing.push(`index ${table}.${index}`);
      }
    }

    const enumRows = await client.query(
      `
      SELECT t.typname AS enum_name, e.enumlabel AS enum_value
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = ANY($1::text[])
      `,
      [[...REQUIRED_ENUMS.keys()]],
    );

    const enumValuesByName = new Map();
    for (const row of enumRows.rows) {
      const enumName = String(row.enum_name);
      const enumValue = String(row.enum_value);
      if (!enumValuesByName.has(enumName)) enumValuesByName.set(enumName, new Set());
      enumValuesByName.get(enumName).add(enumValue);
    }

    for (const [enumName, enumValues] of REQUIRED_ENUMS.entries()) {
      const presentValues = enumValuesByName.get(enumName) ?? new Set();
      if (presentValues.size === 0) {
        missing.push(`enum ${enumName}`);
        continue;
      }
      for (const enumValue of enumValues) {
        if (!presentValues.has(enumValue)) {
          missing.push(`enum ${enumName}.${enumValue}`);
        }
      }
    }

    if (missing.length > 0) {
      console.error("[db:check:schema] Missing required DB schema items:");
      for (const key of missing) console.error(`- ${key}`);
      process.exit(1);
    }

    console.log("[db:check:schema] OK - required schema items are present.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[db:check:schema] Failed:", error);
  process.exit(1);
});
