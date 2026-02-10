## Autentizace a přihlášení

Tento dokument shrnuje aktuální stav přihlašování a práce se session.

### 1. Providers

- **Google (OAuth 2.0)**
  - Nastavený v `auth.config.ts` (`Google({ clientId, clientSecret })`).
  - Používá se na přihlašovací stránce jako první volba („Přihlásit se přes Google“).

- **E‑mail (magic link, provider `nodemailer`)**
  - Konfigurován v `src/lib/auth.ts` pomocí `Nodemailer({ server, from, sendVerificationRequest })`.
  - E‑mail se odesílá přes SMTP server nastavený v `EMAIL_SERVER` / `SMTP_URL`.
  - Text e‑mailu je plně česky (předmět, text, HTML s tlačítkem „Přihlásit se“).

### 2. Flow přihlášení e‑mailem (magic link)

1. Na `/auth/signin` rodič zadá svůj e‑mail a odešle formulář.
2. Serverová akce:
   - throttluje požadavky (pro stejný e‑mail max. jednou za 30 sekund),
   - volá `await signIn("nodemailer", { email, redirectTo: callbackUrl })`.
3. Auth.js:
   - vytvoří `VerificationToken` v DB,
   - zavolá `sendVerificationRequest`, který odešle e‑mail.
4. Po kliknutí na odkaz:
   - endpoint `/api/auth/callback/nodemailer` ověří a smaže token,
   - spustí `signIn` callback (viz níže),
   - vytvoří session (`JWT` cookie).

### 3. `signIn` callback – napojení na Codu

Implementace v `src/lib/auth.config.ts`:

```ts
async signIn({ user }) {
  const email = user?.email;
  if (!email) return false;

  const parent = await findParentByEmail(email);
  if (parent) return true;

  return "/auth/signin?error=NoRole";
}
```

- `findParentByEmail`:
  - hledá rodiče v Codě (Seznam osob),
  - kontroluje roli „Rodič“, aktivitu a kontaktní e‑maily.
- Pokud rodič nenalezen:
  - vrací se URL `/auth/signin?error=NoRole`,
  - na přihlášení se zobrazí červená hláška s vysvětlením a kontaktem na kancelář školy.

### 4. JWT a session callback

V `auth.config.ts`:

- `jwt` callback:

```ts
if (user?.email) {
  const parent = await findParentByEmail(user.email);
  if (parent) {
    token.role = "rodic";
    token.jmeno = parent.name;
  }
}
```

- `session` callback:

```ts
if (session.user) {
  const role = token.role ?? "zak";
  session.user.role = role as "admin" | "ucitel" | "rodic" | "zak";
  session.user.jmeno =
    (typeof token.jmeno === "string" ? token.jmeno : undefined) ??
    session.user.name ??
    undefined;
}
```

### 5. Odhlášení a automatické odhlášení

- **Manuální odhlášení**
  - Tlačítko „Odhlásit se“ v headeru volá serverovou akci `signOutAction`:

    ```ts
    await signOut({ redirectTo: "/" });
    ```

  - Auth.js smaže session cookie, uživatel je odhlášen.

- **Automatické odhlášení po 30 minutách nečinnosti**
  - Komponenta `InactivitySignOut` sleduje:
    - `mousedown`, `mousemove`, `keydown`, `scroll`, `touchstart`, `click`.
  - Při nečinnosti 30 minut:

    ```ts
    signOut({ redirectTo: "/auth/signin?reason=inactivity" });
    ```

  - Přihlášení pak opět vyžaduje magic link nebo Google účet.

### 6. Vlastní stránky Auth.js

- `pages.signIn = "/auth/signin"` – vlastní přihlašovací UI.
- `pages.verifyRequest = "/auth/verify-request"` – česky lokalizovaná stránka „Zkontrolujte e‑mail“.
- `pages.error = "/auth/error"` – vlastní stránka pro chybové stavy:
  - `error=Verification` – vypršel / znovu použitý odkaz,
  - `error=NoRole` – e‑mail není evidován jako rodič v Codě.

