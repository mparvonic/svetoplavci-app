# Role a persony

## Primární role

- `rodič`: náhled na pokrok dítěte, vysvědčení, triangly, přihlašování na ostrovy.
- `dítě`: práce s cíli, lodičkami, ostrovy, portfolio.
- `průvodce`: evidence pokroku, hodnocení, plánování plaveb a aktivit.
- `správce aplikace`: konfigurace systému, správa modulů, provozní dohled.
- `správce sítě`: návaznost na zařízení, síťová pravidla, vazba na půjčovnu.
- `administrátor`: systémové oprávnění, governance, krizové zásahy.

## Dílčí role

- `garant`: může měnit stav osobních lodiček, ke kterým má oprávnění.
- `spravce_lodicek`: spravuje přidělené katalogové lodičky, včetně názvu, popisu, ročníků a vazeb na OVU/RVP.
- `spravce_flotily`: spravuje celou sadu lodiček, platnost sady, vazbu na RVP a přiřazení správců lodiček.
- `korektor hodnocení`.
- `patron smečky`.

Historický význam `garant = obsahová odpovědnost nad oblastí/předmětem/lodičkou` je nahrazen novým pojetím výše.

## Zásady oprávnění

- Oprávnění se řídí kombinací role + kontextu (školní rok, třída, smečka, posádka).
- Každá citlivá operace musí být auditována (kdo, kdy, co změnil).
