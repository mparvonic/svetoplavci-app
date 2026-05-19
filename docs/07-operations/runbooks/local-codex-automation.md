# Local Codex Automation

This repository is edited from Codex on Miroslav's Mac through the GX10 NFS mount:

```text
/Users/miroslav/Projects/gx10/srv/projects/svetoplavci-app
```

The canonical GX10 checkout is:

```text
/srv/projects/svetoplavci-app
```

Runtime secrets stay outside Git. Scripts load env in this order and never print values:

1. repo `.env.local`
2. GX10 native `/data/projects/svetoplavci-app/secrets/env.local`
3. Mac-mounted `/Users/miroslav/Projects/gx10/data/projects/svetoplavci-app/secrets/env.local`

## Agent Defaults

Agents must not rediscover the environment from scratch. Use these commands first:

```bash
npm run ops:doctor
npm run dev:up
```

`ops:doctor` reports the current mount, SSH reachability, env presence, DB tunnel state, Next dev state, and git branch state.

`dev:up` does the full local startup:

1. verifies the GX10 mount when running on the Mac,
2. loads runtime env without printing secrets,
3. installs dependencies with `npm ci` if needed,
4. starts the DB tunnel watchdog,
5. reuses an existing Next dev process for this checkout when it finds one,
6. otherwise starts Next dev in the foreground on `http://127.0.0.1:3000` or the next free port.

When Codex starts `dev:up`, it should keep the returned terminal session running while browser testing. Stop the foreground server with Ctrl-C in that session. If a legacy background server was started from a normal terminal, stop it with:

```bash
npm run dev:down
```

The DB tunnel is considered ready when `127.0.0.1:5433` is open. If it is already open, scripts do not restart it.

## Release Commands

Do not hand-roll branch or deploy procedures. Use:

```bash
npm run release:status
npm run release:test -- --message "fix: short summary"
npm run release:prod
```

`release:test`:

- commits local changes when `--message` is provided,
- runs release checks through `npm run release:checks`,
- pushes the current branch,
- if already on `staging`, the push triggers the staging image and Coolify test deploy,
- if on a feature/fix branch, creates or reuses a PR into `staging`.

Optional:

```bash
npm run release:test -- --message "fix: short summary" --auto-merge
```

This asks GitHub to merge the PR automatically once required checks allow it.

`release:prod`:

- must be run from `staging`,
- requires a clean working tree,
- runs release checks through `npm run release:checks`,
- pushes `staging`,
- creates or reuses a PR `staging -> main`.

Optional:

```bash
npm run release:prod -- --auto-merge
```

This asks GitHub to merge `staging -> main` automatically once required checks allow it. The merge to `main` triggers the production image and Coolify production deploy.

`release:checks` runs locally on non-mounted checkouts. From the Mac GX10 mount, it creates a clean temporary checkout on GX10 from `git archive HEAD`, installs Linux-native dependencies with `npm ci`, then runs lint and build there. This avoids mixing macOS and Linux native packages in the shared mounted repository.

## Fixed Environment Map

| Target | Branch | URL | Deploy trigger |
|---|---|---|---|
| local | current branch | `http://127.0.0.1:3000` | `npm run dev:up` |
| test | `staging` | `https://test-app.svetoplavci.cz` | push/merge to `staging` |
| production | `main` | `https://app.svetoplavci.cz` | merge to `main` |

The current test host is `test-app.svetoplavci.cz`.
