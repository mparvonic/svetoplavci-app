# M01 Výsledky vzdělávání

## Účel modulu

Řídit celý cyklus hodnocení vzdělávání dítěte nad lodičkami: průběžná evidence pokroku, podklady pro triangl, příprava vysvědčení a archivace podkladových dat.

## Scope

- In-scope:
  - portálová správa sad lodiček, oblastí a předmětů,
  - evidence stupňů plnění lodiček,
  - verzování ŠVP/lodiček (MINOR/MAJOR),
  - migrace osobních lodiček při MAJOR změně k 1. 9.,
  - agregace a hodnocení pokroku,
  - podklady pro triangl,
  - podklady pro vysvědčení,
  - archivace podkladů vysvědčení.
- Out-of-scope (pro první release):
  - plně automatizované složité transformace (zejména 1:N/N:N bez manuálního zásahu),
  - pokročilé prediktivní modely.

## Hlavní dokumenty

- `requirements.md`
- `domenovy-model.md`
- `api-kontrakty.md`
- `ui-flow.md`
- `implementation-plan.md`
- `test-plan.md`
- `status.md`
- `verzovani-svp-a-migrace-osobnich-lodicek.md`

## Aktuální stav

M01 běží nad interní PostgreSQL databází. Coda je pouze historický zdroj migrace a archivní stopa.

Sada lodiček je `M01SvpVersion`. Správa lodiček je dostupná v portálu, ne v `/admin`:

- `/portal/lodicky/sprava`,
- `/portal/lodicky/sprava/[lodickaId]`.

Aktuální význam rolí:

- `garant` mění stav osobních lodiček,
- `spravce_lodicek` spravuje přidělené katalogové lodičky,
- `spravce_flotily` spravuje celou sadu lodiček.
