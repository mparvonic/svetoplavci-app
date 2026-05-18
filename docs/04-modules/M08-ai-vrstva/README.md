# M08 AI vrstva

## Ucel modulu

Zajistit AI-ready praci s daty skoly nad rizenou znalostni vrstvou:

- prevod klicovych domenovych dat do textove podoby,
- chunking,
- generovani a sprava embeddingu,
- synchronizace do obnovitelneho vektoroveho indexu,
- semanticke vyhledavani a navrhovani vazeb s lidskym potvrzenim.

## Scope

- In-scope:
  - `knowledge items` pro RVP/SVP/lodicky/osobni lodicky/historii,
  - chunking textu,
  - ukladani embedding metadat a auditniho stavu,
  - synchronizace do externi vektorove DB jako obnovitelneho indexu,
  - semanticke kandidaty vazeb lodicka -> OVU.
- Out-of-scope:
  - autonomni rozhodovani bez potvrzeni uzivatele,
  - produkcni AI asistenti pro vsechny role ve v1,
  - nahrazovani potvrzenych vazeb `M01LodickaOvuLink` automatickymi navrhy.

## Zavislosti

- M01 Vysledky vzdelavani (zdroj klicovych dat),
- M06 Uzivatele a role (opravneni pristupu k datum),
- M12 Platform core (API standard, audit, job orchestrace),
- AI stack knowledge pipeline (source catalog, chunking, Qdrant index, retrieval eval).

## Stav

- Faze: navrh
- Priorita: vysoka (strategicka vrstva)
- Owner: TBD

## M01 RVP/lodicky knowledge base

### Zakladni princip

M08 nema vytvaret druhy katalog OVU ani druhy katalog lodicek. Zdroj pravdy zustava v domenovych tabulkach M01:

- `M01RvpVersion`, `M01RvpOvu`, `M01RvpUzlovyBod`,
- `M01SvpVersion`, `M01Lodicka`, `M01LodickaOvuLink`,
- odvozena RVP grafova projekce `M01RvpGraphNode` / `M01RvpGraphEdge`.

Knowledge items, chunky, embeddingy a vektorovy index jsou odvozena vrstva. Lze je smazat a znovu sestavit z M01 bez ztraty domenovych dat. Potvrzena vazba zustava pouze `M01LodickaOvuLink`; semanticka vrstva smi nabizet kandidaty, ale nema je sama potvrzovat.

### Co indexovat

Prvni verze knowledge base ma pokryt dva hlavni typy obsahu:

- `M01_RVP_OVU`: jeden knowledge item pro kazde OVU v konkretni verzi RVP. Text obsahuje kod, nazev, popis, metodickou podporu, hodnoty, ilustrace, plnou vertikalni cestu a horizontalni sousedstvi.
- `M01_LODICKA`: jeden knowledge item pro kazdou katalogovou lodicku v konkretni verzi SVP. Text obsahuje nazev, popis, predmet/oblast/podpredmet, rocniky, stupen, typ, spravce a potvrzene OVU vazby.

Pozdeji lze pridat `M01_OSOBNI_LODICKA` a `M01_OSOBNI_LODICKA_EVENT`, ale az ve chvili, kdy bude jasne oddeleni osobnich dat, opravneni a retention pravidel.

### Kontextove osy

Semanticky index musi byt obohaceny o strukturovany payload, aby vyhledavani nebylo jen textova podobnost. Pro OVU se ukladaji zejmena tyto osy:

- vertikalni RVP cesta: `vzdelavaciOblasti -> vzdelavaciObory -> tematickeOkruhy -> uzlovyBod -> OVU`,
- klicove kompetence: `klicoveKompetence -> slozkyKlicoveKompetence -> uzlovyBod -> OVU`,
- zakladni gramotnosti: `zakladniGramotnosti -> slozkyZakladniGramotnosti -> uzlovyBod -> OVU`,
- prurezova temata: `prurezovaTemata -> uzlovyBod -> OVU`,
- horizontalni RVP vztahy: `ovu_related`, `ovu_precedes`, `ovu_follows`, sdilene uzlove body a sdilene nadrazene kontejnery,
- skolni osy: rocniky 1-9, stupen, predmet, oblast, podpredmet a typ lodicky.

Pro lodicky se uklada stejne skolni cleneni a navic potvrzene OVU linky. Tim jde ve vizualizaci spojit tri pohledy: tvrde vazby, RVP okoli a semanticke kandidaty.

### Vektorovy index

Navazujeme na AI stack pravidlo:

- Postgres drzi zdrojova domenova data, audit, stav knowledge itemu, stav chunku, embedding metadata a stav navrhu.
- Qdrant drzi obnovitelny vektorovy index. Nejde o zdroj pravdy; index lze kdykoliv zahodit a znovu nahrat.

