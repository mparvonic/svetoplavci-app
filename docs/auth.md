# Autentizace a přihlášení

## Základní pravidlo

Autentizace a autorizace běží výhradně přes interní aplikační model v PostgreSQL.

Coda se pro přihlášení, určení role ani ověření rodiče nepoužívá.

## Login identity a osoba

Přihlášení přes e-mail je oddělené od osoby:

- `AppLoginIdentity` reprezentuje login e-mail,
- `AppLoginPersonLink` reprezentuje vazbu loginu na konkrétní `AppPerson`,
- přístup je povolen jen přes vazbu se stavem `approved`.

Jedna login identita smí mít nejvýše jednu schválenou osobu. Rodinný přístup se neřeší tím, že se stejný e-mail schválí rodiči i dítěti; schválí se rodič a přístup k dítěti vzniká přes `AppPersonRelation`.

Pravidlo je vynucené:

- v admin UI výběrem jedné osoby při řešení login konfliktu,
- v API validací, že konflikt schvaluje přesně jednu osobu,
- v databázi částečným unikátním indexem pro `status = 'approved'`,
- v auth vrstvě defensivním odmítnutím více schválených osob pro jednu login identitu.

## Providers

- **Google OAuth**
  - nakonfigurovaný v `src/lib/auth.config.ts`,
  - používá ověřený Google účet jako identitu.

- **E-mail magic link**
  - nakonfigurovaný v `src/lib/auth.ts`,
  - vytváří `VerificationToken` v DB,
  - po použití token smaže.

## Flow přihlášení

1. Uživatel zadá e-mail nebo použije Google login.
2. Auth.js ověří identitu.
3. `signIn` callback zavolá interní lookup uživatele podle e-mailu.
4. Lookup vrátí profil pouze pokud existuje aktivní login identita a schválená vazba na osobu.
5. Do JWT se uloží primární role, seznam rolí a zobrazované jméno.
6. `session` callback předá role do `session.user`.

Pokud interní profil neexistuje nebo je nejednoznačný, přihlášení se odmítne.

## Role v session

Role se berou z `AppRoleAssignment`. Primární role je vybraná podle priority v `src/lib/user-directory.ts`, session zároveň nese celé pole rolí.

Aktuální role zahrnují mimo jiné:

- `rodic`,
- `zak`,
- `pruvodce`,
- `garant`,
- `spravce_lodicek`,
- `spravce_flotily`,
- `admin`,
- `tester`,
- `proto`.

## Odhlášení

Manuální odhlášení volá Auth.js `signOut`.

Automatické odhlášení po 30 minutách nečinnosti zajišťuje komponenta `InactivitySignOut`.

## Coda

Starší dokumentace popisovala ověřování přes Coda `Seznam osob`. To je historický relikt a nesmí se znovu použít. Aktuální aplikace ověřuje uživatele pouze přes interní DB.
