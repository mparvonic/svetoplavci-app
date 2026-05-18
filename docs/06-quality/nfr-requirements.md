# NFR požadavky

## Bezpečnost

- Vynucená autentizace a autorizace pro chráněné operace.
- Auditovatelnost kritických změn.

## Výkon

- Odezva klíčových read API do 500 ms (P95) při běžném zatížení.
- Dávkové operace musí být monitorované a restartovatelné.

## Dostupnost

- Definované health checky a alerting pro kritické endpointy.
- Definovaný postup obnovy po výpadku.

## Udržovatelnost

- Jednotný API standard.
- Povinná aktualizace dokumentace při architektonické změně.
