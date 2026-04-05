"use client";

import type { ComponentType, ReactNode } from "react";
import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Anchor,
  BadgeCheck,
  Bell,
  BookOpen,
  CalendarDays,
  Circle,
  CircleDashed,
  CheckSquare,
  ClipboardList,
  LayoutDashboard,
  Link2,
  LogIn,
  MapPin,
  Palette,
  PanelTop,
  Quote,
  Sparkles,
  Square,
  SquareCheckBig,
  Triangle,
  Type,
  UserCircle2,
  UsersRound,
} from "lucide-react";
import {
  DESIGN_COLORS,
  DESIGN_PACK_META,
  DESIGN_RULES,
  getSmeckaTheme,
  SMECKA_THEME_PRESETS,
  UI_CLASSES,
} from "@/src/lib/design-pack/ui";

type ScreenId =
  | "signin"
  | "dashboard"
  | "user-card"
  | "table"
  | "action-form"
  | "schedule"
  | "kiosk"
  | "dynamic-table"
  | "group-dnd";

type ScreenDefinition = {
  id: ScreenId;
  title: string;
  kicker: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const screens: ScreenDefinition[] = [
  {
    id: "signin",
    title: "Přihlašovací obrazovka",
    kicker: "Auth",
    description: "Google + magic link, důraz na důvěru a jednoduché rozhodnutí uživatele.",
    icon: LogIn,
  },
  {
    id: "dashboard",
    title: "Domovská obrazovka a dashboard",
    kicker: "Home",
    description: "Role-based přehled: metriky, rychlé akce, upozornění a kontext plavby.",
    icon: LayoutDashboard,
  },
  {
    id: "user-card",
    title: "Detail uživatele (karta)",
    kicker: "Profil",
    description: "Typová karta osoby s rolemi, kontakty, skupinami a stavem účtu.",
    icon: UserCircle2,
  },
  {
    id: "table",
    title: "Tabulka (datový modul)",
    kicker: "Data",
    description: "Řaditelný seznam s filtry, stavy a řádkovou akcí.",
    icon: ClipboardList,
  },
  {
    id: "action-form",
    title: "Formulář akce",
    kicker: "Akce",
    description: "Vytvoření akce se skupinami, kapacitou, vazbou na rozvrh a kalendář.",
    icon: CheckSquare,
  },
  {
    id: "schedule",
    title: "Rozvrh",
    kicker: "Kalendář",
    description: "Týdenní přehled hodin a navázaných akcí se zohledněním změn.",
    icon: CalendarDays,
  },
  {
    id: "kiosk",
    title: "Kiosk obrazovka",
    kicker: "Kiosk",
    description: "Rychlé volby pro děti: ostrovy, půjčovna, rozvrh, orientace.",
    icon: PanelTop,
  },
  {
    id: "dynamic-table",
    title: "Dynamická tabulka",
    kicker: "Interakce",
    description:
      "Filtrování, detail řádku, komentáře, modal a hromadné operace nad výběrem.",
    icon: SquareCheckBig,
  },
  {
    id: "group-dnd",
    title: "Výběr dětí do skupiny (drag and drop)",
    kicker: "Skupiny",
    description: "Přetahování dětí mezi seznamem dostupných a cílovou skupinou.",
    icon: UsersRound,
  },
];

type DemoRow = {
  id: string;
  lodicka: string;
  oblast: string;
  zak: string;
  stav: 0 | 1 | 2 | 3 | 4;
  garant: string;
  komentare: string[];
};

const TABLE_DEMO_ROWS: DemoRow[] = [
  {
    id: "r1",
    lodicka: "Pohyb v hudbě",
    oblast: "Vlastní tvorba",
    zak: "Kryštof Parvonič",
    stav: 4,
    garant: "Káča",
    komentare: ["Výrazný posun za poslední 2 týdny.", "Doporučení: navázat skupinovým projektem."],
  },
  {
    id: "r2",
    lodicka: "Můj kraj",
    oblast: "Můj domov",
    zak: "Viktorie Parvonič",
    stav: 3,
    garant: "Tom",
    komentare: ["Průběžně doplňuje portfolio.", "Potřeba ověřit práci s mapou."],
  },
  {
    id: "r3",
    lodicka: "Stres",
    oblast: "Péče o sebe a druhé",
    zak: "Vendula Machová",
    stav: 2,
    garant: "Míra",
    komentare: ["Doporučen krátký individuální plán."],
  },
  {
    id: "r4",
    lodicka: "Lineární rovnice",
    oblast: "Algebra",
    zak: "Viktorie Parvonič",
    stav: 2,
    garant: "Tom",
    komentare: ["Procvičit domácí úkol č. 6 a č. 7."],
  },
  {
    id: "r5",
    lodicka: "Představení ČR",
    oblast: "Můj domov",
    zak: "Kryštof Parvonič",
    stav: 3,
    garant: "Míra",
    komentare: ["Materiál připraven, čeká na prezentaci."],
  },
];

const DND_DETI = [
  "Agáta Brychtová",
  "Kryštof Parvonič",
  "Viktorie Parvonič",
  "Vendula Machová",
  "Isa Sicouret",
  "Theo Sicouret",
];

export default function UiRedesignPage() {
  const [expandedScreenId, setExpandedScreenId] = useState<ScreenId | null>(null);
  const expandedScreen = screens.find((item) => item.id === expandedScreenId) ?? null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(10,77,166,0.16),_transparent_32%),linear-gradient(180deg,_#f5f9ff_0%,_#eef4fb_45%,_#f8fbff_100%)] text-slate-900">
      <section className={`${UI_CLASSES.pageContainer} mx-auto flex w-full max-w-[1440px] flex-col gap-8 py-8 md:px-8 lg:px-10`}>
        <header className="overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_24px_70px_rgba(5,32,74,0.09)]">
          <div className="grid gap-8 px-6 py-7 md:px-8 md:py-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-[#D9E4F2] bg-[#F8FBFF] px-4 py-2">
                  <Image
                    src="/svetoplavci_logo.svg"
                    alt="Světoplavci"
                    width={230}
                    height={66}
                    className="h-10 w-auto"
                    priority
                  />
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#0A4DA6]/20 bg-[#0A4DA6]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#0A4DA6]">
                  <Anchor className="size-4" />
                  UI Redesign Pack
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E4F2] bg-white px-4 py-2 text-xs font-semibold text-slate-600">
                  Verze {DESIGN_PACK_META.version}
                </div>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-[#05204A] md:text-5xl">
                  Sada typových obrazovek pro rychlé sladění UI pravidel.
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
                  Tato stránka je referenční galerie: přihlášení, dashboard, karta uživatele,
                  tabulka, formulář akce, rozvrh a kiosk. Cílem je sladit vizuální jazyk před
                  rozpracováním v `proto-shell`.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <StatCard value="7" label="typových obrazovek" />
                <StatCard value="8" label="UI pravidel k potvrzení" />
                <StatCard value="1" label="sjednocený styl pro start" />
              </div>
            </div>

            <div className="rounded-[24px] border border-[#D7E4F4] bg-[#F6FAFF] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A4DA6]">
                Pravidla UI
              </p>
              <div className="mt-4 grid gap-2">
                {DESIGN_RULES.map((rule) => (
                  <div
                    key={rule}
                    className="rounded-2xl border border-[#D7E4F4] bg-white px-3 py-2 text-sm text-slate-600"
                  >
                    {rule}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-5">
          <ButtonKit />
          <TypographyKit />
          <ColorSchemeKit />
          <ConditionalDesignKit />
          <VisualKit />
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          {screens.map((screen) => (
            <ScreenCard
              key={screen.id}
              screen={screen}
              onExpand={() => setExpandedScreenId(screen.id)}
            />
          ))}
        </section>
      </section>

      {expandedScreen && (
        <div className="fixed inset-0 z-50 overflow-auto bg-slate-900/65 p-4 md:p-8">
          <div className="mx-auto w-full max-w-[1680px] overflow-hidden rounded-[28px] border border-[#BFD2EA] bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9E4F2] bg-[#F7FAFF] px-5 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">
                  Full screen náhled
                </p>
                <h2 className="text-lg font-semibold text-[#05204A]">{expandedScreen.title}</h2>
              </div>
              <button
                type="button"
                className="rounded-xl border border-[#D9E4F2] bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                onClick={() => setExpandedScreenId(null)}
              >
                Zavřít
              </button>
            </div>
            <div className="p-4">
              <ScreenPreview screenId={expandedScreen.id} full />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ButtonKit() {
  return (
    <article className="rounded-[24px] border border-[#D9E4F2] bg-white p-4 shadow-[0_10px_30px_rgba(5,32,74,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">Sada tlačítek</p>
      <div className="mt-3 grid gap-2">
        <button type="button" className={`rounded-2xl px-4 py-2 text-sm font-semibold ${UI_CLASSES.primaryButton}`}>
          Primární akce
        </button>
        <button
          type="button"
          className={`rounded-2xl px-4 py-2 text-sm font-semibold ${UI_CLASSES.secondaryButton}`}
        >
          Sekundární akce
        </button>
        <button type="button" className={`rounded-2xl px-4 py-2 text-sm font-semibold ${UI_CLASSES.dangerButton}`}>
          Destruktivní akce
        </button>
        <button
          type="button"
          disabled
          className="rounded-2xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
        >
          Disabled stav
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded-xl bg-[#002060] px-3 py-1.5 text-xs font-semibold text-white">
          XS
        </button>
        <button type="button" className="rounded-xl bg-[#002060] px-4 py-2 text-sm font-semibold text-white">
          SM
        </button>
        <button type="button" className="rounded-xl bg-[#002060] px-5 py-2.5 text-base font-semibold text-white">
          MD
        </button>
      </div>
    </article>
  );
}

function TypographyKit() {
  return (
    <article className="rounded-[24px] border border-[#D9E4F2] bg-white p-4 shadow-[0_10px_30px_rgba(5,32,74,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">Styly textů</p>
      <h2 className="mt-3 text-2xl font-semibold text-[#05204A]">Nadpis stránky</h2>
      <h3 className="mt-1 text-lg font-semibold text-[#1C355B]">Podnadpis sekce</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Běžný text pro vysvětlení kontextu, popis formuláře nebo instrukce k práci v aplikaci.
      </p>
      <p className="mt-2 flex items-start gap-2 rounded-xl border border-[#E1EAF6] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-600">
        <Quote className="mt-0.5 size-4 shrink-0 text-[#0A4DA6]" />
        „Citace nebo zvýrazněné vyjádření uživatele/průvodce.“
      </p>
      <a href="#" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#0A4DA6] underline">
        <Link2 className="size-4" />
        Odkaz na detail
      </a>
    </article>
  );
}

function ColorSchemeKit() {
  return (
    <article className="rounded-[24px] border border-[#D9E4F2] bg-white p-4 shadow-[0_10px_30px_rgba(5,32,74,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">Barevné schéma</p>
      <div className="mt-3 grid gap-2">
        {DESIGN_COLORS.map((color) => (
          <div
            key={color.name}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-[#E1EAF6] bg-[#F8FBFF] p-2"
          >
            <span
              className="size-8 rounded-lg border border-white shadow-sm"
              style={{ backgroundColor: color.hex }}
            />
            <div>
              <p className="text-xs font-semibold text-[#05204A]">{color.name}</p>
              <p className="text-[11px] text-slate-500">{color.usage}</p>
            </div>
            <code className="text-[11px] font-semibold text-slate-600">{color.hex}</code>
          </div>
        ))}
      </div>
    </article>
  );
}

function ConditionalDesignKit() {
  const options = [...SMECKA_THEME_PRESETS.map((item) => item.label), "Volavky"];
  const [selectedSmecka, setSelectedSmecka] = useState(options[0]);
  const theme = getSmeckaTheme(selectedSmecka);

  return (
    <article className="rounded-[24px] border border-[#D9E4F2] bg-white p-4 shadow-[0_10px_30px_rgba(5,32,74,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">
        Podmíněný design
      </p>
      <p className="mt-1 text-xs text-slate-500">Dynamický styl podle smečky / typu obsahu.</p>

      <select
        value={selectedSmecka}
        onChange={(e) => setSelectedSmecka(e.target.value)}
        className="mt-3 w-full rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <div
        className="mt-3 rounded-2xl border p-3"
        style={{ borderColor: theme.border, backgroundColor: theme.accentSoft }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: theme.accent }}>
          Motiv smečky
        </p>
        <h4 className="mt-1 text-base font-semibold text-[#05204A]">{selectedSmecka}</h4>
        <div className="mt-3 flex items-center gap-2">
          <span
            className="rounded-xl px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: theme.accent, color: theme.textOnAccent }}
          >
            Primární prvek
          </span>
          <span className="rounded-xl border px-3 py-1 text-xs font-semibold" style={{ borderColor: theme.accent, color: theme.accent }}>
            Sekundární
          </span>
        </div>
      </div>
    </article>
  );
}

function VisualKit() {
  return (
    <article className="rounded-[24px] border border-[#D9E4F2] bg-white p-4 shadow-[0_10px_30px_rgba(5,32,74,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">
        Piktogramy a prvky
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[
          { Icon: Type, label: "Text" },
          { Icon: BadgeCheck, label: "Stav" },
          { Icon: CalendarDays, label: "Čas" },
          { Icon: UsersRound, label: "Skupina" },
          { Icon: BookOpen, label: "Lodičky" },
          { Icon: ClipboardList, label: "Tabulka" },
          { Icon: Sparkles, label: "AI" },
          { Icon: Palette, label: "Design" },
        ].map(({ Icon, label }) => (
          <div key={label} className="rounded-xl border border-[#E1EAF6] bg-[#F8FBFF] p-2 text-center">
            <Icon className="mx-auto size-4 text-[#0A4DA6]" />
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-[#E1EAF6] bg-[#F8FBFF] p-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Tvar</p>
          <div className="flex items-center gap-2">
            <Circle className="size-4 text-[#0A4DA6]" />
            <Square className="size-4 text-[#DA0100]" />
            <Triangle className="size-4 text-[#F6B94C]" />
          </div>
        </div>
        <div className="rounded-xl border border-[#E1EAF6] bg-[#F8FBFF] p-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Linka</p>
          <div className="h-2 rounded-full bg-[linear-gradient(90deg,_#0A4DA6,_#DA0100)]" />
          <CircleDashed className="mt-2 size-4 text-[#0A4DA6]" />
        </div>
        <div className="rounded-xl border border-[#E1EAF6] bg-[#F8FBFF] p-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Gradient
          </p>
          <div className="h-8 rounded-lg bg-[linear-gradient(135deg,_#05204A,_#0A4DA6_65%,_#DA0100)]" />
        </div>
      </div>
    </article>
  );
}

function ScreenCard({
  screen,
  onExpand,
}: {
  screen: ScreenDefinition;
  onExpand: () => void;
}) {
  const Icon = screen.icon;

  return (
    <article className="overflow-hidden rounded-[28px] border border-[#D9E4F2] bg-white shadow-[0_14px_44px_rgba(5,32,74,0.08)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#E5EDF7] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">
            {screen.kicker}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#05204A]">{screen.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{screen.description}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-2xl bg-[#F0F6FF]">
          <Icon className="size-5 text-[#0A4DA6]" />
        </div>
      </div>

      <div className="bg-[linear-gradient(180deg,_#f7fbff_0%,_#eef4fb_100%)] p-4">
        <ScreenPreview screenId={screen.id} />
        <div className="mt-3 text-right">
          <button
            type="button"
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${UI_CLASSES.secondaryButton}`}
            onClick={onExpand}
          >
            Otevřít ve full screen
          </button>
        </div>
      </div>
    </article>
  );
}

function ScreenPreview({ screenId, full = false }: { screenId: ScreenId; full?: boolean }) {
  if (screenId === "signin") return <SignInPreview full={full} />;
  if (screenId === "dashboard") return <DashboardPreview full={full} />;
  if (screenId === "user-card") return <UserCardPreview full={full} />;
  if (screenId === "table") return <TablePreview full={full} />;
  if (screenId === "action-form") return <ActionFormPreview full={full} />;
  if (screenId === "schedule") return <SchedulePreview full={full} />;
  if (screenId === "kiosk") return <KioskPreview full={full} />;
  if (screenId === "dynamic-table") return <DynamicTablePreview full={full} />;
  return <GroupDragAndDropPreview full={full} />;
}

function BrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#BED1EA] bg-white shadow-[0_14px_40px_rgba(10,77,166,0.12)]">
      <div className="flex items-center gap-2 border-b border-[#D9E4F2] bg-[#F7FAFF] px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#F46B60]" />
        <span className="size-2.5 rounded-full bg-[#F6B94C]" />
        <span className="size-2.5 rounded-full bg-[#8FD19E]" />
        <div className="ml-2 rounded-full border border-[#D9E4F2] bg-white px-3 py-0.5 text-[11px] text-slate-400">
          proto-app.svetoplavci.cz
        </div>
      </div>
      {children}
    </div>
  );
}

function SignInPreview({ full = false }: { full?: boolean } = {}) {
  return (
    <BrowserFrame>
      <div
        className={`grid ${
          full ? "min-h-[720px]" : "min-h-[380px]"
        } bg-[linear-gradient(140deg,_#05204A_0%,_#0A4DA6_55%,_#DA0100_130%)] lg:grid-cols-[1.05fr_0.95fr]`}
      >
        <div className="px-6 py-7 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/65">
            Přihlášení
          </p>
          <h3 className="mt-3 text-3xl font-semibold leading-tight">
            Bezpečný vstup do školní aplikace.
          </h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/80">
            Primární volba je Google účet. Alternativa je magic link na ověřený e-mail.
          </p>
        </div>
        <div className="flex items-center bg-white/90 p-5">
          <div className="w-full rounded-[24px] border border-white bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">
              Vítejte
            </p>
            <button
              type="button"
              className="mt-3 w-full rounded-2xl bg-[#002060] px-4 py-3 text-sm font-semibold text-white"
            >
              Přihlásit přes Google
            </button>
            <div className="my-3 text-center text-xs uppercase tracking-[0.2em] text-slate-400">nebo</div>
            <div className="rounded-2xl border border-[#D9E4F2] bg-[#F8FBFF] px-4 py-3 text-sm text-slate-400">
              email@domena.cz
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded-2xl border border-[#DA0100] px-4 py-3 text-sm font-semibold text-[#DA0100]"
            >
              Poslat magic link
            </button>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function DashboardPreview({ full = false }: { full?: boolean } = {}) {
  return (
    <BrowserFrame>
      <div className={`${full ? "min-h-[720px]" : "min-h-[380px]"} bg-[#F6FAFF]`}>
        <TopBar title="Domovská obrazovka" />
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_320px]">
          <div className="space-y-4">
            <div className="rounded-[22px] bg-[linear-gradient(135deg,_#05204A_0%,_#0A4DA6_100%)] p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
                4. plavba
              </p>
              <h4 className="mt-2 text-2xl font-semibold">Rodičovský přehled dítěte</h4>
              <p className="mt-1 text-sm text-white/80">Rychlé metriky, upozornění a další kroky.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard title="Aktivní lodičky" value="184" icon={BookOpen} />
              <MetricCard title="Akce tento týden" value="4" icon={CalendarDays} />
              <MetricCard title="Upozornění" value="2" icon={Bell} />
            </div>
          </div>

          <aside className="space-y-3">
            <PanelCard title="Aktivní dítě" body="Kryštof Parvonič · 4. ročník · Smečka Krakeni" />
            <PanelCard title="Poslední změna" body="Lodička ‘Pohyb v hudbě’ změněna dnes 12:40." />
          </aside>
        </div>
      </div>
    </BrowserFrame>
  );
}

function UserCardPreview({ full = false }: { full?: boolean } = {}) {
  return (
    <BrowserFrame>
      <div className={`${full ? "min-h-[720px]" : "min-h-[380px]"} bg-[#F6FAFF] p-4`}>
        <div className="mx-auto max-w-xl rounded-[24px] border border-[#D9E4F2] bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[#EAF2FF]">
                <UserCircle2 className="size-8 text-[#0A4DA6]" />
              </div>
              <div>
                <h4 className="text-xl font-semibold text-[#05204A]">Kryštof Parvonič</h4>
                <p className="text-sm text-slate-500">Žák · Aktivní</p>
              </div>
            </div>
            <span className="rounded-full bg-[#EAF2FF] px-3 py-1 text-xs font-semibold text-[#0A4DA6]">
              ID: 8127
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoItem label="Ročník" value="4. ročník" />
            <InfoItem label="Smečka" value="Krakeni" />
            <InfoItem label="Patron" value="Tom" />
            <InfoItem label="Typ studia" value="Denní (11)" />
          </div>

          <div className="mt-4 rounded-2xl border border-[#D9E4F2] bg-[#F8FBFF] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4DA6]">Role</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#0A4DA6] px-3 py-1 text-xs font-semibold text-white">
                Žák
              </span>
              <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-semibold text-[#0A4DA6]">
                Proto přístup
              </span>
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function TablePreview({ full = false }: { full?: boolean } = {}) {
  return (
    <BrowserFrame>
      <div className={`${full ? "min-h-[720px]" : "min-h-[380px]"} bg-[#F6FAFF]`}>
        <TopBar title="Tabulka lodiček" />
        <div className="space-y-3 p-4">
          <div className="grid gap-2 sm:grid-cols-4">
            {["Žák", "Předmět", "Stav", "Garant"].map((filter) => (
              <div
                key={filter}
                className="rounded-2xl border border-[#D9E4F2] bg-white px-3 py-2 text-sm text-slate-500"
              >
                Filtr: {filter}
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-[20px] border border-[#D9E4F2] bg-white">
            <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_0.6fr] bg-[#F2F7FF] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span>Lodička</span>
              <span>Oblast</span>
              <span>Žák</span>
              <span>Stav</span>
              <span>Akce</span>
            </div>
            {[
              ["Pohyb v hudbě", "Vlastní tvorba", "Kryštof P.", "4 - Samostatně"],
              ["Můj kraj", "Můj domov", "Viktorie P.", "3 - Částečně"],
              ["Lineární rovnice", "Algebra", "Viktorie P.", "2 - S dopomocí"],
            ].map((row) => (
              <div
                key={`${row[0]}-${row[2]}`}
                className="grid grid-cols-[1.3fr_1fr_1fr_1fr_0.6fr] items-center border-t border-[#EDF2F8] px-3 py-3 text-sm"
              >
                <span className="font-medium text-[#05204A]">{row[0]}</span>
                <span className="text-slate-600">{row[1]}</span>
                <span className="text-slate-600">{row[2]}</span>
                <span className="text-[#0A4DA6]">{row[3]}</span>
                <span className="text-right text-[#DA0100]">Detail</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function ActionFormPreview({ full = false }: { full?: boolean } = {}) {
  return (
    <BrowserFrame>
      <div className={`${full ? "min-h-[720px]" : "min-h-[380px]"} bg-[#F6FAFF]`}>
        <TopBar title="Formulář akce" />
        <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[20px] border border-[#D9E4F2] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">
              Nová akce
            </p>
            <div className="mt-3 grid gap-3">
              <Field label="Název akce" value="Ostrov: Robotika" />
              <Field label="Typ akce" value="Ostrov" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Datum" value="2026-04-10" />
                <Field label="Čas" value="10:00-11:30" />
              </div>
              <Field label="Místo" value="Lab 2" icon={MapPin} />
              <Field label="Cílové skupiny" value="2. stupeň, Smečka Krakeni" icon={UsersRound} />
              <Field label="Vazba na rozvrh" value="Povinná: Ostrovy / pátek 4. hodina" />
            </div>
          </div>
          <div className="space-y-3">
            <PanelCard title="Kapacita" body="12 míst, aktuálně zapsáno 10." />
            <PanelCard title="Zápis" body="Otevřeno od 2026-04-07 12:00 do 2026-04-09 18:00." />
            <button
              type="button"
              className="w-full rounded-2xl bg-[#002060] px-4 py-3 text-sm font-semibold text-white"
            >
              Uložit akci
            </button>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function SchedulePreview({ full = false }: { full?: boolean } = {}) {
  return (
    <BrowserFrame>
      <div className={`${full ? "min-h-[720px]" : "min-h-[380px]"} bg-[#F6FAFF]`}>
        <TopBar title="Rozvrh žáka" />
        <div className="space-y-3 p-4">
          <div className="rounded-[20px] border border-[#D9E4F2] bg-white p-3">
            <div className="grid grid-cols-6 gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span>Čas</span>
              <span>Po</span>
              <span>Út</span>
              <span>St</span>
              <span>Čt</span>
              <span>Pá</span>
            </div>
            {[
              ["08:00", "SP/ČJ", "SP/MA", "EXP", "SP/ČJ", "OS"],
              ["09:00", "SP/MA", "EXP", "SP/ČJ", "ED/AJ", "OS"],
              ["10:00", "ED/AJ", "SP/MA", "Ponorka", "EXP", "Ostrovy"],
            ].map((row) => (
              <div key={row[0]} className="mt-2 grid grid-cols-6 gap-2 text-sm">
                <div className="rounded-xl bg-[#F3F8FF] px-2 py-2 font-medium text-[#05204A]">
                  {row[0]}
                </div>
                {row.slice(1).map((cell) => (
                  <div
                    key={`${row[0]}-${cell}`}
                    className="rounded-xl border border-[#DCE8F6] bg-white px-2 py-2 text-slate-600"
                  >
                    {cell}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="rounded-[18px] border border-[#F2D6D2] bg-[#FFF5F3] px-3 py-2 text-sm text-[#B2382E]">
            Změna rozvrhu: pátek 10:00 „Ostrovy“ -&gt; „Expedice“ (aktualizováno 07:15).
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function KioskPreview({ full = false }: { full?: boolean } = {}) {
  return (
    <BrowserFrame>
      <div
        className={`${
          full ? "min-h-[720px]" : "min-h-[380px]"
        } bg-[linear-gradient(180deg,_#05204A_0%,_#0A4DA6_80%)] p-5 text-white`}
      >
        <div className="rounded-[22px] border border-white/10 bg-white/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Kiosk režim</p>
          <h3 className="mt-2 text-3xl font-semibold">Co chceš udělat?</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <KioskButton label="Zapsat se na ostrov" />
            <KioskButton label="Půjčit zařízení" />
            <KioskButton label="Zobrazit rozvrh" />
            <KioskButton label="Kde mám být?" />
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function DynamicTablePreview({ full = false }: { full?: boolean } = {}) {
  const [rows, setRows] = useState(TABLE_DEMO_ROWS);
  const [query, setQuery] = useState("");
  const [stavFilter, setStavFilter] = useState<"all" | "0" | "1" | "2" | "3" | "4">("all");
  const [selectedId, setSelectedId] = useState<string>(TABLE_DEMO_ROWS[0]?.id ?? "");
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesQuery =
        row.lodicka.toLowerCase().includes(query.toLowerCase()) ||
        row.zak.toLowerCase().includes(query.toLowerCase()) ||
        row.oblast.toLowerCase().includes(query.toLowerCase());
      const matchesStav = stavFilter === "all" ? true : String(row.stav) === stavFilter;
      return matchesQuery && matchesStav;
    });
  }, [query, rows, stavFilter]);

  const selectedRow = rows.find((row) => row.id === selectedId) ?? filteredRows[0] ?? null;
  const selectedCount = Object.values(checkedIds).filter(Boolean).length;

  function toggleChecked(id: string) {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAllFiltered() {
    const allChecked = filteredRows.every((row) => checkedIds[row.id]);
    const patch: Record<string, boolean> = {};
    filteredRows.forEach((row) => {
      patch[row.id] = !allChecked;
    });
    setCheckedIds((prev) => ({ ...prev, ...patch }));
  }

  function applyBulkStatus(target: DemoRow["stav"]) {
    const selected = new Set(
      Object.entries(checkedIds)
        .filter(([, checked]) => checked)
        .map(([id]) => id),
    );
    if (selected.size === 0) return;

    setRows((prev) => prev.map((row) => (selected.has(row.id) ? { ...row, stav: target } : row)));
  }

  function clearSelection() {
    setCheckedIds({});
  }

  return (
    <BrowserFrame>
      <div className={`relative ${full ? "min-h-[760px]" : "min-h-[420px]"} bg-[#F6FAFF]`}>
        <TopBar title="Dynamická tabulka lodiček" />
        <div className="space-y-3 p-4">
          <div className="grid gap-2 md:grid-cols-[1.2fr_0.6fr_auto_auto_auto]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrovat: lodička, žák, oblast..."
              className="rounded-2xl border border-[#D9E4F2] bg-white px-3 py-2 text-sm text-slate-700 outline-none"
            />
            <select
              value={stavFilter}
              onChange={(e) => setStavFilter(e.target.value as "all" | "0" | "1" | "2" | "3" | "4")}
              className="rounded-2xl border border-[#D9E4F2] bg-white px-3 py-2 text-sm text-slate-700 outline-none"
            >
              <option value="all">Stav: vše</option>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
            <button
              type="button"
              onClick={() => applyBulkStatus(4)}
              className="rounded-2xl bg-[#002060] px-3 py-2 text-xs font-semibold text-white"
            >
              Hromadně -&gt; 4
            </button>
            <button
              type="button"
              onClick={() => applyBulkStatus(0)}
              className="rounded-2xl border border-[#DA0100] px-3 py-2 text-xs font-semibold text-[#DA0100]"
            >
              Hromadně -&gt; 0
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-2xl border border-[#D9E4F2] bg-white px-3 py-2 text-xs font-semibold text-slate-600"
            >
              Zrušit výběr
            </button>
          </div>

          <div className="rounded-[20px] border border-[#D9E4F2] bg-white">
            <div className="grid grid-cols-[0.5fr_1.3fr_1fr_1fr_0.8fr_0.8fr] bg-[#F2F7FF] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <button type="button" onClick={toggleAllFiltered} className="text-left">
                {selectedCount > 0 ? "☑" : "☐"}
              </button>
              <span>Lodička</span>
              <span>Oblast</span>
              <span>Žák</span>
              <span>Stav</span>
              <span>Komentáře</span>
            </div>
            {filteredRows.map((row) => (
              <div
                key={row.id}
                className={`grid cursor-pointer grid-cols-[0.5fr_1.3fr_1fr_1fr_0.8fr_0.8fr] items-center border-t border-[#EDF2F8] px-3 py-2 text-sm ${
                  selectedRow?.id === row.id ? "bg-[#F8FBFF]" : "bg-white"
                }`}
                onClick={() => setSelectedId(row.id)}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleChecked(row.id);
                  }}
                  className="text-left text-base"
                >
                  {checkedIds[row.id] ? "☑" : "☐"}
                </button>
                <span className="font-medium text-[#05204A]">{row.lodicka}</span>
                <span className="text-slate-600">{row.oblast}</span>
                <span className="text-slate-600">{row.zak}</span>
                <DemoStavBadge stav={row.stav} />
                <span className="text-[#0A4DA6]">{row.komentare.length}</span>
              </div>
            ))}
            {filteredRows.length === 0 && (
              <div className="px-3 py-5 text-sm text-slate-500">Žádné řádky pro daný filtr.</div>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[18px] border border-[#D9E4F2] bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A4DA6]">
                  Náhled detailu řádku
                </p>
                <button
                  type="button"
                  className="rounded-xl border border-[#D9E4F2] bg-[#F8FBFF] px-2 py-1 text-xs font-semibold text-[#0A4DA6]"
                  onClick={() => setIsModalOpen(true)}
                  disabled={!selectedRow}
                >
                  Otevřít modal
                </button>
              </div>
              {selectedRow && (
                <div className="mt-2 grid gap-2 text-sm">
                  <InfoItem label="Lodička" value={selectedRow.lodicka} />
                  <InfoItem label="Žák" value={selectedRow.zak} />
                  <InfoItem label="Garant" value={selectedRow.garant} />
                </div>
              )}
            </div>

            <div className="rounded-[18px] border border-[#D9E4F2] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A4DA6]">
                Komentáře k řádku
              </p>
              <div className="mt-2 grid gap-2">
                {(selectedRow?.komentare ?? []).map((comment) => (
                  <div key={comment} className="rounded-xl border border-[#E3EDF8] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-600">
                    {comment}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {isModalOpen && selectedRow && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/35 p-4">
            <div className="w-full max-w-lg rounded-[20px] border border-[#D9E4F2] bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-[#05204A]">Modální okno: detail lodičky</h4>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-[#D9E4F2] px-2 py-1 text-xs font-semibold text-slate-600"
                >
                  Zavřít
                </button>
              </div>
              <div className="mt-3 grid gap-2">
                <InfoItem label="Lodička" value={selectedRow.lodicka} />
                <InfoItem label="Oblast" value={selectedRow.oblast} />
                <InfoItem label="Žák" value={selectedRow.zak} />
                <InfoItem label="Stav" value={String(selectedRow.stav)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </BrowserFrame>
  );
}

function GroupDragAndDropPreview({ full = false }: { full?: boolean } = {}) {
  const [available, setAvailable] = useState(DND_DETI.slice(0, 4));
  const [groupMembers, setGroupMembers] = useState(DND_DETI.slice(4));

  function onDragStart(e: React.DragEvent<HTMLDivElement>, name: string, source: "available" | "group") {
    e.dataTransfer.setData("text/plain", JSON.stringify({ name, source }));
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>, target: "available" | "group") {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;

    const payload = JSON.parse(raw) as { name: string; source: "available" | "group" };
    if (payload.source === target) return;

    if (payload.source === "available") {
      setAvailable((prev) => prev.filter((item) => item !== payload.name));
      setGroupMembers((prev) => (prev.includes(payload.name) ? prev : [...prev, payload.name]));
    } else {
      setGroupMembers((prev) => prev.filter((item) => item !== payload.name));
      setAvailable((prev) => (prev.includes(payload.name) ? prev : [...prev, payload.name]));
    }
  }

  return (
    <BrowserFrame>
      <div className={`${full ? "min-h-[760px]" : "min-h-[420px]"} bg-[#F6FAFF]`}>
        <TopBar title="Výběr dětí do skupiny" />
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <DropColumn
            title="Dostupné děti"
            subtitle="Přetáhni do cílové skupiny"
            items={available}
            onDrop={(e) => onDrop(e, "available")}
            onDragStart={(e, name) => onDragStart(e, name, "available")}
          />
          <DropColumn
            title="Skupina: Ostrov Robotika"
            subtitle={`Aktuálně ${groupMembers.length} dětí`}
            items={groupMembers}
            onDrop={(e) => onDrop(e, "group")}
            onDragStart={(e, name) => onDragStart(e, name, "group")}
            highlighted
          />
        </div>
      </div>
    </BrowserFrame>
  );
}

function DropColumn({
  title,
  subtitle,
  items,
  onDrop,
  onDragStart,
  highlighted = false,
}: {
  title: string;
  subtitle: string;
  items: string[];
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, name: string) => void;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border-2 border-dashed p-3 ${
        highlighted ? "border-[#0A4DA6] bg-[#F0F6FF]" : "border-[#D9E4F2] bg-white"
      }`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A4DA6]">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      <div className="mt-3 grid gap-2">
        {items.map((name) => (
          <div
            key={name}
            draggable
            onDragStart={(e) => onDragStart(e, name)}
            className="cursor-grab rounded-xl border border-[#D9E4F2] bg-white px-3 py-2 text-sm font-medium text-[#05204A] active:cursor-grabbing"
          >
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoStavBadge({ stav }: { stav: DemoRow["stav"] }) {
  const style =
    stav === 4
      ? "bg-emerald-100 text-emerald-800"
      : stav === 3
      ? "bg-orange-100 text-orange-800"
      : stav === 2
      ? "bg-blue-100 text-blue-800"
      : stav === 1
      ? "bg-amber-100 text-amber-800"
      : "bg-slate-100 text-slate-700";
  return <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${style}`}>{stav}</span>;
}

function TopBar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#D9E4F2] bg-white px-4 py-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0A4DA6]">
          Světoplavci
        </p>
        <p className="text-sm font-semibold text-[#05204A]">{title}</p>
      </div>
      <span className="rounded-full bg-[#F2F7FF] px-3 py-1 text-xs font-semibold text-[#0A4DA6]">
        4. plavba
      </span>
    </div>
  );
}

function Field({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <div className="flex items-center gap-2 rounded-2xl border border-[#D9E4F2] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700">
        {Icon && <Icon className="size-4 text-[#0A4DA6]" />}
        <span>{value}</span>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#D9E4F2] bg-[#F8FBFF] px-3 py-2">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#05204A]">{value}</p>
    </div>
  );
}

function PanelCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-[#D9E4F2] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4DA6]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[18px] border border-[#D9E4F2] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <div className="flex size-8 items-center justify-center rounded-xl bg-[#EAF2FF]">
          <Icon className="size-4 text-[#0A4DA6]" />
        </div>
      </div>
      <p className="mt-4 text-2xl font-semibold text-[#05204A]">{value}</p>
    </div>
  );
}

function KioskButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-left text-base font-semibold"
    >
      {label}
    </button>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[20px] border border-[#D9E4F2] bg-[#F4F8FC] px-4 py-3">
      <p className="text-2xl font-semibold text-[#05204A]">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}
