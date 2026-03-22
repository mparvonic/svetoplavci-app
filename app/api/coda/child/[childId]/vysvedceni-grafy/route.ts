import { auth } from "@/src/lib/auth";
import { findParentByEmail, getChildrenOfParent, getChildTableData, getCurveData } from "@/src/lib/mirror-db";
import type { CodaRow } from "@/src/lib/coda";
import { NextResponse } from "next/server";

export const maxDuration = 120;

const TABLE_HODNOCENI_PREDMETU = process.env.CODA_TABLE_HODNOCENI_PREDMETU ?? "table-oCLreazO22";
const TABLE_HODNOCENI_OBLASTI = process.env.CODA_TABLE_HODNOCENI_OBLASTI ?? "table-NbDPhMF4ci";
const CURVE_POLOLETI_HIGHLIGHT = "1. pololetí";

function getVal(row: CodaRow, ...keys: string[]): string | unknown {
  const v = row.values as Record<string, unknown>;
  for (const k of keys) {
    const val = v[k];
    if (val != null && val !== "") return val;
  }
  return "";
}

function toNum(x: unknown, def: number): number {
  if (x == null) return def;
  if (typeof x === "number") return Number.isFinite(x) ? x : def;
  const s = String(x).replace(/\u00a0/g, "").replace(/\s/g, "").replace(/%/g, "").replace(/,/g, ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : def;
}

/**
 * GET /api/coda/child/[childId]/vysvedceni-grafy
 * Vrátí curve + report pro záložku „Vysvědčení – grafy“ (Plotly).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
    }

    const { childId } = await params;
    if (!childId) {
      return NextResponse.json({ error: "Chybí childId" }, { status: 400 });
    }

    const parent = await findParentByEmail(session.user.email);
    if (!parent) {
      return NextResponse.json({ error: "Přístup zamítnut." }, { status: 403 });
    }

    const children = await getChildrenOfParent(parent.rowId);
    const child = children.find((c) => c.rowId === childId);
    if (!child) {
      return NextResponse.json(
        { error: "Toto dítě vám není přiřazeno." },
        { status: 403 }
      );
    }

    const childName = child.nickname || child.name;

    // Paralelní načtení všech potřebných dat najednou
    const [curveResult, predmetuResult, oblastiResult] = await Promise.allSettled([
      getCurveData(child.rocnik),
      getChildTableData(
        TABLE_HODNOCENI_PREDMETU,
        child.rowId,
        child.name,
        child.nickname,
        child.rocnik
      ),
      getChildTableData(
        TABLE_HODNOCENI_OBLASTI,
        child.rowId,
        child.name,
        child.nickname,
        child.rocnik
      ),
    ]);

    let curveOut: {
      rocnik: string;
      stepen_key: string;
      highlight: number | null;
      milestones: (number | null)[];
      milestones2: (number | null)[];
    } | null = null;

    if (curveResult.status === "fulfilled" && curveResult.value) {
      const curveData = curveResult.value;
      curveOut = {
        rocnik: curveData.rocnik,
        stepen_key: curveData.stepen_key,
        highlight: curveData.highlight,
        milestones: curveData.milestones,
        milestones2: curveData.milestones2,
      };
    }

    const predmetuRows: CodaRow[] =
      predmetuResult.status === "fulfilled" ? predmetuResult.value : [];
    const oblastiRows: CodaRow[] =
      oblastiResult.status === "fulfilled" ? oblastiResult.value : [];

    if (predmetuResult.status === "rejected") {
      console.error("[vysvedceni-grafy] Hodnocení předmětů:", predmetuResult.reason);
    }
    if (oblastiResult.status === "rejected") {
      console.error("[vysvedceni-grafy] Hodnocení oblastí:", oblastiResult.reason);
    }

    const areasBySubject = new Map<string, typeof oblastiRows>();
    for (const row of oblastiRows) {
      const subj = String(getVal(row, "Předmět")).trim();
      if (!areasBySubject.has(subj)) areasBySubject.set(subj, []);
      areasBySubject.get(subj)!.push(row);
    }

    const predmety: {
      predmet: string;
      hodnoceni: unknown;
      predchozi_hodnoceni: unknown;
      tempo_zmeny: unknown;
      oblasti: {
        oblast: unknown;
        podpredmet: unknown;
        predchozi_body: unknown;
        body_celkem: unknown;
        zbyva_bodu: unknown;
      }[];
    }[] = [];

    for (const s of predmetuRows) {
      const predmet = String(getVal(s, "Předmět")).trim();
      const oblastiForSubj = areasBySubject.get(predmet) ?? [];
      const oblastiOut = oblastiForSubj
        .map((a) => {
          const bodyCelkem = toNum(getVal(a, "Body celkem", "Body celkem"), 0);
          const predchoziBody = toNum(getVal(a, "Předchozí body", "Historické lodičky"), 0);
          const oblastCelkem = toNum(getVal(a, "Oblast celkem"), 0);
          const zbyva = toNum(getVal(a, "Zbývá bodů", "Zbyva bodu"), Math.max(0, oblastCelkem - bodyCelkem));
          return {
            oblast: getVal(a, "Oblast"),
            podpredmet: getVal(a, "Podpředmět"),
            predchozi_body: predchoziBody,
            body_celkem: bodyCelkem,
            zbyva_bodu: zbyva,
          };
        })
        .sort((a, b) => {
          const pp = String(a.podpredmet || "").localeCompare(String(b.podpredmet || ""), "cs");
          if (pp !== 0) return pp;
          return String(a.oblast || "").localeCompare(String(b.oblast || ""), "cs");
        });

      predmety.push({
        predmet,
        hodnoceni: getVal(s, "Hodnocení"),
        predchozi_hodnoceni: getVal(s, "Předchozí hodnocení"),
        tempo_zmeny: getVal(s, "Tempo změny"),
        oblasti: oblastiOut,
      });
    }

    predmety.sort((a, b) => a.predmet.localeCompare(b.predmet, "cs"));

    const report = { jmeno: childName, predmety };
    return NextResponse.json({
      child: childName,
      curve: curveOut,
      report,
    });
  } catch (e) {
    console.error("[vysvedceni-grafy]", e);
    const message = e instanceof Error ? e.message : "Nepodařilo se načíst data pro grafy.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