Doporucena kolekce pro prvni rez:

```text
svetoplavci_m01_rvp_lodicky_v1
```

Minimalni payload v Qdrantu:

- `domain`: `M01_RVP_OVU` nebo `M01_LODICKA`,
- `sourceTable`, `sourceId`, `sourceVersionId`, `contentHash`,
- `rvpVersionId`, `svpVersionId`,
- `ovuKod`, `lodickaId`, `lodickaKod` podle typu zaznamu,
- `grades`, `stupen`, `predmet`, `oblast`, `podpredmet`,
- `verticalPaths`, `horizontalNeighborKeys`, `confirmedOvuCodes`,
- `visibility` / opravneni pro budouci filtrovani.

### Navrhovani vazeb lodicka -> OVU

Semanticky kandidat neni nova potvrzena vazba. Navrh se pocita jako kombinace vice signalu:

- vektorova podobnost textu lodicky a OVU,
- prekryv rocniku a stupne,
- shoda nebo blizkost predmetu/oblasti,
- grafova blizkost k uz potvrzenym OVU dane lodicky,
- penalizace kandidatů mimo rocnikovy nebo predmetovy kontext,
- odfiltrovani vazeb, ktere uz jsou potvrzene v `M01LodickaOvuLink`.

LLM ma vstupovat az nad kratkym seznamem kandidatu z retrievalu. Jeho ukol je kandidat vysvetlit, zaradit typ vztahu a dat duvod/protivahu; nema prohledavat cely katalog samo.

Navrhy patri do samostatne domenove tabulky, napriklad `M01LodickaOvuSuggestion`, se stavem `pending`, `accepted`, `rejected`, `ignored`. Prijeti navrhu vytvori potvrzenou vazbu v `M01LodickaOvuLink`; zamitnuti meni jen stav navrhu.

### Aktualizace a rebuild

Aktualizace musi byt idempotentni podle `contentHash` a vazana na zdrojovou verzi.

- Zmena RVP verze: normalizovat RVP, obnovit RVP grafovou projekci pro danou `M01RvpVersion`, prebuildit `M01_RVP_OVU` knowledge items/chunky, znovu nahrat Qdrant kolekci nebo versioned subset a spustit retrieval eval.
- Zmena lodicky: oznacit knowledge item lodicky jako stale, prebuildit text a chunk, prepocitat embedding/index bod, znovu prepocitat semanticke kandidaty pro tuto lodicku.
- Nova lodicka: zalozit knowledge item, indexovat, spustit kandidatni retrieval proti OVU aktualniho RVP/SVP kontextu.
- Zmena potvrzene vazby: aktualizovat payload knowledge itemu lodicky, invalidovat navrhy kolem teto lodicky a dotcenych OVU, ale nemenit OVU katalog.
- Zmena SVP/RVP bindingu: preindexovat lodicky dane SVP verze proti nove aktivni RVP verzi a ponechat historicke vazby interpretovatelne pres puvodni `sourceVersionId`.

Pro prvni implementaci staci manualni nebo admin job. Nasledne lze pridat frontu udalosti nad zmenami `M01Lodicka`, `M01LodickaOvuLink`, `M01SvpVersion` a `M01RvpVersion`.

### UI projekce

Stranka vazeb by mela cist vsechny vrstvy oddelene:

- potvrzene vazby: solidni hrany lodicka -> OVU z `M01LodickaOvuLink`,
- vertikalni okoli: breadcrumby a kontejnery RVP os kolem vybraneho OVU,
- horizontalni okoli: sousedni OVU a sdilene uzlove body/tematicke okruhy,
- pokryti: heatmap podle oblasti, oboru, tematickych okruhu, rocniku a predmetu,
- semanticke kandidaty: dashed/sekundarni hrany se score a duvodem,
- vektorova mapa: projekce embeddingu lodicek a OVU s filtry podle rocniku, oblasti, predmetu a stavu vazby.

Vektorova mapa nema byt sama o sobe dukaz vazby. Slouzi jako navigace po obsahove podobnosti a musi jit vzdy rozkliknout na konkretni zdrojove texty, RVP okoli a potvrzene nebo navrzene vazby.

## Implementace kroku 1: Knowledge korpus

První implementovaný řez staví transparentní knowledge korpus bez embeddingů a bez Qdrantu.

Spuštění dry-run:

```bash
npm run m01:knowledge:build -- --dry-run
```

Zápis do DB:

```bash
npm run m01:knowledge:build -- --write
```

Volitelně lze zvolit konkrétní SVP verzi:

```bash
npm run m01:knowledge:build -- --svp <M01SvpVersion.id> --write
```

Skript zapisuje odvozenou knowledge vrstvu do existujících tabulek:

