# M01 UI flow

## Průvodce: zápis pokroku

1. Průvodce otevře dítě a aktivní plavbu.
2. Vybere lodičku, upraví stupeň, doplní poznámku.
3. Potvrdí změnu, systém zapíše auditní event.
4. UI ihned přepočte agregace.

## Rodič: náhled hodnocení

1. Rodič otevře profil dítěte.
2. Vidí přehled pokroku po oblastech/předmětech.
3. V období trianglu nebo vysvědčení vidí podkladové shrnutí.

## Správa lodiček v portálu

1. `spravce_flotily` otevře `/portal/lodicky/sprava`.
2. Vybere nebo spravuje sadu lodiček (`M01SvpVersion`), její platnost a vazbu na RVP.
3. Uvnitř sady spravuje lodičky, OVU vazby, garanty a správce lodiček.
4. `spravce_lodicek` vidí a upravuje pouze přidělené lodičky.

## Uzavření vysvědčení

1. Odpovědná role vybere období.
2. Systém vygeneruje snapshot podkladů.
3. Snapshot se uzavře a uloží jako neměnný.
