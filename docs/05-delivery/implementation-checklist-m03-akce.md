# Implementační checklist M03: Akce

## Fáze A1 – Datový základ

- [x] Rozšířit DB schéma o entity M03 (série, šablony, cílení, snapshot, nabídky, registrace, docházka, module links).
- [x] Doplnit enumy a stavový model akce.
- [x] Doplnit locky pro vazbu na rozvrh (`time_override_lock` minimálně).
- [x] Přidat migrační SQL + validační constrainty.

## Fáze A2 – Doménová pravidla

- [x] Implementovat publish workflow s generováním snapshotu účastníků.
- [x] Implementovat uzávěrku registrací + volitelný snapshot při uzávěrce.
- [x] Implementovat výjimky průvodce po uzávěrce (audit).
- [x] Implementovat pravidla nabídky akcí (`AT_MOST_ONE` / `EXACTLY_ONE`).

## Fáze A3 – Integrace rozvrh/kalendáře

- [x] Resolver vazby akce -> hodina (aktuální rozvrh + změnový).
- [x] Sync do kalendáře podle `calendar_behavior` typu akce.
- [x] Při `time_override_lock=true` zakázat přepis času z rozvrhu.
- [x] Doplnit provozní joby a retry strategii.

## Fáze A4 – API a UI

- [ ] API pro CRUD typů akcí a šablon.
- [ ] API pro CRUD akcí.
- [x] API endpoint pro lifecycle: publish / close_registration / manual snapshot.
- [x] API endpoint pro registrace (včetně výjimky po uzávěrce).
- [x] API endpoint pro refresh navázané hodiny z rozvrhu (respektuje override locky).
- [x] API endpoint pro enqueue/list kalendářového syncu akce.
- [x] API endpoint pro spuštění calendar sync workeru.
- [ ] API pro docházku.
- [ ] UI pro průvodce + UI pro žáka/rodiče.

## Fáze A5 – Rozšíření

- [ ] Přidat module links (lodičky, portfolio, hodnocení).
- [ ] Přidat publikaci veřejných akcí na veřejný web.
- [ ] Přidat reporting účasti a naplněnosti akcí.

## Fáze A6 – Jednorázový převod Ostrovů z Coda (2025/2026)

- [x] Připravit runbook převodu (`docs/07-operations/runbooks/m03-ostrovy-coda-import-2025-2026-runbook.md`).
- [ ] Připravit export snapshotu Coda tabulek Ostrovy/Zápisy/Termíny.
- [ ] Připravit mapovací report žáků (včetně neaktivních, chybějících a `#r...` referencí).
- [ ] Doplnit ruční override mapu pro sporné osoby.
- [ ] Spustit dry-run import na `svetoplavci_test`.
- [ ] Zapsat validační report po dry-run do `docs/09-status/`.
- [ ] Spustit ostrý import na produkci.
