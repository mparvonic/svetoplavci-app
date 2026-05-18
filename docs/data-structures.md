# Datové struktury

## Zdroj pravdy

PostgreSQL je zdroj pravdy pro provozní data aplikace. Prisma schema je v `prisma/schema.prisma`.

Coda údaje se smějí uchovávat pouze jako archivní metadata k původu importovaných záznamů.

## Uživatelé a identity

Hlavní entity:

- `AppPerson` - osoba v aplikaci,
- `AppLoginIdentity` - login identita, typicky e-mail,
- `AppLoginPersonLink` - schválená vazba loginu na osobu,
- `AppRoleAssignment` - role osoby,
- `AppPersonRelation` - rodinné a další osobní vazby.

Login e-mail není osoba. Přístup k dítěti se odvozuje z interních vazeb, ne z Coda lookupu.

## Školní rok a skupiny

Školní a organizační struktura je v interních tabulkách:

- školní roky,
- skupiny a smečky,
- členství,
- stav dítěte v čase.

Údaje přenesené z Edookitu jsou řízené syncem a nesmí být přepsané ručním importem bez výslovného pravidla.

## M01 RVP a lodičky

Hlavní M01 entity:

- `M01RvpVersion` - importovaná verze RVP,
- `M01RvpOvu` - OVU v konkrétní verzi RVP,
- `M01SvpVersion` - sada/katalog lodiček s platností a vazbou na RVP,
- `M01Lodicka` - katalogová lodička v konkrétní sadě,
- `M01LodickaOvuLink` - vazba lodičky na OVU,
- `M01LodickaPrerequisite` - prerekvizity mezi lodičkami,
- `M01LodickaGarant` - přidělení správců lodičky,
- `M01OsobniSadaLodicek` - osobní sada žáka pro školní stupeň a verzi ŠVP,
- `M01OsobniLodicka` - osobní instance katalogové lodičky,
- `M01OsobniLodickaEvent` - append-only historie změn stavu.

`M01SvpVersion` je prakticky „set lodiček“. Obsahuje verzi, platnost, vazbu na RVP a stav aktivace.

## Stav vs školní stupeň

V dokumentaci rozlišujeme:

- **stav plnění lodičky** - hodnota `0..4`,
- **školní stupeň** - `I_STUPEN` nebo `II_STUPEN`.

Slovo `stupeň` bez přívlastku je nejednoznačné a v nové dokumentaci se mu vyhýbáme.

## Coda metadata

U některých záznamů mohou zůstat pole typu:

- `source_coda_row_id`,
- `source_ref`,
- `source`,
- importní batch v `metadata`.

Tato pole jsou auditní původ dat. Nejsou zdroj pravdy pro aktuální stav.
