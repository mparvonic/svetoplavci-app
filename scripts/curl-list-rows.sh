#!/bin/bash
# Načtení řádků z tabulky Osobní lodičky (grid-3m-_XP8oMp).
# Nastav DOC_ID a TOKEN z .env.local (nebo exportuj).
#
# S FILTREM (query) – jen řádky, kde Přezdívka = "Viktorka":
#   ./scripts/curl-list-rows.sh with-filter
#
# Bez filtru (celá tabulka – může vrátit 422 nebo první stránku):
#   ./scripts/curl-list-rows.sh no-filter

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Chybí $ENV_FILE"
  exit 1
fi

source "$ENV_FILE" 2>/dev/null || true
# Načtení bez source (bez exportu)
while IFS= read -r line; do
  if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*=(.*)$ ]]; then
    key="${line%%=*}"; key="${key// /}"
    val="${line#*=}"; val="${val#[\"']}"; val="${val%[\"']}"
    case "$key" in
      CODA_DOC_ID) DOC_ID="$val" ;;
      CODA_API_TOKEN) TOKEN="$val" ;;
    esac
  fi
done < "$ENV_FILE"

if [[ -z "$DOC_ID" || -z "$TOKEN" ]]; then
  echo "V .env.local nastav CODA_DOC_ID a CODA_API_TOKEN."
  exit 1
fi

TABLE_ID="grid-3m-_XP8oMp"
BASE="https://coda.io/apis/v1"
URL="${BASE}/docs/${DOC_ID}/tables/${TABLE_ID}/rows?limit=20"

case "${1:-}" in
  with-filter)
    # Filtr: sloupec Přezdívka (c-Bqrg4lLbml) = "Viktorka"
    # Můžeš změnit na jméno jiného dítěte.
    QUERY='c-Bqrg4lLbml:"Viktorka"'
    QUERY_ENC=$(printf %s "$QUERY" | jq -sRr @uri)
    echo "Volám API S filtrem: query=$QUERY"
    echo ""
    curl -s -w "\n\nHTTP status: %{http_code}\n" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      "${URL}&query=${QUERY_ENC}"
    ;;
  no-filter)
    echo "Volám API BEZ filtru (celá tabulka)."
    echo ""
    curl -s -w "\n\nHTTP status: %{http_code}\n" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      "$URL"
    ;;
  *)
    echo "Použití:"
    echo "  $0 with-filter   # s filtrem Přezdívka = Viktorka"
    echo "  $0 no-filter     # bez filtru"
    echo ""
    echo "Pouze CURL příkaz (s filtrem), aby šel zkopírovat:"
    QUERY_ENC=$(printf %s 'c-Bqrg4lLbml:"Viktorka"' | jq -sRr @uri)
    echo "curl -s -H \"Authorization: Bearer \$TOKEN\" -H \"Content-Type: application/json\" \"${BASE}/docs/\${DOC_ID}/tables/${TABLE_ID}/rows?limit=20&query=${QUERY_ENC}\""
    exit 0
    ;;
esac
