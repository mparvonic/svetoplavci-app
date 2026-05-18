# M12 Doménový model

## Entity

- `User`
- `Role`
- `Permission`
- `UserRoleAssignment`
- `PolicyRule`
- `AuditEvent`
- `SystemConfig`
- `FeatureFlag`
- `IntegrationCredentialRef`

## Invarianty

- Kritická operace bez oprávnění musí být odmítnuta.
- Kritická změna bez auditního eventu je invalidní stav.
- Konfigurační změny jsou verzované.
