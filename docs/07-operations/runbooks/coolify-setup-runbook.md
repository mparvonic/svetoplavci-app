# Runbook: zavedení Coolify pro Světoplavci

## Cíl

Převést deployment Světoplavci na GitHub + Coolify s oddělenými prostředími.

## Rozsah

- vytvořit Coolify aplikace pro `proto`, `test`, `prod`,
- nastavit domény,
- nastavit env/secrets,
- nastavit auto-deploy na branch.

## Kroky

1. Preflight:
   - potvrdit, že na VPS běží Traefik na `80/443`,
   - rozhodnout ingress strategii (ponechat stávající edge Traefik vs. převést ingress na Coolify).
2. Instalace/ověření Coolify na VPS.
3. Připojení GitHub repository.
4. Vytvoření aplikace `svetoplavci-proto` (`proto` branch, `proto-app.svetoplavci.cz`).
5. Vytvoření aplikace `svetoplavci-test` (`staging` branch, `test-app.svetoplavci.cz`).
6. Vytvoření aplikace `svetoplavci-prod` (`main` branch, `app.svetoplavci.cz`).
7. Nastavení environment variables per app.
8. Ověření TLS certifikátů a healthchecků.

## Akceptace

- Push do každé branch vyvolá deploy pouze svého prostředí.
- Všechny 3 domény mají validní TLS a funkční aplikaci.

## Aktuální provozní stav (2026-04-03)

- Coolify UI: `https://coolify.parvonic.cz`
- Aplikace:
  - `svetoplavci-prod` (`main` -> `app.svetoplavci.cz`)
  - `svetoplavci-test` (`staging` -> `test-app.svetoplavci.cz`)
  - `svetoplavci-proto` (`proto` -> `proto-app.svetoplavci.cz`)
- Proxy ingress:
  - edge Traefik (`edge_net`) jako veřejný ingress,
  - Coolify aplikace běží na `edge_net`.
