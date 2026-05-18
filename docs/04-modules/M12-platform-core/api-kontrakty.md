# M12 API kontrakty (návrh)

## Identity a role

- `GET /api/core/me`
- `GET /api/core/roles`
- `POST /api/core/users/:userId/roles`
- `DELETE /api/core/users/:userId/roles/:roleId`

## Policy a oprávnění

- `POST /api/core/policy/evaluate`
- `GET /api/core/policy/rules`

## Audit

- `GET /api/core/audit/events`

## Konfigurace

- `GET /api/core/config`
- `PATCH /api/core/config`
- `GET /api/core/feature-flags`
- `PATCH /api/core/feature-flags/:flagKey`
