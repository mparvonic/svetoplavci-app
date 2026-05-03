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
];

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

    if (missing.length > 0) {
      console.error("[db:check:schema] Missing required DB columns:");
      for (const key of missing) console.error(`- ${key}`);
      process.exit(1);
    }

    console.log("[db:check:schema] OK - required columns are present.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[db:check:schema] Failed:", error);
  process.exit(1);
});
