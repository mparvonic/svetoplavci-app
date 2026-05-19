import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

import { getApiSessionContext } from "@/src/lib/api/session";
import { getPortalChildLodickyForActor, type PortalChild, type PortalLodickaRow } from "@/src/lib/portal-db";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const PROTO_ROLE_TO_SESSION_ROLES: Record<string, Set<string>> = {
  rodic: new Set(["rodic"]),
  zak: new Set(["zak"]),
  garant: new Set(["garant", "pruvodce", "zamestnanec", "admin", "proto"]),
  spravce: new Set(["admin", "zamestnanec", "proto"]),
};

const PYTHON_CANDIDATES = [
  "/srv/apps/python-pdf/bin/python3",
  "/usr/bin/python3",
  "python3",
];

function getEffectiveRoles(sessionRoles: string[], requestedRole: string): string[] | null {
  const normalized = requestedRole.trim().toLowerCase();
  if (!normalized) return sessionRoles;
  const allowedRoles = PROTO_ROLE_TO_SESSION_ROLES[normalized];
  if (!allowedRoles) return sessionRoles;
  const filtered = sessionRoles.filter((role) => allowedRoles.has(role));
  return filtered.length > 0 ? filtered : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ childId: string }> },
) {
  const context = await getApiSessionContext(req);
  if (!context) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  const { childId } = await params;
  if (!childId) {
    return NextResponse.json({ error: "Chybí childId" }, { status: 400 });
  }

  const url = new URL(req.url);
  const role = (url.searchParams.get("role") ?? "").trim().toLowerCase();
  const scope = (url.searchParams.get("scope") ?? "").trim().toLowerCase();
  const garantId = (url.searchParams.get("garantId") ?? "").trim();
  const viewDate = (url.searchParams.get("viewDate") ?? "").trim();
  const effectiveRoles = getEffectiveRoles(context.roles, role);
  if (!effectiveRoles) {
    return NextResponse.json({ error: "Přístup zamítnut pro zvolený pohled." }, { status: 403 });
  }
  const garantFilter = (role === "garant" || role === "spravce") && scope === "moje" && garantId ? garantId : null;

  try {
    const result = await getPortalChildLodickyForActor(
      {
        email: context.email,
        personIds: context.personIds,
        roles: effectiveRoles,
      },
      childId,
      { includeHistory: true, garantPersonId: garantFilter },
    );

    if (!result) {
      return NextResponse.json({ error: "Toto dítě vám není přiřazeno." }, { status: 403 });
    }

    const pdf = await renderDevelopmentMapPdf(result.child, result.lodicky, viewDate);
    const filename = buildDownloadFilename(result.child.displayName ?? result.child.name);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/m01/child/[childId]/rozvojova-mapa/pdf]", error);
    return NextResponse.json({ error: "Nepodařilo se vytvořit PDF mapy rozvoje." }, { status: 500 });
  }
}

async function renderDevelopmentMapPdf(child: PortalChild, rows: PortalLodickaRow[], viewDate: string): Promise<Buffer> {
  const stage = resolveStage(child, rows);
  const assetsDir = path.join(process.cwd(), "assets", "m01-development-map");
  const templatePath =
    stage === "II_STUPEN"
      ? firstExistingPath([
          path.join(assetsDir, "templates", "mapy_lodicky_II.original.pdf"),
          path.join(assetsDir, "templates", "mapy_lodicky_II.pdf"),
        ])
      : firstExistingPath([path.join(assetsDir, "templates", "mapy_lodicky_I.pdf")]);
  const geometryPath = path.join(assetsDir, stage === "II_STUPEN" ? "stage2.json" : "stage1.json");
  const scriptPath = path.join(process.cwd(), "scripts", "render-development-map-pdf.py");
  const pythonPath = firstExistingPath(PYTHON_CANDIDATES) ?? "python3";
  if (!templatePath || !fs.existsSync(geometryPath) || !fs.existsSync(scriptPath)) {
    throw new Error(`Missing development map PDF asset for ${stage}.`);
  }
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "development-map-"));
  const payloadPath = path.join(tempDir, "payload.json");
  const outputPath = path.join(tempDir, "mapa-rozvoje.pdf");

  try {
    await fs.promises.writeFile(
      payloadPath,
      JSON.stringify({
        childName: child.displayName ?? child.name,
        geometryPath,
        outputPath,
        rows: rows.map((row) => ({
          kodLodicky: row.kodLodicky,
          predmet: row.predmet,
          podpredmet: row.podpredmet ?? "",
          oblast: row.oblast,
          nazevLodicky: row.nazevLodicky,
          jeVMape: row.jeVMape !== false,
          status: normalizeStatusValue(row, viewDate),
        })),
        maxOutputBytes: stage === "II_STUPEN" ? 3_000_000 : null,
        stage,
        templatePath,
      }),
      "utf8",
    );
    await execFileAsync(pythonPath, [scriptPath, payloadPath], {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
      timeout: 120_000,
    });
    return await fs.promises.readFile(outputPath);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

function resolveStage(child: PortalChild, rows: PortalLodickaRow[]): "I_STUPEN" | "II_STUPEN" {
  if (child.stupen === 2) return "II_STUPEN";
  if (child.stupen === 1) return "I_STUPEN";
  return rows.some((row) => row.stupen === "II_STUPEN") ? "II_STUPEN" : "I_STUPEN";
}

function firstExistingPath(candidates: string[]): string | null {
  return candidates.find((candidate) => candidate === "python3" || fs.existsSync(candidate)) ?? null;
}

function normalizeStatusValue(row: PortalLodickaRow, viewDate = ""): number {
  const history = Array.isArray(row.history) ? row.history : [];
  const selectedHistory =
    viewDate && /^\d{4}-\d{2}-\d{2}$/.test(viewDate)
      ? history
          .filter((item) => (item.datumStavu ?? "") <= viewDate)
          .sort((a, b) => {
            const dateCompare = (a.datumStavu ?? "").localeCompare(b.datumStavu ?? "");
            if (dateCompare !== 0) return dateCompare;
            return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
          })
          .at(-1)
      : null;

  const hodnota = selectedHistory?.hodnota ?? row.hodnota;
  const stav = selectedHistory?.stav ?? row.stav;

  if (typeof hodnota === "number" && Number.isFinite(hodnota)) {
    return Math.max(0, Math.min(4, Math.round(hodnota)));
  }
  const label = stav.toLowerCase();
  if (label.includes("samostat") || label.includes("hotovo") || label.includes("dokon")) return 4;
  if (label.includes("částe") || label.includes("caste") || label.includes("pokro") || label.includes("rozvin")) return 3;
  if (label.includes("dopom") || label.includes("prac")) return 2;
  if (label.includes("zah")) return 1;
  return 0;
}

function buildDownloadFilename(childName: string) {
  const surname = extractSurname(childName);
  return `mapa_rozvoje_${slugifyFilenamePart(surname)}_${formatPragueDateStamp(new Date())}.pdf`;
}

function extractSurname(childName: string) {
  const parts = childName.trim().split(/\s+/).filter(Boolean);
  return parts.at(-1) ?? "dite";
}

function formatPragueDateStamp(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Prague",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

function slugifyFilenamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "dite";
}
