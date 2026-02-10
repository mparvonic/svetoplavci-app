## Zajištění bezpečnosti dat a GDPR compliance

Tento dokument popisuje, jak je ve školní aplikaci Světoplavci zajištěna bezpečnost dat a jak aplikace podporuje plnění požadavků GDPR. Nejedná se o právní výklad, ale o technický popis implementovaných opatření.

---

### 1. Architektura a zdroj dat

- **Zdroj dat**: veškerá žákovská a rodičovská data jsou uložena v systému **Coda** v chráněném dokumentu školy (tabulka „Seznam osob“, tabulky lodiček, vysvědčení atd.).
- **Aplikace** pouze:
  - čte data z Coda přes oficiální REST API (`https://coda.io/apis/v1`),
  - zobrazuje je autorizovanému rodiči,
  - a nikde je trvale znovu neukládá (vyjma technických logů chyb bez osobních dat).
- **Konfigurace přístupu k Codě**:
  - identifikace dokumentu: `CODA_DOC_ID`,
  - přístup na tabulky dle ID/názvů (`CODA_TABLE_*`),
  - autentizace pomocí API tokenu `CODA_API_TOKEN` uloženého v prostředí serveru (env proměnné), nikoli v kódu.

---

### 2. Autentizace uživatelů

Autentizace je řešena přes knihovnu **Auth.js / NextAuth** s následujícími kanály:

- **Google účet** – OAuth 2.0 (provider `Google`).
- **E‑mailový odkaz (magic link)** – provider `nodemailer`:
  - při zadání e‑mailu se vygeneruje jednorázový ověřovací token,
  - token se uloží do databáze (tabulka `VerificationToken`),
  - uživateli se odešle e‑mail s odkazem obsahujícím token.

Bez ohledu na to, jak se uživatel přihlásí, aplikace vždy následně ověřuje, zda je jeho e‑mail evidován jako rodič v tabulce „Seznam osob“ v Codě (viz níže).

---

### 3. Autorizace rodičů přes Coda (RBAC)

Po úspěšném ověření magic linku nebo Google účtu probíhá vlastní autorizace:

1. **Nalezení rodiče podle e‑mailu**  
   Funkce `findParentByEmail(email)` v `src/lib/coda.ts`:

   - Prochází tabulku „Seznam osob“ v Codě.
   - Hledá řádek, kde:
     - `Role` obsahuje text **„Rodič“**,
     - hodnota ve sloupcích `Aktivní` / `Aktivní osoba` / `Aktivní?` není „Ne“ ani false,
     - v jednom ze sloupců `Kontaktní maily` / `Kontaktní email` / `Kontaktní e-maily` / `E-mail` / `Email`
       se po normalizaci vyskytuje přihlašovací e‑mail (podpora vícenásobných adres i multi‑select hodnot).

2. **Získání seznamu dětí daného rodiče**  
   Funkce `getChildrenOfParent(parentRowId)`:

   - Načte detailní řádek rodiče (podle `rowId` v Codě).
   - Ze sloupce **`Děti`** (relation) získá seznam navázaných řádků – to je primární zdroj dětí.
   - Pokud tabulka místo relation používá textový seznam jmen/přezdívek, provede:
     - parsování jmen dětí,
     - vyhledání odpovídajících řádků napříč tabulkou „Seznam osob“.
   - Fallback pro starší struktury tabulky „Rodič(e)“ přes textová jména rodičů.

   Výstupem je pole dětí `CodaChild[]` (rowId, jméno, přezdívka, ročník, smečka).

3. **Napojení na Auth.js**  
   V `auth.config.ts` (callback `signIn`):

   - Po ověření e‑mailu Auth.js:
     - zavolá `findParentByEmail(email)`,
     - pokud rodič **není nalezen**, přesměruje uživatele zpět na `/auth/signin?error=NoRole`.
   - V callbacku `jwt` se přiřadí:
     - `token.role = "rodic"` a `token.jmeno = parent.name`.
   - V callbacku `session` je role rodiče přenesena do `session.user.role`.

Tím je zajištěno, že do aplikace se jako „rodič“ dostane pouze uživatel, jehož e‑mail je skutečně evidován v tabulce „Seznam osob“ v Codě.

---

### 4. Omezení přístupu k datům dětí (authorization enforcement)

Všechna API pro přístup k datům dětí (`app/api/coda/child/...`) používají stejný pattern:

1. Ověření přihlášení:

```ts
const session = await auth();
if (!session?.user?.email) return 401 Nepřihlášen;
```

2. Znovu vyhledání rodiče v Codě:

```ts
const parent = await findParentByEmail(session.user.email);
if (!parent) return 403 Přístup zamítnut;
```

3. Získání seznamu dětí daného rodiče:

```ts
const children = await getChildrenOfParent(parent.rowId);
```

4. Kontrola, že požadované `childId` skutečně patří tomuto rodiči:

```ts
const child = children.find((c) => c.rowId === childId);
if (!child) return 403 "Toto dítě vám není přiřazeno.";
```

5. **Teprve poté** se volají funkce `getChildTableData` / `getCurveData` pro konkrétní tabulky v Codě.

To znamená:

- I kdyby rodič ručně přepsal `childId` v URL, dostane odpověď 403, pokud dítě není navázáno na jeho řádek v Codě.
- Nelze načíst libovolné tabulky – endpoint `/api/coda/child/[childId]/[table]` má whitelist `ALLOWED_TABLES` (jen tabulky použití v aplikaci).

