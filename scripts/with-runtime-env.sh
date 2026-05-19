#!/usr/bin/env sh
set -eu

if [ -f ./.env.local ]; then
  ENV_FILE=./.env.local
elif [ -f /data/projects/svetoplavci-app/secrets/env.local ]; then
  ENV_FILE=/data/projects/svetoplavci-app/secrets/env.local
elif [ -f /Users/miroslav/Projects/gx10/data/projects/svetoplavci-app/secrets/env.local ]; then
  ENV_FILE=/Users/miroslav/Projects/gx10/data/projects/svetoplavci-app/secrets/env.local
else
  ENV_FILE=
fi

if [ -n "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

exec "$@"
