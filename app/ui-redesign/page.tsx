const plavby = [
  { nazev: "Plavba 1", stav: "Dokončeno", bodu: 42 },
  { nazev: "Plavba 2", stav: "Probíhá", bodu: 31 },
  { nazev: "Plavba 3", stav: "Plán", bodu: 0 },
];

const ostrovy = [
  { nazev: "Keramika", kapacita: "8 / 12" },
  { nazev: "Robotika", kapacita: "12 / 12" },
  { nazev: "Dřevo", kapacita: "5 / 10" },
];

export default function UiRedesignPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <header className="mb-8 rounded-2xl bg-[#002060] p-6 text-white md:p-8">
          <p className="text-sm/5 opacity-90">Proto režim • mock data</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Světoplavci
          </h1>
          <p className="mt-3 max-w-2xl text-sm/6 opacity-90 md:text-base/7">
            Návrhová obrazovka bez napojení na Coda nebo databázi. Slouží pro
            rychlé ověřování rozvržení a toku aplikace.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#002060]">Plavby</h2>
            <ul className="mt-4 space-y-3">
              {plavby.map((plavba) => (
                <li
                  key={plavba.nazev}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{plavba.nazev}</p>
                    <p className="text-sm text-slate-600">{plavba.stav}</p>
                  </div>
                  <p className="text-sm font-semibold">{plavba.bodu} b</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#002060]">Ostrovy</h2>
            <ul className="mt-4 space-y-3">
              {ostrovy.map((ostrov) => (
                <li
                  key={ostrov.nazev}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                >
                  <p className="font-medium">{ostrov.nazev}</p>
                  <p className="text-sm text-slate-600">{ostrov.kapacita}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
          Další krok: postupně doplňovat další mock obrazovky a navazující toky
          (pohled dítěte, rodiče, průvodce) pod `proto` větví.
        </section>
      </section>
    </main>
  );
}
