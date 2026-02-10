# CURL – list rows z tabulky Osobní lodičky

Do příkazů doplň z `.env.local`:
- `VAS_DOC_ID` = hodnota `CODA_DOC_ID`
- `VAS_TOKEN` = hodnota `CODA_API_TOKEN`

Tabulka: **Osobní lodičky** (id: `grid-3m-_XP8oMp`).  
Sloupec **Přezdívka** má id: `c-Bqrg4lLbml`.  
Sloupec **Jméno** má id: `c-OSMU_hlRmn`.

---

## 1) S filtrem (jen řádky pro konkrétní dítě)

Filtr: Přezdívka = "Viktorka". Můžeš změnit na jiné jméno/přezdívku.

```bash
curl -s -w "\n\nHTTP status: %{http_code}\n" \
  -H "Authorization: Bearer VAS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://coda.io/apis/v1/docs/VAS_DOC_ID/tables/grid-3m-_XP8oMp/rows?limit=20&query=c-Bqrg4lLbml%3A%22Viktorka%22"
```

`query` je v URL zakódované: `c-Bqrg4lLbml:"Viktorka"` → `c-Bqrg4lLbml%3A%22Viktorka%22`

Alternativa – filtr podle sloupce Jméno:

```bash
curl -s -w "\n\nHTTP status: %{http_code}\n" \
  -H "Authorization: Bearer VAS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://coda.io/apis/v1/docs/VAS_DOC_ID/tables/grid-3m-_XP8oMp/rows?limit=20&query=c-OSMU_hlRmn%3A%22Viktorka%22"
```

---

## 2) Bez filtru (první stránka celé tabulky)

```bash
curl -s -w "\n\nHTTP status: %{http_code}\n" \
  -H "Authorization: Bearer VAS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://coda.io/apis/v1/docs/VAS_DOC_ID/tables/grid-3m-_XP8oMp/rows?limit=20"
```

---

Porovnej výstup a HTTP status:
- **S filtrem**: 200 + řádky, nebo 422 (tabulka přes limit).
- **Bez filtru**: 200 + řádky, nebo 422.

Pokud **s filtrem** dostaneš 422 a **bez filtru** 200, Coda u této tabulky odmítá parametr `query`.
