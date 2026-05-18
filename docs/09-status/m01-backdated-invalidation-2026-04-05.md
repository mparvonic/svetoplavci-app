# M01 Backdated Invalidation Verification (2026-04-05)

## Kontext

- Prostředí: `svetoplavci_test`
- Modul: M01 (lodičky / osobní lodičky / historie)
- Cíl: opravit konfliktní historické stavy typu „pozdější oprava se starším datumem stavu“ bez mazání auditní stopy.

## Implementace

- Migrace: `20260405091500_m01_event_invalidation`
- Nová pole v `app_m01_osobni_lodicka_event`:
  - `is_invalidated`,
  - `invalidated_at`,
  - `invalidated_reason`,
  - `invalidated_by_event_id`.
- Opravný skript:
  - `scripts/m01-invalidate-backdated-corrections.mjs`.
- Projekce aktuálního stavu upravena na aktivní eventy (`is_invalidated = false`).

## Výsledek běhu

- Dry-run před opravou:
  - `candidatesTotal = 166` (první průchod, bez aplikace změn).
- Apply běh:
  - `rounds = 3`,
  - `candidatesTotal = 171`,
  - `invalidatedTotal = 171`,
  - `reason = auto_backdated_correction_superseded`.
- Dry-run po opravě:
  - `candidatesTotal = 0`.
- Verifikace projekce:
  - `projectionMismatch = 0`.

## Poznámky

- Oprava je audit-safe: eventy nejsou smazané, pouze logicky zneplatněné.
- Oprava řeší konkrétně backdated konflikty, ne jiné datové odchylky (např. chybějící řádky v CSV nebo názvoslovné rozdíly).
