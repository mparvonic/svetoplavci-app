# M01 Doménový model

## Katalog a verze

- `M01RvpVersion` - verze RVP importovaná do aplikace.
- `M01RvpOvu` - OVU v konkrétní verzi RVP.
- `M01SvpVersion` - sada/katalog lodiček, včetně platnosti, stavu a vazby na RVP.
- `M01Predmet`, `M01Podpredmet`, `M01Oblast` - katalogové členění sady.
- `M01Lodicka` - katalogová lodička v konkrétní sadě.
- `M01LodickaOvuLink` - vazba katalogové lodičky na OVU.
- `M01LodickaPrerequisite` - prerekvizity mezi katalogovými lodičkami.

## Osobní lodičky

- `M01OsobniSadaLodicek` - osobní sada žáka pro školní stupeň a verzi ŠVP.
- `M01OsobniLodicka` - osobní instance katalogové lodičky v osobní sadě.
- `M01OsobniLodickaEvent` - append-only historie změn stavu osobní lodičky.

## Role a odpovědnosti

- `garant` - může měnit stav osobních lodiček.
- `spravce_lodicek` - spravuje přidělené katalogové lodičky a jejich OVU/RVP vazby.
- `spravce_flotily` - spravuje celou sadu lodiček.

Tabulka `M01LodickaGarant` pochází ze starého importního pojmenování, ale v aktuálním modelu reprezentuje M:N přiřazení správců ke konkrétní katalogové lodičce. Aktuální runtime vazba pro garanty stavu je `M01LodickaStavGarant`. Vazba `M01OblastSpravce` reprezentuje tým nastavený na úrovni oblasti; používá se jako vyšší úroveň pro hromadnou správu/default při práci se strukturou oblasti a pro odvození skupiny garantů stavu v importovaných sadách.

## Klíčové vazby

- `M01SvpVersion` je „set lodiček“.
- `M01Lodicka` patří právě do jedné `M01SvpVersion`.
- `M01SvpVersion` je navázaná na jednu `M01RvpVersion`.
- `M01LodickaOvuLink` váže lodičku na OVU dané RVP verze.
- `M01OsobniSadaLodicek` je navázaná na `žák + školní stupeň + verze ŠVP`.
- `M01OsobniLodicka` patří do osobní sady a odkazuje na katalogovou lodičku.
- `M01OsobniLodickaEvent` nikdy nemaže historii; opravy se řeší logickým zneplatněním.

## Invarianty

- Stav plnění osobní lodičky je hodnota `0..4`.
- Školní stupeň je `I_STUPEN` nebo `II_STUPEN`.
- Projekce aktuálního stavu osobní lodičky se počítá pouze z aktivních (`is_invalidated = false`) eventů.
- Lodička se deaktivuje pouze na úrovni katalogu/sady (`M01Lodicka.isDeleted`). Samostatná deaktivace jedné osobní lodičky při aktivní katalogové lodičce není povolená. Deaktivace katalogové lodičky musí deaktivovat všechny navázané osobní lodičky (`M01OsobniLodicka.isDeleted`); eventová historie zůstává zachovaná.
- Historická data se nepřepisují.
- Coda není runtime zdroj M01; zůstává pouze auditní původ importovaných dat.
