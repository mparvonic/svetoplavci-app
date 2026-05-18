# M12 Implementační plán

## Fáze 1: Identity a role

- Stabilizovat model uživatel/role.
- Zavést role assignment s platností a auditní stopou.

## Fáze 2: Policy a autorizace

- Zavést jednotné vyhodnocení oprávnění pro API.
- Přesunout ad-hoc kontrolu oprávnění do policy vrstvy.

## Fáze 3: Audit a konfigurace

- Zprovoznit centrální audit event store.
- Zprovoznit verzovanou konfiguraci a feature flags.

## Fáze 4: Observabilita

- Standardizovat log schema.
- Doplnit health checky, metriky a alerting minimálně pro kritické API.
