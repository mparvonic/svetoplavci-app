# Coda Seznam osob -> mapování uživatelů (test)

## Datum

2026-04-03

## Kontext

- Zdroj: Coda tabulka `grid-PIwfgW7bQU` (`Seznam osob`), `DOC_ID=JkxyWdl0hd`.
- Cíl mapování: test DB `svetoplavci_test`, tabulky `app_person*`.
- Produkce (`svetoplavci`) zatím `app_person*` neobsahuje, proto se mapovalo pouze proti testu.

## Výsledek mapování

- Coda řádků: `361`
- Namapováno na `app_person`: `230`
  - přes `Identifikátor`: `224`
  - přes přesnou shodu `Jméno`: `6`
- Ambiguity: `0`
- Nenamapováno: `131`

Rozpad nenamapovaných:

- `Rodič`: `124`
- `Rodič,Zaměstnanec`: `1`
- prázdná role: `6`

## Kvalita identifikátorů v Coda

- `Role=Rodič`: `129` řádků
  - s `Identifikátor`: `0`
  - s `Primární e-mail`: `1`
- `Role=Žák`: `113` řádků
  - s `Identifikátor`: `113`
  - s `Primární e-mail`: `113`

Závěr: pro rodiče v Coda chybí mapovací klíče (identifikátor/e-mail), proto nejdou spolehlivě připojit k `app_person`.

## Doplňující ověření (rodiče)

### 1) Unikátnost `Křestní + Příjmení` v Coda

- rodiče (`Role` obsahuje `Rodič`): `138` řádků,
- vyplněné `Křestní` + `Příjmení`: `138`,
- unikátních dvojic `Křestní + Příjmení`: `138`,
- duplicity: `0`.

### 2) Kolik nenamapovaných rodičů lze dopárovat podle jména

Z `125` nenamapovaných rodičů:

- `123` má jednoznačný match na `app_person` podle `Křestní + Příjmení` (a role `rodic`),
- `1` má nejednoznačný match (`Daniel Lessner` -> 2 kandidáti v `app_person`),
- `1` nemá match (`Gary Ventura Valenzuela` - jiný zápis jména mezi Coda a DB).

Závěr: `Křestní + Příjmení` je použitelný dočasný klíč pro většinu rodičů, ale je potřeba explicitně řešit výjimky.

## Ověření vazby Rodič - Dítě v Coda

Kontrolováno přes Coda API `valueFormat=rich` (lookup vrací row reference):

- rodičovské řádky: `138`,
- rodiče s vyplněným `Děti`: `138`,
- vazeb `Rodič -> Dítě`: `198`,
- neplatné odkazy v `Děti` (rowId mimo tabulku): `0`.

Reverse kontrola na žácích:

- žákovské řádky: `113`,
- žáci s vyplněným `Rodiče`: `106`,
- vazeb `Dítě -> Rodič`: `195`,
- neplatné odkazy v `Rodiče`: `0`.

Konzistence obou směrů:

- vazby pouze v `Rodič -> Dítě` a chybí v `Dítě -> Rodič`: `3`,
- vazby pouze v `Dítě -> Rodič` a chybí v `Rodič -> Dítě`: `0`.

Nekonzistentní páry:

- `Filip Malý` (`i-9xXT962OCk`) -> `Filip Malý` (`i-2UtqPAUOlw`)
- `Jana Harvey` (`i-J1OMsT-EEE`) -> `Adeline Louise Harvey` (`i-fUyPHr8AKM`)
- `Jana Malá` (`i-mmEMVw01Wk`) -> `Filip Malý` (`i-2UtqPAUOlw`)

## Co lze z Coda bezpečně aktualizovat už teď

Pouze u již namapovaných osob (`230`):

- role z pole `Role` -> `app_role_assignment` (po mapování na interní role kódy),
- doplnění `app_person_source_record` typu `coda_person` (audit stopa),
- případně `display_name` u malých odchylek (`6` řádků).

Co z Coda teď nepoužívat jako autoritu:

- `UUID` (nejde o Plus4U ID, v datech je ve tvaru `ID-Organizace`),
- stav `Aktivní` proti API (nalezeny rozpory),
- role u osob bez jednoznačného mapování.

## Doporučené nové sloupce do Coda (minimum pro spolehlivé mapování)

1. `Externí klíč osoby` (povinný, unikátní, neměnný)
   - např. `edookit:<OrganizationIdent>:<PersonId>` nebo interní stabilní ID.
2. `Login e-mail` (povinný pro `Rodič` a externí role)
   - oddělit od obecného kontaktu.
3. `Role kódy` (normalizované kódy, ne volný text)
   - např. `rodic`, `zak`, `zamestnanec`, `pruvodce`, `patron`, `garant`, `admin`.
4. `Zdroj osoby`
   - `edookit_student`, `edookit_employee`, `manual_parent`, `manual_other`.

Volitelně:

- `Externí klíč rodič-dítě` vazeb (pro robustní import vztahů bez závislosti na názvech),
- `Sync status` / `Sync error` (pro kontrolu migrace).

## Poznámka k poli Děti/Rodiče

- V `valueFormat=simple` vrací Coda pouze text (přezdívky), což není stabilní klíč.
- Pro vazby je nutné číst `valueFormat=rich` a použít `rowId` odkazovaných řádků.