Bez správného navázání dítěte na rodiče v tabulce „Seznam osob“ *nevznikne v aplikaci žádná možnost nahlížet do dat cizích dětí*.

---

### 5. Session, odhlášení a magické odkazy

#### 5.1 Session (přihlášení)

- Aplikace používá **JWT session** (`session.strategy: "jwt"`).
- Platnost session (`maxAge`) je 30 dní, ale:
  - lze ji kdykoliv ukončit odhlášením,
  - nebo automatickým odhlášením po 30 minutách nečinnosti (viz níže).

Cookie se session je podepsaná serverovým tajemstvím (`AUTH_SECRET` / `NEXTAUTH_SECRET`), takže ji nelze podvrhnout bez znalosti tohoto klíče.

#### 5.2 Magic link (Email provider)

- Při požadavku na e‑mailové přihlášení:
  - se v DB vytvoří `VerificationToken` s omezenou platností,
  - uživateli se odešle e‑mail s odkazem obsahujícím token.
- Při kliknutí na odkaz Auth.js:
  - ověří token,
  - **jednorázově ho smaže** – odkaz nelze použít znovu,
  - teprve potom vytvoří session.
- Aplikace navíc omezuje frekvenci generování magic linků:
  - v serverové akci u přihlašovacího formuláře je jednoduchý throttle: pro stejný e‑mail lze vyžádat nový odkaz maximálně jednou za 30 sekund.

#### 5.3 Odhlášení a nečinnost

- Vpravo nahoře v dashboardu je tlačítko **„Odhlásit se“** – volá serverovou akci `signOutAction`, která provede:

```ts
await signOut({ redirectTo: "/" });
```

→ cookie se session se smaže, uživatel je odhlášen.

- Komponenta `InactivitySignOut` sleduje aktivitu uživatele (myš, klávesnice, scroll, dotyk); po 30 minutách nečinnosti:

```ts
signOut({ redirectTo: "/auth/signin?reason=inactivity" });
```

→ session se také smaže a uživatel je vrácen na přihlášení se sdělením, že byl odhlášen po nečinnosti.

Tím se minimalizuje riziko, že by někdo využil „zapomenutou“ session na sdíleném zařízení.

---

### 6. Bezpečnost přihlašovacích e‑mailů

- E‑maily s magickým odkazem jsou odesílány přes SMTP server definovaný v env proměnných `EMAIL_SERVER` / `SMTP_URL`.
- Odesílatel je vždy jasně označen jako **„Školní aplikace Světoplavci“**.
- Obsah e‑mailu:
  - vysvětluje, že byla přijata žádost o přihlášení,
  - obsahuje tlačítko „Přihlásit se“ s odkazem,
  - uvádí textovou podobu odkazu,
  - upozorňuje, že odkaz je platný jen omezenou dobu a pro toto zařízení/prohlížeč,
  - doporučuje e‑mail ignorovat, pokud o přihlášení uživatel nežádal.

Tím se snižuje riziko phishingu a neoprávněného přihlášení při úniku e‑mailu.

---

### 7. Minimalizace zpracovávaných dat

- Aplikace pracuje pouze s údaji nezbytnými pro svůj účel:
  - rodič: jméno, e‑mail,
  - dítě: jméno/přezdívka, ročník, skupina („smečka“), výsledková data z lodiček a vysvědčení.
- Všechny citlivější údaje (např. přesné známky / bodové stavy) jsou pouze zobrazovány, nikoli zpracovávány mimo rozsah aplikace.
- Na straně aplikace se neukládají další osobní údaje trvale do vlastní databáze (Prisma DB slouží primárně pro Auth a technická metadata).

---

### 8. Logování a ladicí režim

- V běžném provozu logy obsahují pouze minimální množství informací:
  - typ chyby,
  - interní ID řádku/operace,
  - obecné zprávy o selhání („Nepodařilo se načíst data z Coda“ apod.).
- Detailnější diagnostika (`AUTH_DEBUG=1`) je určená pouze pro vývojové prostředí:
  - vypisuje použitý e‑mail a základní informace o nalezeném rodiči/dětech,
  - neměla by být nikdy zapnutá v produkci.

---

### 9. Shrnutí bezpečnostního modelu

1. **Autentizace** – magický odkaz / Google účet přes Auth.js.
2. **Autorizace** – každý přístup k datům dítěte ověřuje:
   - existenci session,
   - existenci rodiče v Codě podle e‑mailu,
   - přiřazení dítěte k rodiči (`getChildrenOfParent` + kontrola `childId`).
3. **Jednorázové a časově omezené magic linky** – tokeny v DB, po použití se mažou.
4. **Ochrana session** – JWT cookies, ruční odhlášení + automatické odhlášení po 30 minutách nečinnosti.
5. **Minimalizace dat** – aplikace pouze zobrazuje data z Coda, neveze si vlastní rozsáhlé kopie.
6. **GDPR komunikace** – uživateli je jasně sděleno:
   - že má používat e‑mail evidovaný v Edookitu,
   - že pro přidání další adresy je určena kancelář školy,
   - že data jsou zpracovávána v souladu s GDPR a interními směrnicemi školy.

Tento model zajišťuje, že rodič se nikdy nedostane k datům dětí, které k němu nejsou v systému Coda přiřazené, a že přístup do aplikace je pevně vázaný na kontrolu e‑mailu a rodičovskou roli.

