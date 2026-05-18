# Runbook: Coolify cutover bez výpadku (pro aktuální VPS)

Datum: 2026-04-02
Host: `178.104.118.29` (`mpcloud`)

## 0. Kontext

Aktuální produkce Světoplavci běží přes:

- edge Traefik (`/opt/edge/traefik`) na portech `80/443`,
- aplikační stacky v `/opt/prod/*`,
- `svetoplavci-app` je routovaný přes Traefik labels.

Proto je potřeba řešit Coolify tak, aby nevznikl konflikt ingress vrstvy.

## 1. Zvolená strategie (doporučená)

### Fáze A (bez výpadku)

- Nainstalovat Coolify jako management vrstvu.
- Nechat stávající edge Traefik jako jediný veřejný ingress.
- V Coolify na cílovém serveru používat proxy režim `Custom/None`.
- Neprovádět hned cutover produkce; nejdřív ověřit deploy na `test-app`.

### Fáze B (řízený cutover)

- Přepnout `test-app` na Coolify-managed runtime.
- Po stabilizaci přepnout `proto-app`.
- Nakonec přepnout `app` (produkce).

## 2. Co už je hotové

- Pre-cutover snapshot byl vytvořen:
  - `/srv/backups/miroslav/cutover-prep-20260402-235304.tar.gz`
- Snapshot obsahuje:
  - edge Traefik config,
  - stack `svetoplavci-app`,
  - root crontab,
  - docker/port/network inventář.

## 3. Kritické riziko

Instalační skript Coolify (`install.sh`) v kroku Docker konfigurace může restartovat Docker daemon.

Důsledek:

- krátký restart běžících kontejnerů (potenciální krátký výpadek).

Proto:

- instalaci provádět pouze v maintenance okně,
- mít ověřený rollback,
- po instalaci okamžitě smoke test.

## 4. Cutover checklist po krocích

## Krok 1: Preflight (bez zásahu)

- [ ] Potvrdit aktuální provozní zdraví (`docker ps`, web smoke test).
- [ ] Potvrdit přístup ke snapshotu v `/srv/backups/miroslav/`.
- [ ] Potvrdit maintenance okno.
- [ ] Spustit preflight skript:

```bash
scripts/ops/coolify-cutover-preflight.sh
```

## Krok 2: Instalace Coolify (maintenance okno)

- [ ] Spustit oficiální instalační skript:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

- [ ] Ověřit, že Coolify kontejnery jsou healthy.
- [ ] Ověřit, že stávající produkční kontejnery po instalaci naběhly.

## Krok 3: Inicializace Coolify

- [ ] Přihlášení do Coolify UI.
- [ ] Připojení GitHub repository.
- [ ] Založení projektu pro Světoplavci (`proto`, `test`, `prod`).

## Krok 4: Proxy a ingress pravidla

- [ ] Na serveru pro Světoplavci nastavit v Coolify proxy jako `Custom/None`.
- [ ] Nechat edge Traefik jako ingress vrstvu během migrace.

## Krok 5: Pilot deploy jen na test

- [ ] Založit app `svetoplavci-test` (`staging` -> `test-app.svetoplavci.cz`).
- [ ] Napojit na `svetoplavci_test` DB.
- [ ] Ověřit deploy + TLS + smoke test.

## Krok 6: Postupný cutover

- [ ] `proto-app` přes Coolify (`proto` branch).
- [ ] produkce `app` přes Coolify (`main` branch) až po stabilizaci testu.
- [ ] Po každém kroku validace + rollback bod.

## 5. Rollback

## Rollback A: bez zásahu do produkce

Pokud selže setup Coolify, ale produkční stack běží:

- zastavit/odinstalovat jen Coolify komponenty,
- ponechat stávající edge/prod stack beze změny.

## Rollback B: po částečném cutover test/proto

- vrátit DNS/router pro dotčenou doménu na původní službu,
- redeploy původního compose stacku z `/opt/prod/*`,
- ověřit smoke test.

## Rollback C: po cutover produkce

- okamžitý návrat na původní compose stack,
- validace login + klíčových API,
- incident zápis do `incident-log`.

## 6. Akceptační kritéria

- `test-app` běží stabilně přes Coolify minimálně 24h.
- `proto-app` funguje pro prototyp tok bez zásahu do produkce.
- produkce po cutover bez kritických incidentů.
- release/hotfix workflow (`staging -> main`, `hotfix/*`) je funkční end-to-end.

## 7. Reference

- Coolify install/upgrade command:
  - `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
- Coolify docs (server/proxy):
  - `https://coolify.io/docs/knowledge-base/server/introduction`
  - (proxy režimy `Traefik` vs `Custom/None`)
- Ověření instalačního skriptu na cílovém VPS:
  - skript v kroku Docker konfigurace obsahuje restart Docker daemonu při změně konfigurace (`restart_docker_service`).

## 8. Realizace (2026-04-03)

- Cutover dokončen pro `test-app`, `proto-app` i `app`.
- Všechny 3 domény vrací očekávané odpovědi (`307` na `/auth/signin` pro `app` a `test-app`, `302` na `/ui-redesign` pro `proto-app`).
- Starý kontejner `svetoplavci-app` byl zastaven a nastaven na `restart=no` kvůli odstranění kolize routingu.
- Po cutoveru byl identifikován problém s `POSTGRES_PRISMA_URL`:
  - `prod` mělo nefunkční host `10.0.0.1`,
  - `test`/`proto` měly placeholder hodnotu.
- Oprava:
  - nasazena DB proxy `svetoplavci-auth-db-proxy` (síť `edge_net` + `prod_net`),
  - vytvořena DB `svetoplavci_test` jako separátní test databáze,
  - aktualizovány env proměnné aplikací v Coolify a spuštěn redeploy.
