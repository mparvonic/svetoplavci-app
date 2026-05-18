# M01 API kontrakty

Tento dokument popisuje aktuální API povrch M01. Starší návrhové endpointy typu `/api/m01/deti/:diteId/progress` byly odstraněny z aktuální dokumentace.

## Čtení osobních lodiček

- `GET /api/m01/my-children`
  - vrací děti dostupné pro aktuálního aktéra,
  - podporuje dev/prototypové parametry `role`, `scope`, `garantId`.

- `GET /api/m01/lodicky`
  - vrací osobní lodičky dostupné pro aktéra,
  - podporuje kompaktní formát přes `format=compact`,
  - podporuje `includeHistory=1`.

- `GET /api/m01/child/[childId]/lodicky`
  - vrací M01 lodičky konkrétního dítěte,
  - vždy ověřuje, že aktér má k dítěti přístup,
  - podporuje `includeHistory=1`.

## Zápis stavu osobní lodičky

- `POST /api/m01/lodicky/[personalId]/status`
  - zapisuje nový stav osobní lodičky jako auditovatelný event,
  - payload obsahuje `status`, `effectiveDate`, volitelně `note`,
  - podporuje řízené opravy přes `overwriteSameDate`, `allowHistorical`, `invalidateNewer`.

Stav osobní lodičky je hodnota `0..4`. Neplést se školním stupněm `I_STUPEN` / `II_STUPEN`.

## Správa katalogu lodiček

Správa katalogu probíhá v portálu:

- `/portal/lodicky/sprava`,
- `/portal/lodicky/sprava/[lodickaId]`.

Aktuální implementace používá server actions pro editaci katalogových lodiček. Funkční rozsah:

- editace názvu, popisu a ročníků,
- správa vazeb na OVU/RVP,
- nastavení garanta pro změnu stavu,
- nastavení správců lodičky,
- role-dependent omezení přístupu.

`spravce_lodicek` upravuje přidělené lodičky. `spravce_flotily` spravuje celou sadu a její správce.

## Budoucí API

Pro plnou správu sad lodiček bude vhodné doplnit explicitní API nebo server actions pro:

- založení nové sady (`M01SvpVersion`) jako kopie aktuální,
- nastavení platnosti sady,
- nastavení vazby sady na RVP,
- schválení a aktivaci sady,
- kontrolní report pokrytí OVU, garantů a správců.
