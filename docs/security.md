## Bezpečnostní model (shrnutí)

> Detailní technický popis bezpečnosti a GDPR je v kořenovém souboru `GDPR.md`.  
> Tento dokument slouží jako stručný „mapový list“ k bezpečnosti.

### 1. Ověření identity a role

- Přihlášení je možné pouze přes:
  - Google OAuth (ověřený účet),
  - e‑mailový magic link (ověřený e‑mail).
- Po ověření účtu e‑mailu Auth.js:
  - systém **vždy** ověřuje, že e‑mail patří rodiči v tabulce „Seznam osob“ v Codě (`findParentByEmail`),
  - pokud ne, přihlášení je odmítnuto (NoRole).

### 2. Přístup jen ke „svým“ dětem

- Každé API, které pracuje s `childId` (`/api/coda/child/...`):
  - načte session přes `auth()` a získá `session.user.email`,
  - najde odpovídajícího rodiče v Codě,
  - získá seznam dětí daného rodiče (`getChildrenOfParent`),
  - **ověří, že požadované `childId` je v tomto seznamu**,
  - pouze v tom případě načítá data z Cody.
- Pokud `childId` rodiči nepatří, vrací **403 „Toto dítě vám není přiřazeno“**.

### 3. Magic linky a session

- Magic link (e‑mailový odkaz):
  - je reprezentován `VerificationToken` v DB,
  - po použití je token smazán → odkaz nejde použít znovu,
  - má omezenou časovou platnost (spravuje Auth.js).
- Session:
  - JWT cookie podepsané tajemstvím serveru (`AUTH_SECRET` / `NEXTAUTH_SECRET`),
  - role `rodic` je nastavena pouze při úspěšném nálezu rodiče v Codě.

### 4. Odhlášení a ochrana před „visící“ session

- Manuální odhlášení:
  - tlačítko „Odhlásit se“ volá `signOut` a smaže session cookie.
- Automatické odhlášení:
  - komponenta `InactivitySignOut` provede `signOut` po 30 minutách nečinnosti.

Tím je minimalizováno riziko, že by někdo na sdíleném zařízení zneužil zapomenutou session.

### 5. Omezení přístupu k Codě

- Aplikace nikdy nepoužívá e‑maily/ID dětí přímo z URL bez ověření v Codě.
- Všechny přístupy na Coda API (`getChildTableData`, `getCurveData`) jsou:
  - za obaleným Auth.js,
  - a filtrují data vždy přes `parent.rowId` + `getChildrenOfParent`.

### 6. Data a logování

- Aplikace **neukládá žákovská data** do vlastní DB – pouze Auth metadata (uživatelé, session, tokeny).
- Logy:
  - v produkci neobsahují citlivé osobní údaje (jména dětí atd.),
  - detailní ladicí logy (`AUTH_DEBUG=1`) jsou určeny jen pro vývojové prostředí.

