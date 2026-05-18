# Doménový model (vysoká úroveň)

## Hlavní entity

- `SkolniRok`
- `Plavba`
- `Predmet`
- `Oblast`
- `Lodicka`
- `RVPStandard` (OVU)
- `Dite`
- `Rodic`
- `Pruvodce`
- `Smecka`
- `Posadka`
- `HodnoceniLodicky`
- `Triangl`
- `Vysvedceni`
- `Ostrov`
- `RezervaceZdroje`
- `PortfolioPolozka`

## Vazby (zjednodušeně)

- `SkolniRok` 1:N `Plavba`
- `Predmet` 1:N `Oblast` 1:N `Lodicka`
- `Lodicka` N:M `RVPStandard`
- `Lodicka` N:M `Lodicka` (prerekvizita)
- `Dite` N:M `Lodicka` přes `HodnoceniLodicky`
- `Triangl` je navázán na `Plavba + Dite`
- `Vysvedceni` je navázáno na `SkolniRok + Pololeti + Dite`

## Poznámka k verzování

`RVPStandard`, `Predmet`, `Oblast`, `Lodicka` musí podporovat verzování s režimem `MINOR/MAJOR`.
`MAJOR` změna je povolená pouze k `1. 9.` nového školního roku.
Osobní sada lodiček žáka je navázaná na školní stupeň (`I_STUPEN` / `II_STUPEN`) a verzi ŠVP (ne výlučně na školní rok).
