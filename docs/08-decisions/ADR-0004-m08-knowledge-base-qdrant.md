# ADR-0004 M08 knowledge base a Qdrant index

## Status

Proposed

## Kontext

Sprava vazeb lodicek na RVP potrebuje kombinovat nekolik vrstev:

- potvrzene vazby `M01LodickaOvuLink`,
- RVP grafovou projekci pro vertikalni a horizontalni okoli OVU,
- semanticke vyhledavani podobnosti mezi textem lodicek a obsahem OVU,
- pokryti podle rocniku, predmetu, oblasti a RVP verze.

V aplikaci uz existuji M08 modely pro knowledge items, chunky a embedding metadata. V AI stacku je soucasne popsany pattern: kuratovane znalostni artefakty a auditni stav oddelit od obnovitelnych indexu, pro vektorove vyhledavani pouzit lokalni Qdrant kolekce.

## Rozhodnuti

Pro M08 knowledge base pouzijeme Postgres jako zdroj pravdy a auditni vrstvu, Qdrant jako obnovitelny vektorovy index.

Postgres bude drzet:

- domenova data M01,
- RVP grafovou projekci,
- knowledge item/chunk metadata,
- embedding/index stav,
- semanticke navrhy vazeb a jejich review stav.

Qdrant bude drzet:

- vektorove body pro OVU a lodicky,
- strukturovany payload pro filtrovani podle verze, rocniku, predmetu, oblasti, RVP cesty a stavu vazby.

Prvni kolekce se bude jmenovat `svetoplavci_m01_rvp_lodicky_v1`. Kolekce je obnovitelna z Postgresu a M01 zdroju. Jeji ztrata nesmi znamenat ztratu domenovych nebo auditnich dat.

## Dusledky

- Pozitivni:
  - navazujeme na existujici AI stack misto vlastni izolovane cesty,
  - lze delat semanticke mapy a kandidaty bez duplikace OVU katalogu,
  - Qdrant index lze prebuildit pri zmene RVP, SVP nebo embedding modelu,
  - Postgres zustava mistem pro opravneni, audit a review workflow.
- Negativni:
  - pribyva provozni zavislost na Qdrantu pro semanticke funkce,
  - je potreba job orchestrace pro rebuild a synchronizaci indexu,
  - vizualizace musi jasne odlisit potvrzene vazby od semantickych navrhu.
- Otevrene body:
  - konkretni embedding model a dimenze pro produkcni rez,
  - presna tabulka pro `M01LodickaOvuSuggestion`,
  - strategie opravneneho filtrovani osobnich dat pri pozdejsim zapojeni osobnich lodicek,
  - forma retrieval eval sady pro Světoplavce.

## Alternativy

- Pouzit pouze PostgreSQL/pgvector: jednodussi provozne, ale odchyluje se od AI stack patternu a hur se oddeluje obnovitelny index od domenove DB.
- Ukladat semanticke vazby primo do `M01LodickaOvuLink`: zamitnuto, protoze by se michaly potvrzene pedagogicke vazby s automatickymi kandidaty.
- Stavet samostatny katalog OVU pro AI vrstvu: zamitnuto, protoze by vznikla duplicita proti M01 a slozite mapovani mezi katalogy.
