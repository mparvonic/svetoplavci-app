## Dokumentace – školní aplikace Světoplavci

Tato složka obsahuje technickou dokumentaci k aktuálnímu stavu aplikace.  
Primární účel je **referenční bod pro AI asistenta** (a vývojáře) – aby bylo možné:

- rychle pochopit architekturu,
- ověřit stávající chování bez potřeby znovu číst celý kód,
- a v případě potřeby se **vracet k původnímu stavu řešení**.

> ⚠ **Důležité:** Dokumentaci nikdy neupravuji samostatně – pouze na výslovný pokyn uživatele.

### Struktura

- `architecture.md` – přehled architektury aplikace (frontend, backend, integrace).
- `auth.md` – přihlášení, session, magic link, vazba na Codu.
- `coda-integration.md` – detaily integrace s Coda API, tabulky, mapování, cache.
- `api-endpoints.md` – hlavní API routy Next.js používané frontendem.
- `ui-ux.md` – hlavní obrazovky, metro design, mobilní vs. desktop layout.
- `security.md` – shrnutí bezpečnostního modelu a odkaz na `GDPR.md`.
- `school-year-groups.md` – datový model školního roku, skupin, členství a změnové historie stavu dítěte.
- `dev-database-refresh.md` – standardní refresh TEST/DEV databází z produkce (v DEV s anonymizací).

Stav odpovídá commitům kolem nasazení verze s metro dlaždicemi, českými texty přihlášení a doplněnou ochranou rodič/dítě přes Codu.