- `AppAiKnowledgeItem`
- `AppAiKnowledgeChunk`

Zdroj pravdy zůstává v M01. Skript je idempotentní podle `sourceTable` + `sourceId`; při opakovaném běhu položky aktualizuje a chunky znovu sestaví.

Aktuální korpus `svetoplavci_m01_rvp_lodicky_v1` pro RVP `2025-06-24` a SVP `2025` obsahuje:

- `475` položek `M01_RVP_OVU`,
- `604` položek `M01_LODICKA`,
- `1362` chunků celkem.

Současně vznikají auditní artefakty:

```text
/data/knowledge/projects/svetoplavci/m01-rvp-lodicky-v1/rvp-2025-06-24__svp-cmnk83id90000g5f3mqljgkvd/
  manifest.json
  source_catalog.md
  retrieval_eval.md
  items.jsonl
  chunks.jsonl
```

`items.jsonl` a `chunks.jsonl` jsou čitelné katalogy toho, co se bude později indexovat. `retrieval_eval.md` obsahuje seed případy pro budoucí ověření vektorového vyhledávání.


## Implementace kroku 2: Lokální vektorový index

Druhý řez staví obnovitelný Qdrant index nad již vytvořenými knowledge chunky a RVP kontextovými uzly. Zdrojové texty zůstávají v DB; Qdrant je jen znovu sestavitelná projekce pro retrieval a vizualizace.

Spuštění dry-run:

```bash
npm run m01:vector:build -- --dry-run
```

Zápis do lokálního Qdrantu:

```bash
npm run m01:vector:build -- --write
```

Výchozí kolekce:

```text
svetoplavci_m01_rvp_lodicky_v1
```

Výchozí lokální Qdrant URL:

```text
http://127.0.0.1:6333
```

Aktuální index pro korpus `svetoplavci_m01_rvp_lodicky_v1` obsahuje `1836` bodů:

- `604` bodů `lodicka`,
- `758` bodů `rvp_ovu`,
- `474` bodů `rvp_context`.

Payload nese typ bodu, zdrojovou tabulku a id, kód, název, RVP/SVP verzi, ročníky, předmětové členění, potvrzené OVU vazby a vertikální kontext. Díky tomu půjde kombinovat vektorovou podobnost s filtrováním podle ročníku, oblasti, předmětu, typu vazby a RVP větve.

Použitý embedding je zatím `local/deterministic-hashing-v1`, `384` dimenzí. Není to skutečný sémantický model; slouží k ověření celé pipeline bez cloudového klíče. Semantická kvalita se bude hodnotit až po přepnutí na reálný embedding model, například lokální `bge-m3` podle AI stacku nebo schválené OpenAI embeddingy.

Auditní artefakty indexu vznikají zde:

```text
/data/knowledge/projects/svetoplavci/m01-rvp-lodicky-v1/qdrant-svetoplavci_m01_rvp_lodicky_v1/
  vector_index_manifest.json
  vector_retrieval_smoke.md
```

`vector_retrieval_smoke.md` je zatím smoke test dostupnosti a základního filtrování v Qdrantu, ne finální měřítko kvality návrhů vazeb.

## Implementace kroku 3: UI a semantické okolí

První UI řez už čte všechny tři vrstvy odděleně na stránce `/portal/lodicky/sprava/vazby`:

- tvrdé vazby z `M01LodickaOvuLink`,
- grafové okolí z RVP grafové projekce,
- semantické okolí přes endpoint `/api/m01/rvp/semantic` a Qdrant kolekci `svetoplavci_m01_rvp_lodicky_v1`.

Endpoint přijímá `lodickaId`, dohledá knowledge item lodičky v `AppAiKnowledgeItem` / `AppAiKnowledgeChunk`, sestaví dotazovací text a hledá podobné body typu `rvp_ovu` ve stejné RVP verzi. Výsledek vrací jako kandidáty s `score`, kódem OVU, textem, ročníkem a informací, zda už je OVU potvrzené.

Důležité omezení aktuální verze: kandidáti nejsou ukládané návrhy a nemají workflow `accepted/rejected`. Jde o live náhled nad baseline indexem. Další řez má doplnit perzistentní tabulku návrhů, LLM vysvětlení a přepnutí na skutečný embedding model.


## Kvalita a evaluace

Kazdy rebuild znalostni vrstvy ma vytvaret minimalne:

- source catalog pouzitych zdroju a verzi,
- pocet knowledge itemu/chunku podle domeny,
- pocet indexovanych bodu v Qdrantu,
- retrieval eval s priklady pro rocnikovy kontext, predmetovy kontext, znamou potvrzenou vazbu a negativni priklad mimo kontext.

Bez eval vystupu je semanticka vrstva jen technicky index, ne overeny nastroj pro spravu vazeb.
