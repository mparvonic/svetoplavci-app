# Snapshot Coda dokumentu pro migraci do Supabase

**Dokument ID:** `JkxyWdl0hd`  
**Vygenerováno:** 2026-03-14T15:22:23.911Z

---

## 1. Přehled tabulek

| ID | Název | Typ | Počet sloupců | Poznámka |
|----|-------|-----|----------------|----------|
| `grid-cWYDOpU4W9` | Školní roky | table | 4 | base table |
| `grid-U2jvWHgxPp` | Plavby | table | 4 | base table |
| `grid-h9VA2F_PQJ` | Akce | table | 5 | base table |
| `grid-TSLoazaPIn` | Forma vzdělávání | table | 4 | base table |
| `grid-NIFglsnOuF` | Typy akcí | table | 4 | base table |
| `grid-qVgZu8K-hT` | Skupiny | table | 2 | base table |
| `grid-vRCoTYBev1` | Smečky | table | 5 | base table |
| `grid-PIwfgW7bQU` | Seznam osob | table | 30 | base table |
| `grid-sync-22507-RowDataObject-dynamic-6051ed51ead79cd17416dae3d4eb57ac73a0ad71c223208509d32fe7c6ddf905` | Knihy | table | 14 | base table |
| `grid-sync-22507-RowDataObject-dynamic-60504e5e3c8872209c56da1ea9e1b9bbe8b13372edba4fff74730c3093448006` | Exemplare | table | 9 | base table |
| `grid-kbiJMhk2AX` | ByteMap | table | 2 | base table |
| `grid-rymMl4ke9z` | Ostrovy | table | 16 | base table |
| `grid-w_IYf36yhN` | Zápisy | table | 10 | base table |
| `grid-2JIQawnpAw` | Typy techniky | table | 2 | base table |
| `grid-rB-8NlPp4I` | Seznam techniky | table | 9 | base table |
| `grid-vxTNxHZKF_` | Výpůjčky | table | 9 | base table |
| `grid-iC0FEud3y5` | ObecneCasti | table | 6 | base table |
| `grid-x9DsInP2K-` | Kapitoly | table | 6 | base table |
| `grid-gKIulNNUzT` | Podkapitoly | table | 5 | base table |
| `grid-hpV4zXsyKS` | OVU_Sample | table | 17 | base table |
| `grid-ISv0Xsvuo0` | data_final_rvp_zv_full_mp_20250624 | table | 25 | base table |
| `grid-WFUPhnSRd3` | OVU_from25MB_clean | table | 20 | base table |
| `grid-ax-9xcoYzh` | Učebny | table | 2 | base table |
| `grid-tKkiEMWXEO` | Lodičky od 1.9.2025 | table | 19 | base table |
| `grid-DQ9u7UNhqP` | Předměty | table | 7 | base table |
| `grid-RqbKIDnZDM` | Podpředměty | table | 9 | base table |
| `grid-3m-_XP8oMp` | Osobní lodičky | table | 38 | base table |
| `grid-Tx2g73oOp5` | Stupně lodiček | table | 3 | base table |
| `grid-nYzDRw4zl3` | Historie lodiček | table | 20 | base table |
| `grid-cd-a7lAkYK` | Seznam rolí | table | 1 | base table |
| `table-E8XnaMNtfK` | Osobní lodičky v tabulce | view | 12 | view |
| `grid-Sc-ZdJiUoP` | Slovní hodnocení | table | 18 | base table |
| `grid-JBy0pWZIC5` | Hodnotící období | table | 4 | base table |
| `grid-sCWXYfO6Zu` | Stupně hodnocení | table | 4 | base table |
| `table-kr7a17ip5t` | Hodnocení pro vysvědčení | view | 10 | view |
| `grid-77pv1Grcpi` | Oblasti vysvědčení | table | 8 | base table |
| `table-bqvtwKXWE_` | Vysvědčení - slovní hodnocení | view | 4 | view |
| `grid-1Dw5aBDZkX` | Předměty vysvědčení | table | 7 | base table |
| `grid-Fo7THNgdeq` | Vysvědčení - hodnocení oblastí | table | 27 | base table |
| `grid-Ia-EtsvQDd` | Vysvědčení - hodnocení předmětů | table | 21 | base table |
| `grid-WRLBZgw4Vo` | Křivka plnění lodiček | table | 11 | base table |
| `grid-sYxvVev2h2` | Známková pásma | table | 3 | base table |
| `table-oJLgfv_KMf` | Oblasti pro tisk | view | 10 | view |
| `table-kVhETmlU2x` | Předměty pro tisk | view | 6 | view |
| `table-oCLreazO22` | Hodnocení předmětů | view | 5 | view |
| `table-NbDPhMF4ci` | Hodnocení oblastí | view | 9 | view |
| `table-GiM1EvB6LU` | Rodiče | view | 10 | view |
| `table-RuXGEEn2z4` | Lodičky dítěte | view | 7 | view |
| `table-1wVyfFAjX2` | Lodičky dítěte po plavbách | view | 10 | view |
| `table-yEEWei_5V6` | 1. ročník | view | 20 | view |
| `table-Ne5GJTiRsp` | 2. ročník | view | 20 | view |
| `table-dlHd_OQzDo` | 3. ročník | view | 20 | view |
| `table-XNp8CBW4b4` | 4. ročník | view | 20 | view |
| `table-o85zm2oqc_` | Hodnocení předmětů export | view | 6 | view |
| `table-TbzZTQK1dj` | Hodnocení oblastí export | view | 10 | view |
| `table-4ZVEPvhpqK` | 5. ročník | view | 20 | view |
| `table-LwY7_9SdqF` | 6. ročník | view | 20 | view |
| `table-bvqhgv4t6f` | 7. ročník | view | 20 | view |
| `table-Jc9Ad8G8Cp` | 8. ročník | view | 20 | view |
| `table-q6HV_Va-gc` | 9. ročník | view | 20 | view |

---

## 2. Env proměnné (mapování tabulek)

| Proměnná | Hodnota (ID tabulky/view) |
|----------|---------------------------|
| `CODA_TABLE_SEZNAM_OSOB` | `grid-PIwfgW7bQU` |
| `CODA_TABLE_HODNOCENI_PREDMETU` | `table-o85zm2oqc_` |
| `CODA_TABLE_HODNOCENI_OBLASTI` | `table-TbzZTQK1dj` |
| `CODA_TABLE_CURVE` | — |
| `CODA_VIEW_1_ROCNIK` | `table-yEEWei_5V6` |
| `CODA_VIEW_2_ROCNIK` | `table-Ne5GJTiRsp` |
| `CODA_VIEW_3_ROCNIK` | `table-dlHd_OQzDo` |
| `CODA_VIEW_4_ROCNIK` | `table-XNp8CBW4b4` |
| `CODA_VIEW_5_ROCNIK` | — |
| `CODA_VIEW_6_ROCNIK` | — |
| `CODA_VIEW_7_ROCNIK` | — |
| `CODA_VIEW_8_ROCNIK` | — |
| `CODA_VIEW_9_ROCNIK` | — |

---

## 3. Struktura tabulek a sloupců

### Školní roky (`grid-cWYDOpU4W9`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Školní rok | `c-oWPFO-TZaY` | ano | ne | — | text |
| Od | `c-jy-_xK9wBX` | ne | ne | — | date |
| Do | `c-xfwCWvxNth` | ne | ne | — | date |
| Plavby | `c-OM6siWkPHA` | ne | ano | Plavby.Filter([Školní rok].Contains(thisRow)) | lookup |

### Plavby (`grid-U2jvWHgxPp`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Plavba | `c-tVkEbCY9Eu` | ano | ne | — | number |
| Od | `c-PMl0FM9I1c` | ne | ne | — | date |
| Do | `c-j3xGu46Uyx` | ne | ne | — | date |
| Školní rok | `c-7KjZCmmJSm` | ne | ne | — | lookup |

### Akce (`grid-h9VA2F_PQJ`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Name | `c-jPK6M7GVmA` | ano | ne | — | text |
| Od | `c-7RjAhrW6PF` | ne | ne | — | date |
| Do | `c-vBnmJXAtQr` | ne | ne | — | date |
| Typy akcí | `c-0OfwClPBOo` | ne | ne | — | lookup |
| Skupiny | `c-q3lA2Gdwan` | ne | ne | — | lookup |

### Forma vzdělávání (`grid-TSLoazaPIn`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Name | `c-LOZyN0sUan` | ano | ne | — | text |
| Column 2 | `c-atBoqRtLLP` | ne | ne | — | text |
| Column 3 | `c-OKGP59FXES` | ne | ne | — | text |
| Notes | `c-H9faCiw83K` | ne | ne | — | canvas |

### Typy akcí (`grid-NIFglsnOuF`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Name | `c-2P6Eh1njif` | ano | ne | — | text |
| Probíhá výuka | `c-EDfhDIc3uy` | ne | ne | — | checkbox |
| Probíhají ostrovy | `c-kwAkIGVDeh` | ne | ne | — | checkbox |
| Notes | `c-qskW2k5Pjj` | ne | ne | — | canvas |

### Skupiny (`grid-qVgZu8K-hT`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Skupina | `c-kYw1E0nL3g` | ano | ne | — | text |
| Obsahuje | `c-f1BUr8KrO0` | ne | ne | — | lookup |

### Smečky (`grid-vRCoTYBev1`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Smečka | `c-oLkWNzrNik` | ano | ne | — | text |
| Patron | `c-skKYOKoLrM` | ne | ne | — | lookup |
| Učebna | `c-O3JhyLG-fw` | ne | ne | — | lookup |
| Seznam | `c-EAZGv7j5AL` | ne | ano | [Seznam osob].Filter([Smečka].Contains(thisRow)) | lookup |
| Školní rok | `c-MQAtyJem6F` | ne | ne | — | lookup |

### Seznam osob (`grid-PIwfgW7bQU`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| ID | `c-4zBzeJEcjZ` | ne | ne | — | number |
| Křestní | `c-hJKW60xeO1` | ne | ne | — | text |
| Příjmení | `c-GMLYzGw8ke` | ne | ne | — | text |
| Věk | `c-J0KIy-fNmk` | ne | ne | — | number |
| Zapsán od | `c-znIkzbIRk9` | ne | ne | — | date |
| Vyřazen od | `c-UlMt8uwnDI` | ne | ne | — | date |
| Identifikátor | `c-5nG1glNg-o` | ne | ne | — | text |
| Primární e-mail | `c-dYUboRJFlY` | ne | ne | — | text |
| Třída | `c-hHZjjYF1CJ` | ne | ne | — | select |
| Kód vzdělvání | `c-XCYyjAf-ma` | ne | ne | — | text |
| Počáteční ročník | `c-Fd7lTBzEmr` | ne | ne | — | number |
| Aktuální ročník | `c-zqfeZZPsqm` | ne | ne | — | select |
| Aktivní | `c-uLx5khljlC` | ne | ano | If(IsBlank([Vyřazen od]),true,false) | checkbox |
| Jméno | `c-MzlgfRju0X` | ne | ano | [Křestní]+" "+[Příjmení] | text |
| Docházka | `c-cxXNqOz_kN` | ne | ano | Switch([Kód vzdělvání],11 ,"Denní",30,"Zahraniční",21,"IV" ) | select |
| Přezdívka | `c--RSuRrZPWK` | ano | ne | [Křestní]+" "+Left([Příjmení],1 )+"." | text |
| Čip UID | `c-vK7cxXAbsd` | ne | ne | — | text |
| Čip HID | `c-oR1sYBHd2C` | ne | ne | If(   Trim([Čip UID]) = "",   "",   WithName(Upper(Trim([Čip | text |
| User | `c-rgD7fymETS` | ne | ne | — | person |
| Organizace | `c-BgE__HgFyE` | ne | ne | — | text |
| UUID | `c-9c3m0yh-dm` | ne | ne | — | text |
| Role | `c-aI2b_O-scX` | ne | ne | — | lookup |
| Přezdívka TTS | `c-UfOIh9PNQb` | ne | ne | [Křestní] | text |
| Oslovení TTS | `c-uVW9sfYm2R` | ne | ne | [Křestní] | text |
| Smečka | `c-HuunarLxmI` | ne | ne | — | lookup |
| Fotka | `c-prBoPVwTlA` | ne | ne | — | image |
| Ročník | `c-htPmrPqL_r` | ne | ano | WithName(   Skupiny.Filter(Skupina = [Aktuální ročník].ToTex | lookup |
| Kontaktní maily | `c-G9HEPv7cRM` | ne | ne | — | select |
| Děti | `c-9SFUzViDLO` | ne | ne | — | lookup |
| Rodiče | `c-myPyzcpQgD` | ne | ano | [Seznam osob].Filter([Děti].Contains(thisRow)) | lookup |

### Knihy (`grid-sync-22507-RowDataObject-dynamic-6051ed51ead79cd17416dae3d4eb57ac73a0ad71c223208509d32fe7c6ddf905`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Row | `value` | ne | ne | — | packObject |
| Synced | `synced` | ne | ne | — | checkbox |
| Sync account | `connection` | ne | ne | — | lookup |
| Sheet row id | `c-JPSm1NdvM0` | ne | ne | — | text |
| Synchronized on | `c-ksqX0gBB5U` | ne | ne | — | dateTime |
| Row range | `c--hVjauWd8d` | ne | ne | — | text |
| ID | `c-Tpciha2WTv` | ne | ne | — | text |
| Cover | `c-t0eZvxTDIT` | ne | ne | — | text |
| Autor | `c-IHYJp-k39D` | ne | ne | — | text |
| Kategorie | `c--E_ptoKmuI` | ne | ne | — | select |
| Popis | `c-50JjXVpwMA` | ne | ne | — | text |
| Nazev | `c-6Af-ZpjmVV` | ano | ne | — | text |
| Kratky popis | `c-xXpzEXnyhb` | ne | ne | — | text |
| Exemplare | `c-Vr4l8K0sb0` | ne | ano | Exemplare.Filter(Kniha.Contains(thisRow)) | lookup |

### Exemplare (`grid-sync-22507-RowDataObject-dynamic-60504e5e3c8872209c56da1ea9e1b9bbe8b13372edba4fff74730c3093448006`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Row | `value` | ne | ne | — | packObject |
| Synced | `synced` | ne | ne | — | checkbox |
| Sync account | `connection` | ne | ne | — | lookup |
| Sheet row id | `c-SQv1fdO97u` | ne | ne | — | text |
| Synchronized on | `c-XgiJ8NIWlo` | ne | ne | — | dateTime |
| Row range | `c-0cGcc-dHJ4` | ano | ne | — | text |
| Book ID | `c-PaAXkFIN-Y` | ne | ne | — | text |
| Barcode | `c-ulIs0lWyf2` | ne | ne | — | text |
| Kniha | `c-QH2EaA9FXN` | ne | ano | Knihy.Filter(ID = ToNumber([Book ID])).First() | lookup |

### ByteMap (`grid-kbiJMhk2AX`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Byte | `c-cTncuH1jgE` | ano | ne | — | text |
| Value | `c-LI8KKomA6B` | ne | ne | — | number |

### Ostrovy (`grid-rymMl4ke9z`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Název | `c-hfuicPzxZw` | ne | ne | — | text |
| Průvodce | `c-UX9psN707o` | ne | ne | [rowJáJsemPrůvodce] | lookup |
| Popisek | `c-XDcc_oUTfR` | ne | ne | — | text |
| Zapsaní žáci | `c-uhH8C8ix5p` | ne | ano | [Zápisy].Filter(Ostrov.Contains(thisRow)) | lookup |
| Výsledné hodnocení | `c-5Zhes4gqyn` | ne | ne | — | text |
| Datum | `c-tYlkGqHb58` | ne | ne | — | lookup |
| Místo | `c-NxEURmbmQ2` | ne | ne | — | lookup |
| Max dětí | `c-fqszrzFcJQ` | ne | ne | — | number |
| OSTROV | `c-EQS33vkSSQ` | ano | ano | [Název] + LineBreak() + "(" + [Průvodce].Jmeno +   ", " +    | text |
| Skupiny | `c-rElDBTFfEN` | ne | ne | — | lookup |
| Volná místa | `c-_KbbHH9ZtZ` | ne | ano | [Max dětí]-[Zapsaní žáci].Count() | number |
| TentoTýden | `c-EVnBmbHUeb` | ne | ano | IsoWeekNumber(Today())=IsoWeekNumber(Datum.Datum) AND  Year( | checkbox |
| Obrázek | `c-Dz-SvulhnS` | ne | ne | — | image |
| Zápis | `c-B2DL-bElv3` | ne | ano | — | button |
| Typ | `c-hSV-aRBbua` | ne | ne | — | select |
| PopisekNeorezany | `c-oCq1NuwjZ6` | ne | ano | Popisek._color("#000000") | select |

### Zápisy (`grid-w_IYf36yhN`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Zak | `c-IoPb2s7lZ3` | ano | ne | — | lookup |
| Termin | `c-4JGguF_-oB` | ne | ne | — | lookup |
| Ostrov | `c-LvS7OlmnE7` | ne | ne | — | lookup |
| Hodnoceni | `c--JjuZNGAfu` | ne | ne | — | text |
| Typ | `c-98CcUqt7zB` | ne | ano | Ostrov.Typ | select |
| Datum | `c-Og9j81kjyu` | ne | ano | Termin.Datum | date |
| Jmeno zaka | `c-gHWgB9TIcQ` | ne | ano | Zak.[Roc jm pr] | text |
| Created on | `c-Y_NwZi0T2p` | ne | ano | thisRow.Created() | dateTime |
| Pruvodce | `c-BIyuuhqoiP` | ne | ano | Ostrov.[Průvodce] | lookup |
| Škrtnout | `c-wRaNQZcYot` | ne | ano | — | button |

### Typy techniky (`grid-2JIQawnpAw`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Typ | `c-TUXbVD4CCn` | ano | ne | — | text |
| Kód | `c-cdUeKjDlIC` | ne | ne | — | text |

### Seznam techniky (`grid-rB-8NlPp4I`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Typ | `c-VNE7N3PFjb` | ne | ne | — | text |
| Číslo kusu | `c-mn9lqYPklj` | ne | ne | Format("{1:000}", ToNumber(Max([Číslo kusu])) + 1) | text |
| ID | `c-oz32kGPS9E` | ne | ano | Concatenate(   "T",   [Typy techniky].Filter(Typ=Typ).[Kód]. | text |
| Předmět | `c-fAla8Fu8T4` | ano | ne | — | text |
| Sériové číslo | `c-k-OxhtafQa` | ne | ne | — | text |
| Místo uložení | `c-bYtoz0cYuf` | ne | ne | — | text |
| Výpůjčky | `c-zhPJDP0h9D` | ne | ano | [Výpůjčky].Filter([Předmět].Contains(thisRow)) | lookup |
| Stav | `c-RxjIjlL9dB` | ne | ne | — | select |
| Obrázek | `c-t2SEGtEBUD` | ne | ne | — | image |

### Výpůjčky (`grid-vxTNxHZKF_`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c--Q_zCoAOcM` | ano | ne | — | lookup |
| Stav | `c-EDMOmz19io` | ne | ne | — | select |
| Uživatel | `c-O65VZuIc4T` | ne | ne | — | lookup |
| Čas výpůjčky | `c-HS-UJ7rVKM` | ne | ano | thisRow.Created() | dateTime |
| ID | `c-hs9L5H1bMn` | ne | ano | [Předmět].ID | text |
| Místo uložení | `c-7fpMBQxLVA` | ne | ano | [Předmět].[Místo uložení] | text |
| Délka výpůjčky | `c-Gm5phXi2gY` | ne | ano | WithName(Now() - [Čas výpůjčky], diff,   If(     diff < 1,   | text |
| Typ | `c-R181k-D1s4` | ne | ano | [Předmět].Typ | text |
| Obrázek | `c-HIea6Hp53n` | ne | ano | [Předmět].[Obrázek] | image |

### ObecneCasti (`grid-iC0FEud3y5`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Kod | `c-61QUxkyvmc` | ne | ne | — | text |
| Nazev | `c-foUt7PHmv7` | ano | ne | — | text |
| Charakteristika RAW | `c-4A8UhSHW0M` | ne | ne | — | canvas |
| Charakteristika | `c-ATUzo6CSPy` | ne | ano | [HTML Renderer]RenderHtml([Charakteristika RAW]) | text |
| Parent | `c-nrmsjZmi7J` | ne | ne | — | lookup |
| Subitems | `c-t3nvwovTk5` | ne | ano | ObecneCasti.Filter(Parent.Contains(thisRow)) | lookup |

### Kapitoly (`grid-x9DsInP2K-`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| ID | `c-53Grd0TUoD` | ano | ne | — | text |
| ObecnaCastKod | `c-2iOqKj8IEX` | ne | ne | — | select |
| Nazev | `c-vHOK3ROH64` | ne | ne | — | text |
| Charakteristika | `c-PZM2IGwkYp` | ne | ne | — | text |
| MetodickyKomentar | `c-OiWklUFUwu` | ne | ne | — | text |
| PovolenyPodkapitoly | `c-vtqTnb1eek` | ne | ne | — | checkbox |

### Podkapitoly (`grid-gKIulNNUzT`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| ID | `c-9W-NkuDHNq` | ano | ne | — | text |
| KapitolaID | `c-UH_kuMMAjZ` | ne | ne | — | select |
| Nazev | `c-haC0omxvG1` | ne | ne | — | text |
| Charakteristika | `c-o9oNxvgSiV` | ne | ne | — | text |
| MetodickyKomentar | `c-hya_Qg9qW2` | ne | ne | — | text |

### OVU_Sample (`grid-hpV4zXsyKS`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| OVU_kod | `c-le4ivN8OA3` | ano | ne | — | text |
| OVU_zneni | `c-3e5ZoBJmME` | ne | ne | — | text |
| OVU_popis | `c-kdmG-PWo5Q` | ne | ne | — | text |
| OVU_hodnoty | `c--WwJ-zDCZg` | ne | ne | — | text |
| OVU_predchozi | `c-1QBRfpFD5a` | ne | ne | — | text |
| OVU_souvisejici | `c-o6JjMBLCr1` | ne | ne | — | text |
| OVU_nasledujici | `c-SxqAFshzEn` | ne | ne | — | text |
| OVU_UMP | `c-sgmUulWxY7` | ne | ne | — | text |
| Level1_typ | `c-CrSV9cjZuo` | ne | ne | — | text |
| Level1_nazev | `c-hKEl4Dz4qX` | ne | ne | — | text |
| Level1_kod | `c-N8j20sWACB` | ne | ne | — | text |
| Level2_nazev | `c-bHlBCaa7PV` | ne | ne | — | text |
| Level2_kod | `c-OZw-S2QqV0` | ne | ne | — | text |
| Level3_nazev | `c-lHAmfXk568` | ne | ne | — | text |
| Level3_kod | `c-Ro8Mk0qDWL` | ne | ne | — | number |
| Level4_nazev | `c-AX3cSt-Ddw` | ne | ne | — | select |
| Level4_kod | `c-TBsQ6IQzyy` | ne | ne | — | text |

### data_final_rvp_zv_full_mp_20250624 (`grid-ISv0Xsvuo0`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Typ aktuální entity v řádku | `c-2MKW2wvT8I` | ano | ne | — | select |
| Typ hlavní entity | `c-Wk2JD2Vi-J` | ne | ne | — | select |
| Hlavní entita - Kód | `c-0eJHrNaZq9` | ne | ne | — | text |
| Hlavní entita - Název | `c-EZpS7ZL4KC` | ne | ne | — | text |
| Hlavní entita - Charakteristika | `c-Xmn8goHT8V` | ne | ne | — | canvas |
| Sekundární entita - Kód | `c-TFQOwIzx_P` | ne | ne | — | text |
| Sekundární entita - Název | `c-XkOZjnIy72` | ne | ne | — | text |
| Sekundární entita - Charakteristika | `c-11yerGg5YM` | ne | ne | — | text |
| Terciární entita - Kód | `c-Oz_GYXjzLJ` | ne | ne | — | select |
| Terciární entita - Název | `c-dKafxaux3H` | ne | ne | — | text |
| Terciární entita - Charakteristika | `c-tspNJrS2eU` | ne | ne | — | text |
| Uzlový bod - Kód | `c-nDJy1xw_sB` | ne | ne | — | select |
| Uzlový bod - Název | `c-jrVR6AkQGd` | ne | ne | — | select |
| Očekávaný výsledek učení - Kód | `c-YdoDGYvNvC` | ne | ne | — | text |
| Očekávaný výsledek učení - Znění | `c-aBBk7kajov` | ne | ne | — | text |
| Očekávaný výsledek učení - Charakteristika a zdůvodnění | `c-39v1p_3ABi` | ne | ne | — | text |
| Očekávaný výsledek učení - Hodnoty | `c-T4DuhFjLl0` | ne | ne | — | select |
| Předcházející očekávané výsledky učení - Kódy | `c-zvJ4A8-8zU` | ne | ne | — | text |
| Související očekávané výsledky učení - Kódy | `c-vSgwRx73OG` | ne | ne | — | text |
| Nadcházející očekávané výsledky učení - Kódy | `c-Zc-4VYPoSb` | ne | ne | — | text |
| Úroveň metodické podpory - Název | `c-zVzFIyJZku` | ne | ne | — | select |
| Úroveň metodické podpory - Charakteristika | `c-Br84hOySEg` | ne | ne | — | text |
| Ilustrace - Název | `c-a_NtvkliGG` | ne | ne | — | text |
| Ilustrace - Charakteristika | `c-Jo2ftWh2RA` | ne | ne | — | text |
| Ilustrace - URL | `c-PiJIo7HT35` | ne | ne | — | text |

### OVU_from25MB_clean (`grid-WFUPhnSRd3`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| OVU_kod | `c-5Vjjy00SKO` | ano | ne | — | text |
| OVU_zneni | `c-cEM11baxgv` | ne | ne | — | text |
| OVU_popis | `c--Eg5YOcrK_` | ne | ne | — | text |
| OVU_hodnoty | `c-_TJKO6nYtj` | ne | ne | — | select |
| OVU_predchozi | `c-v8WWaLhi9C` | ne | ne | — | text |
| OVU_souvisejici | `c-2zxinfQMwa` | ne | ne | — | text |
| OVU_nasledujici | `c-YmNg-pUET0` | ne | ne | — | text |
| Level1_typ | `c-QKnWVphmQ6` | ne | ne | — | select |
| Level1_kod | `c-lAqy12h0sH` | ne | ne | — | text |
| Level1_nazev | `c-M9skyttlcQ` | ne | ne | — | text |
| Level1_char | `c-No1HVQ0g2x` | ne | ne | — | text |
| Level2_kod | `c-PnJoEFoJjk` | ne | ne | — | text |
| Level2_nazev | `c-wQfIzm8qPo` | ne | ne | — | text |
| Level2_char | `c-mlxtAkZnc-` | ne | ne | — | text |
| Level3_kod | `c-BCdHs-_cmu` | ne | ne | — | text |
| Level3_nazev | `c--FacaxbErd` | ne | ne | — | text |
| Level3_char | `c-RivPXl3ARZ` | ne | ne | — | text |
| Level4_kod | `c-_XheklQq9r` | ne | ne | — | select |
| Level4_nazev | `c-zq4MdLlifq` | ne | ne | — | select |
| OVU_UMP | `c-ik0VOyC5MD` | ne | ne | — | text |

### Učebny (`grid-ax-9xcoYzh`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Name | `c-ffkH_6cqqb` | ano | ne | — | text |
| Barva | `c-ExZguppFBb` | ne | ne | — | text |

### Lodičky od 1.9.2025 (`grid-tKkiEMWXEO`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-vzPPuecB46` | ne | ne | — | lookup |
| Podpředmět | `c-5lfbCRt7vT` | ne | ne | — | lookup |
| Ročník | `c-Gzqef7MccS` | ne | ne | — | lookup |
| Garant | `c-zQ_7l6TxH3` | ne | ne | — | lookup |
| Oblast | `c-uLN9f64Sew` | ne | ne | — | lookup |
| Prerekvizita | `c-mjVIFt07r7` | ne | ne | — | lookup |
| Název lodičky | `c-A2MsAWIM1l` | ne | ne | — | text |
| Zkrácený název | `c-re9zQZr4qZ` | ano | ne | — | text |
| Kód OVU | `c-bpJ6nKiMKA` | ne | ne | — | lookup |
| Znění RVP | `c-JVsr6Q9upe` | ne | ano | [Kód OVU].OVU_zneni.ListCombine() | text |
| Typ | `c-_gLehCw3DU` | ne | ne | — | select |
| Počet let | `c-tm00TzDguE` | ne | ano | [Ročník do]-[Ročník od]+1 | number |
| Počet plaveb | `c-gRsPRikgnu` | ne | ano | [Počet let]*5 | text |
| Kód | `c-vYO6HGC0Cp` | ne | ano | [Předmět].Zkratka+"-"+if([Podpředmět],[Podpředmět].Zkratka,[ | text |
| Smazat | `c-lZhAAylb0S` | ne | ano | — | button |
| Smazaná | `c-JnzXkrZisc` | ne | ne | — | checkbox |
| Ročník od | `c-3I1o1VfzA1` | ne | ano | left([Ročník].First(),1).ToNumber() | number |
| Ročník do | `c-2Pjel3MZQT` | ne | ano | left([Ročník].Last(),1).ToNumber() | number |
| Stupeň | `c-cRIdPBFpRo` | ne | ne | — | lookup |

### Předměty (`grid-DQ9u7UNhqP`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Name | `c-ULGWCItPiw` | ano | ne | — | text |
| Platí od | `c-bIQjF_QbjX` | ne | ne | — | date |
| Školní roky | `c-_5uA2Fordv` | ne | ne | — | text |
| Platí do | `c-nbs0aosVme` | ne | ne | — | date |
| Garant | `c-LivFrasMev` | ne | ne | — | text |
| Zkratka | `c-aPrRgFCXxv` | ne | ne | — | text |
| Počet lodiček | `c-B2UYqeswFR` | ne | ano | [Lodičky od 1.9.2025].Filter([Předmět]=thisRow).Count() | text |

### Podpředměty (`grid-RqbKIDnZDM`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Name | `c-dx8sYoOVzq` | ano | ne | — | text |
| Předmět | `c-6aKr64HInz` | ne | ne | — | lookup |
| Platí od | `c-ooat0q1ccw` | ne | ne | — | date |
| Platí do | `c-3gTSA0szp-` | ne | ne | — | date |
| Školní roky | `c-wjCyF-Nghy` | ne | ne | — | text |
| Garant | `c-V2wtkInh_A` | ne | ne | — | text |
| Vyučující | `c-IXeaVGrWNZ` | ne | ne | — | text |
| Zkratka | `c-aOhXB7otKE` | ne | ne | — | text |
| Počet lodiček | `c-bd70GxC7x9` | ne | ano | [Lodičky od 1.9.2025].Filter([Podpředmět]=thisRow).Count() | text |

### Osobní lodičky (`grid-3m-_XP8oMp`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Jméno | `c-OSMU_hlRmn` | ne | ne | — | lookup |
| Lodička | `c-zCrx5ZI6_1` | ne | ne | — | lookup |
| Stav | `c-AP2fUynFbe` | ne | ano | [Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1) | lookup |
| Hodnota | `c-H7C9KdzQ8I` | ne | ano | Stav.Hodnota | number |
| Smečka | `c-wdUUsanACr` | ne | ano | [Jméno].[Smečka] | lookup |
| Aktivní | `c-wGyKzGNASL` | ne | ano | [Jméno].[Aktivní] | checkbox |
| Garant | `c-ETfsa_OPRw` | ne | ano | [Lodička].Garant | lookup |
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| - | `c-HgMvO9yZzg` | ne | ano | — | button |
| + | `c-k-Fvl5AU_z` | ne | ano | — | button |
| Pořadí stavu | `c-kJayOSHA5y` | ne | ne | — | number |
| Hodnota stavu | `c-U7KQdppjxK` | ne | ano | Stav.Hodnota | number |
| Kód osobní lodičky | `c--2LqS2G1oM` | ano | ano | [ID žáka]+"-"+[Kód lodičky] / [ID žáka]+"-"+[Kód lodičky] | text |
| ID žáka | `c-WJOFyTmLb0` | ne | ano | [Jméno].ID | number |
| Poznámka | `c-eayFSqWKOg` | ne | ne | — | text |
| Datum stavu | `c-9yqQ1W6KnV` | ne | ne | — | date |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| Historie | `c-LbIdXWqnl0` | ne | ano | [Historie lodiček].Filter([Osobní lodička].Contains(thisRow) | lookup |
| Kód lodičky | `c-jHa_FpDumI` | ne | ano | [Lodička].[Kód] | text |
| Ročník | `c-SE3NZt0wQP` | ne | ano | [Jméno].[Ročník] | lookup |
| Název lodičky dlouhý | `c-bYmKSGL0RL` | ne | ano | [Lodička].[Název lodičky] | text |
| Kód OVU | `c-KjnU2LstNz` | ne | ano | [Lodička].[Kód OVU] | lookup |
| Znění RVP | `c-Clh6Bb_xgT` | ne | ano | [Lodička].[Znění RVP] | text |
| Fotka | `c-Zp1zU2_ulM` | ne | ano | [Jméno].Fotka | image |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Přezdívka | `c-Bqrg4lLbml` | ne | ano | [Jméno].[Přezdívka] | text |
| Úspěch | `c-mVx9z4k5pL` | ne | ne | — | text |
| Typ studia | `c-Sc2enM5VSp` | ne | ano | [Jméno].[Docházka] | select |
| Změnil | `c-66wgJF9WAF` | ne | ano | [Seznam osob].Filter(User=thisRow.ModifiedBy()).First() | text |
| Smazaná | `c-ZFYsSAGsHy` | ne | ano | [Lodička].[Smazaná] | checkbox |
| Počáteční hodnota | `c-KBmhTcIKRc` | ne | ano | [Stupně lodiček] | text |
| Vstupní stav | `c-X5v5nrWjaW` | ne | ano | [Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum | text |
| 1. plavba | `c-THoLDgrzlc` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 2. plavba | `c-I93mCblJK4` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 3. plavba | `c-LcDCHr388O` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 4. plavba | `c-vZUh_zFRQo` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 5. plavba | `c-_OJHt3jmxm` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |

### Stupně lodiček (`grid-Tx2g73oOp5`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Stupeň | `c-E5L6g_y3c4` | ano | ne | — | text |
| Hodnota | `c-yYo5CDH_wo` | ne | ne | — | number |
| Pořadí | `c-zgxlX6Y7Fx` | ne | ne | — | number |

### Historie lodiček (`grid-nYzDRw4zl3`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Osobní lodička | `c-duB_f_46up` | ano | ne | — | lookup |
| Stav | `c-sowE706mOx` | ne | ne | — | lookup |
| Datum stavu | `c-ZCIqIo68gA` | ne | ne | — | date |
| Poznámka | `c-h2naqT5diV` | ne | ne | — | text |
| Hodnota | `c-1Cs5NzzeVd` | ne | ano | Stav.Hodnota | number |
| Modified on | `c-r13OL7lcTE` | ne | ano | thisRow.Modified() | dateTime |
| Modified by | `c-t9w9HRacgb` | ne | ano | thisRow.ModifiedBy() | person |
| Created by | `c-rozfffQLbC` | ne | ano | thisRow.CreatedBy() | person |
| Plavba | `c--SrgHRRZfA` | ne | ne | Plavby .Filter(Od<= [Datum stavu]AND Do>=[Datum stavu]).Nth( | lookup |
| Školní rok | `c-DbiQrA-aDZ` | ne | ano | Plavba.[Školní rok] | lookup |
| Změnil | `c-FYvjT_weJq` | ne | ne | — | lookup |
| Úspěch | `c-jgyttcsZGG` | ne | ne | — | text |
| Smazaná | `c-Cg8VkqvaVV` | ne | ano | [Osobní lodička].[Smazaná] | checkbox |
| Ročník | `c-vRaCLGoKbV` | ne | ano | Left([Ročník textem],1 ).ToNumber() | number |
| Předmět | `c-RGhm9o0m6m` | ne | ano | [Osobní lodička].[Předmět] | lookup |
| Hodnota stavu | `c-mYnRMrAAt2` | ne | ano | [Osobní lodička].[Hodnota stavu] | number |
| Oblast | `c-lcLy_GFpsL` | ne | ano | [Osobní lodička].Oblast | select |
| Jméno | `c-2h8jBb6UK4` | ne | ano | [Osobní lodička].[Přezdívka] | text |
| Ročník textem | `c-YgXgpV6ObC` | ne | ano | [Osobní lodička].[Ročník] | lookup |
| Smečka | `c-9uBlbifRZq` | ne | ano | [Osobní lodička].[Smečka] | lookup |

### Seznam rolí (`grid-cd-a7lAkYK`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Název role | `c-u2HB4OzJ1_` | ano | ne | — | text |

### Osobní lodičky v tabulce (`table-E8XnaMNtfK`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Smečka | `c-wdUUsanACr` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-OSMU_hlRmn` | ne | ne | — | lookup |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| - | `c-HgMvO9yZzg` | ne | ano | — | button |
| Stav | `c-AP2fUynFbe` | ne | ano | [Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1) | lookup |
| + | `c-k-Fvl5AU_z` | ne | ano | — | button |
| Datum stavu | `c-9yqQ1W6KnV` | ne | ne | — | date |
| Úspěch | `c-mVx9z4k5pL` | ne | ne | — | text |
| Poznámka | `c-eayFSqWKOg` | ne | ne | — | text |

### Slovní hodnocení (`grid-Sc-ZdJiUoP`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Jméno | `c-RauB84DQXs` | ano | ne | — | lookup |
| Hodnocení | `c-NBJfPjchFL` | ne | ne | — | text |
| Období | `c-lFi2wxChtI` | ne | ne | — | lookup |
| Smečka | `c-NNrDg-OVqr` | ne | ano | [Jméno].[Smečka] | lookup |
| Patron | `c-jMHnGBxbqH` | ne | ano | [Smečka].Patron | lookup |
| Dostupný text | `c-FJhA26yy-l` | ne | ano | 1-Length([Hodnocení])/2000 | percent |
| Stav hodnocení | `c-xoYTI7SYYj` | ne | ne | — | lookup |
| K řešení | `c-B_raRcD_4b` | ne | ne | Patron | lookup |
| Vyřešeno | `c-QZ4cg13XAo` | ne | ne | — | lookup |
| Autor hodnocení | `c-4-so7NI52c` | ne | ne | — | lookup |
| Následující řešitel | `c-OOi-eRZXLB` | ne | ne | [Seznam osob].Filter(Role.Contains([Editor hodnocení]  )) | lookup |
| Následující stav | `c-89MldnDONF` | ne | ne | [Stav hodnocení].[Následující] | lookup |
| Edookit | `c-N-orNglp6y` | ne | ne | — | select |
| ID hodnocení | `c-G6KgC_sv5G` | ne | ano | thisRow.RowId() | number |
| Odeslat | `c-zaL_k-a6_w` | ne | ano | — | button |
| Stav | `c-T_Reyf5vyv` | ne | ano | [Stav hodnocení] | text |
| Akt. | `c-AFkCMC02Qc` | ne | ano | — | button |
| Celkový prospěch | `c-WCTIBIAWBg` | ne | ano | WithName(   [Vysvědčení - hodnocení předmětů]     .Filter(   | text |

### Hodnotící období (`grid-JBy0pWZIC5`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Name | `c-CBBEtDbWUv` | ano | ne | — | text |
| Školní rok | `c-AReSSIrMHA` | ne | ne | — | lookup |
| Od | `c-1aR5DOJtPM` | ne | ne | — | date |
| Do | `c-sDj3_pzgRS` | ne | ne | — | date |

### Stupně hodnocení (`grid-sCWXYfO6Zu`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Stav | `c-TpCz_8EJrE` | ano | ne | — | text |
| Následující | `c-zLzNCsM_vv` | ne | ne | — | lookup |
| Role | `c-VsXZYKInkf` | ne | ne | — | lookup |
| Vrátit | `c-Cq-WHuDhiZ` | ne | ne | — | lookup |

### Hodnocení pro vysvědčení (`table-kr7a17ip5t`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Ročník | `c-vRaCLGoKbV` | ne | ano | Left([Ročník textem],1 ).ToNumber() | number |
| Smečka | `c-9uBlbifRZq` | ne | ano | [Osobní lodička].[Smečka] | lookup |
| Jméno | `c-2h8jBb6UK4` | ne | ano | [Osobní lodička].[Přezdívka] | text |
| Předmět | `c-RGhm9o0m6m` | ne | ano | [Osobní lodička].[Předmět] | lookup |
| Oblast | `c-lcLy_GFpsL` | ne | ano | [Osobní lodička].Oblast | select |
| Osobní lodička | `c-duB_f_46up` | ano | ne | — | lookup |
| Stav | `c-sowE706mOx` | ne | ne | — | lookup |
| Datum stavu | `c-ZCIqIo68gA` | ne | ne | — | date |
| Hodnota | `c-1Cs5NzzeVd` | ne | ano | Stav.Hodnota | number |
| Smazaná | `c-Cg8VkqvaVV` | ne | ano | [Osobní lodička].[Smazaná] | checkbox |

### Oblasti vysvědčení (`grid-77pv1Grcpi`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Oblast | `c-AcJVvWzBn8` | ano | ne | — | text |
| Předmět | `c-65JFohR3pj` | ne | ne | — | lookup |
| Stupeň | `c-me-nOgUrSe` | ne | ne | — | lookup |
| Podpředmět | `c-o6jZ5Oxv9T` | ne | ne | — | lookup |
| Ročníky | `c-rt2cxiK0w4` | ne | ne | — | lookup |
| Počet lodiček | `c-ZGL1UB29Iy` | ne | ano | [Lodičky od 1.9.2025].Filter(and([Smazaná]=false,[Stupeň]=[S | text |
| Suma bodů | `c-kHZtg-gS4W` | ne | ano | [Počet lodiček]*4 | number |
| Počet období | `c-ro3rcqZ8ZF` | ne | ano | [Ročníky].Count()*2 | number |

### Vysvědčení - slovní hodnocení (`table-bqvtwKXWE_`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Smečka | `c-NNrDg-OVqr` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-RauB84DQXs` | ano | ne | — | lookup |
| Hodnocení | `c-NBJfPjchFL` | ne | ne | — | text |
| Celkový prospěch | `c-WCTIBIAWBg` | ne | ano | WithName(   [Vysvědčení - hodnocení předmětů]     .Filter(   | text |

### Předměty vysvědčení (`grid-1Dw5aBDZkX`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-B5lccBW6tf` | ne | ne | — | lookup |
| Stupeň | `c-c36MCKHed0` | ne | ne | — | lookup |
| Počet lodiček | `c-uoyfwPpoYs` | ne | ano | [Lodičky od 1.9.2025].Filter(and([Smazaná]=false,[Stupeň]=[S | number |
| Počet období | `c-w9oj9EpJl7` | ne | ano | [Ročníky].Count()*2 | number |
| Ročníky | `c-FmKZgestDi` | ne | ne | — | lookup |
| Suma bodů | `c--7ns0N4lDH` | ne | ano | [Počet lodiček]*4 | number |
| Předmět vysvědčení | `c-Hon8FwJaYd` | ano | ano | Left([Stupeň],2)+" "+[Předmět].Name | text |

### Vysvědčení - hodnocení oblastí (`grid-Fo7THNgdeq`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Jméno | `c-H0Dv3JDsqU` | ano | ne | — | lookup |
| Oblast | `c-HlTyztXbdQ` | ne | ne | — | lookup |
| Aktuální body | `c-wRu87PvHCi` | ne | ano | [Osobní lodičky].Filter(and([Jméno]=[Jméno],Oblast=Oblast,[S | number |
| Smečka | `c--tWX0RYMDQ` | ne | ano | [Jméno].[Smečka] | lookup |
| Aktuální ročník | `c-2vDenkjqH9` | ne | ano | [Jméno].[Aktuální ročník].ToNumber() | number |
| Počáteční ročník | `c-03HKMXeJKh` | ne | ano | [Jméno].[Počáteční ročník] | number |
| Oblast celkem | `c-5mVt75lgIO` | ne | ano | Oblast.[Suma bodů] | number |
| Stará norma | `c-H8N9Vt1ryn` | ne | ano | (([Aktuální ročník]-[Základna období])*2+1)/[Počet období]*[ | number |
| Počet období | `c-TC410Ngi4Z` | ne | ano | Oblast.[Počet období] | number |
| Staré hodnocení | `c-jZhu4nEtXD` | ne | ano | [Body celkem]/[Stará norma] | percent |
| Dopočet při přestupu | `c-B54-A7-5WI` | ne | ano | (SwitchIf([Počáteční ročník]=1 or [Počáteční ročník]=5,0,and | number |
| Předmět | `c-FbbeJ33EsP` | ne | ano | Oblast.[Předmět] | lookup |
| Základna období | `c-MyzNz9pERv` | ne | ano | [Lodičky od 1.9.2025].Filter(Oblast=Oblast).[Ročník od].Firs | number |
| Historické lodičky | `c-iKucJbAf8_` | ne | ano | [Lodičky od 1.9.2025].Filter(and(Oblast=Oblast,[Smazaná]=fal | number |
| Body celkem | `c-D1XChdOh40` | ne | ano | [Aktuální body]+[Historické lodičky]+[Dopočet při přestupu] | number |
| Dopočet základ | `c-0ayuFLzuR1` | ne | ano | [Lodičky od 1.9.2025].Filter(And([Smazaná]=false,Oblast=Obla | number |
| Norma | `c-6AxGhTQBq5` | ne | ano | If(or([Základna období]=2,[Základna období]=7),[Křivka plněn | number |
| Ročník | `c-o-wbC0pNhQ` | ne | ano | [Jméno].[Ročník] | lookup |
| Hodnocení | `c-LbpmBdYHFo` | ne | ano | [Body celkem]/Norma | percent |
| Podpředmět | `c-T1L9sVXOBM` | ne | ano | Oblast.[Podpředmět] | lookup |
| Celkový pokrok | `c-opBivDae2F` | ne | ano | min([Body celkem]/[Oblast celkem],1) | percent |
| Předchozí body | `c-2KoekQ84uU` | ne | ano | [Historie lodiček].Filter(and([Smazaná]=false,[Datum stavu]= | number |
| Předchozí norma | `c-q0en51VvcR` | ne | ano | If(or([Základna období]=2,[Základna období]=7),[Křivka plněn | number |
| Předchozí hodnocení | `c-xYY6K0Z-xr` | ne | ano | If(   [Předchozí norma].IsBlank() OR [Předchozí norma] = 0,  | percent |
| Předchozí celkový pokrok | `c-rXFsuNTWGH` | ne | ano | min([Předchozí body]/[Oblast celkem],1) | percent |
| Tempo změny | `c-GlqL3aRBg5` | ne | ano | (([Body celkem] - [Předchozí body]) - (Norma - [Předchozí no | percent |
| Zbývá bodů | `c-JE-uo_HF1P` | ne | ano | [Oblast celkem]-[Body celkem] | number |

### Vysvědčení - hodnocení předmětů (`grid-Ia-EtsvQDd`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Jméno | `c-6y8osbNwV1` | ano | ne | — | lookup |
| Předmět vysvědčení | `c-hIeTSLGc0W` | ne | ne | — | lookup |
| Smečka | `c-qlgWy5b7gm` | ne | ano | [Jméno].[Smečka] | lookup |
| Počet období | `c-jIR9C8oS3J` | ne | ano | [Předmět vysvědčení].[Počet období] | number |
| Body celkem | `c-VpreYM7lLn` | ne | ano | [Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno], | number |
| Předmět | `c-UXuyii8itd` | ne | ano | [Předmět vysvědčení].[Předmět] | lookup |
| Stará norma | `c-m8z9F6mUfc` | ne | ano | [Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno], | number |
| Předmět celkem | `c-HFd9pHASFz` | ne | ano | [Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno], | number |
| Aktuální ročník | `c-VM1MuomFeZ` | ne | ano | [Jméno].[Aktuální ročník] | select |
| Základna období | `c-vIV_43NCoU` | ne | ano | if([Aktuální ročník]>5,6,1) | number |
| Staré hodnocení | `c-xtqoF9CCfy` | ne | ano | [Body celkem]/[Stará norma] | percent |
| Stará známka | `c-7kx_gGkQnW` | ne | ano | [Známková pásma].Filter([Hodnocení od]<[Staré hodnocení] and | number |
| Norma | `c-FQEmOP1h7p` | ne | ano | [Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno], | number |
| Hodnocení | `c-cbGW-UNRmI` | ne | ano | [Body celkem]/Norma | percent |
| Známka | `c-C_HG0Ixe82` | ne | ano | [Známková pásma].Filter([Hodnocení od]<[Hodnocení] and [Hodn | number |
| Ročník | `c--OBfx7zfF2` | ne | ano | [Jméno].[Ročník] | lookup |
| Předchozí norma | `c-1o4-CpyKdG` | ne | ano | [Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno], | number |
| Předchozí hodnocení | `c-P0OQyo1jHi` | ne | ano | If(   [Předchozí norma].IsBlank() OR [Předchozí norma] = 0,  | percent |
| Předchozí body | `c-9-0e9CQ0zZ` | ne | ano | [Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno], | number |
| Tempo změny | `c-3ilIUhumPd` | ne | ano | (([Body celkem] - [Předchozí body]) - (Norma - [Předchozí no | percent |
| Zbývá bodů | `c-XwxMW8a5yh` | ne | ano | [Předmět celkem]-[Body celkem] | number |

### Křivka plnění lodiček (`grid-WRLBZgw4Vo`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Období | `c-opsHmPPnEm` | ano | ne | — | number |
| Ročník | `c-Gnf85M6reH` | ne | ne | — | lookup |
| Pololetí | `c-5u_BrMxW9w` | ne | ne | — | select |
| Hodnota | `c-kTnUnb0Oum` | ne | ne | — | percent |
| Stupeň | `c-NXbv0udM99` | ne | ne | — | lookup |
| Norma | `c-ctMybhCUbr` | ne | ano | thisTable.Filter([Stupeň]=[Stupeň] and [Období]<=[Období]).H | percent |
| Hodnota zkrácená | `c-rgDCmkjJ4S` | ne | ne | — | percent |
| Norma zkrácená | `c-kRj7A9aitl` | ne | ano | thisTable.Filter([Stupeň]=[Stupeň] and [Období]<=[Období]).[ | percent |
| Roční podíl | `c-D1Af035H3k` | ne | ano | thisTable.Filter([Ročník]=[Ročník]).Hodnota.Sum() | percent |
| Předchozí norma | `c--RMRoBV-_-` | ne | ano | thisTable.Filter([Stupeň]=[Stupeň] and [Období]<[Období]).Ho | percent |
| Předchozí norma zkrácená | `c-6Zt_GKuppG` | ne | ano | thisTable.Filter([Stupeň]=[Stupeň] and [Období]<[Období]).[H | percent |

### Známková pásma (`grid-sYxvVev2h2`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Známka | `c-eCX1Aud1dU` | ano | ne | — | number |
| Hodnocení od | `c-bnnz9f7S0k` | ne | ne | — | percent |
| Hodnocení do | `c-Aej8Pd8fIW` | ne | ne | — | percent |

### Oblasti pro tisk (`table-oJLgfv_KMf`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Smečka | `c--tWX0RYMDQ` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-H0Dv3JDsqU` | ano | ne | — | lookup |
| Předmět | `c-FbbeJ33EsP` | ne | ano | Oblast.[Předmět] | lookup |
| Podpředmět | `c-T1L9sVXOBM` | ne | ano | Oblast.[Podpředmět] | lookup |
| Oblast | `c-HlTyztXbdQ` | ne | ne | — | lookup |
| Předchozí body | `c-2KoekQ84uU` | ne | ano | [Historie lodiček].Filter(and([Smazaná]=false,[Datum stavu]= | number |
| Body celkem | `c-D1XChdOh40` | ne | ano | [Aktuální body]+[Historické lodičky]+[Dopočet při přestupu] | number |
| Zbývá bodů | `c-JE-uo_HF1P` | ne | ano | [Oblast celkem]-[Body celkem] | number |
| Předchozí norma | `c-q0en51VvcR` | ne | ano | If(or([Základna období]=2,[Základna období]=7),[Křivka plněn | number |
| Norma | `c-6AxGhTQBq5` | ne | ano | If(or([Základna období]=2,[Základna období]=7),[Křivka plněn | number |

### Předměty pro tisk (`table-kVhETmlU2x`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Smečka | `c-qlgWy5b7gm` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-6y8osbNwV1` | ano | ne | — | lookup |
| Předmět | `c-UXuyii8itd` | ne | ano | [Předmět vysvědčení].[Předmět] | lookup |
| Hodnocení | `c-cbGW-UNRmI` | ne | ano | [Body celkem]/Norma | percent |
| Předchozí hodnocení | `c-P0OQyo1jHi` | ne | ano | If(   [Předchozí norma].IsBlank() OR [Předchozí norma] = 0,  | percent |
| Tempo změny | `c-3ilIUhumPd` | ne | ano | (([Body celkem] - [Předchozí body]) - (Norma - [Předchozí no | percent |

### Hodnocení předmětů (`table-oCLreazO22`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-UXuyii8itd` | ne | ano | [Předmět vysvědčení].[Předmět] | lookup |
| Předmět celkem | `c-HFd9pHASFz` | ne | ano | [Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno], | number |
| Body celkem | `c-VpreYM7lLn` | ne | ano | [Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno], | number |
| Norma | `c-FQEmOP1h7p` | ne | ano | [Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno], | number |
| Hodnocení | `c-cbGW-UNRmI` | ne | ano | [Body celkem]/Norma | percent |

### Hodnocení oblastí (`table-NbDPhMF4ci`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-FbbeJ33EsP` | ne | ano | Oblast.[Předmět] | lookup |
| Oblast | `c-HlTyztXbdQ` | ne | ne | — | lookup |
| Oblast celkem | `c-5mVt75lgIO` | ne | ano | Oblast.[Suma bodů] | number |
| Dopočet při přestupu | `c-B54-A7-5WI` | ne | ano | (SwitchIf([Počáteční ročník]=1 or [Počáteční ročník]=5,0,and | number |
| Historické lodičky | `c-iKucJbAf8_` | ne | ano | [Lodičky od 1.9.2025].Filter(and(Oblast=Oblast,[Smazaná]=fal | number |
| Aktuální body | `c-wRu87PvHCi` | ne | ano | [Osobní lodičky].Filter(and([Jméno]=[Jméno],Oblast=Oblast,[S | number |
| Body celkem | `c-D1XChdOh40` | ne | ano | [Aktuální body]+[Historické lodičky]+[Dopočet při přestupu] | number |
| Norma | `c-6AxGhTQBq5` | ne | ano | If(or([Základna období]=2,[Základna období]=7),[Křivka plněn | number |
| Hodnocení | `c-LbpmBdYHFo` | ne | ano | [Body celkem]/Norma | percent |

### Rodiče (`table-GiM1EvB6LU`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| ID | `c-4zBzeJEcjZ` | ne | ne | — | number |
| Příjmení | `c-GMLYzGw8ke` | ne | ne | — | text |
| Křestní | `c-hJKW60xeO1` | ne | ne | — | text |
| Kontaktní maily | `c-G9HEPv7cRM` | ne | ne | — | select |
| Role | `c-aI2b_O-scX` | ne | ne | — | lookup |
| Děti | `c-9SFUzViDLO` | ne | ne | — | lookup |
| Aktivní | `c-uLx5khljlC` | ne | ano | If(IsBlank([Vyřazen od]),true,false) | checkbox |
| Přezdívka | `c--RSuRrZPWK` | ano | ne | [Křestní]+" "+Left([Příjmení],1 )+"." | text |
| Ročník | `c-htPmrPqL_r` | ne | ano | WithName(   Skupiny.Filter(Skupina = [Aktuální ročník].ToTex | lookup |
| Primární e-mail | `c-dYUboRJFlY` | ne | ne | — | text |

### Lodičky dítěte (`table-RuXGEEn2z4`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| Stav | `c-AP2fUynFbe` | ne | ano | [Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1) | lookup |
| Úspěch | `c-mVx9z4k5pL` | ne | ne | — | text |
| Poznámka | `c-eayFSqWKOg` | ne | ne | — | text |

### Lodičky dítěte po plavbách (`table-1wVyfFAjX2`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| Vstupní stav | `c-X5v5nrWjaW` | ne | ano | [Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum | text |
| 1. plavba | `c-THoLDgrzlc` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 2. plavba | `c-I93mCblJK4` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 3. plavba | `c-LcDCHr388O` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 4. plavba | `c-vZUh_zFRQo` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 5. plavba | `c-_OJHt3jmxm` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |

### 1. ročník (`table-yEEWei_5V6`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Smečka | `c-wdUUsanACr` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-OSMU_hlRmn` | ne | ne | — | lookup |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| - | `c-HgMvO9yZzg` | ne | ano | — | button |
| Stav | `c-AP2fUynFbe` | ne | ano | [Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1) | lookup |
| + | `c-k-Fvl5AU_z` | ne | ano | — | button |
| Datum stavu | `c-9yqQ1W6KnV` | ne | ne | — | date |
| Úspěch | `c-mVx9z4k5pL` | ne | ne | — | text |
| Poznámka | `c-eayFSqWKOg` | ne | ne | — | text |
| 1. plavba | `c-THoLDgrzlc` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 2. plavba | `c-I93mCblJK4` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 3. plavba | `c-LcDCHr388O` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 4. plavba | `c-vZUh_zFRQo` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 5. plavba | `c-_OJHt3jmxm` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| Vstupní stav | `c-X5v5nrWjaW` | ne | ano | [Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum | text |
| Znění RVP | `c-Clh6Bb_xgT` | ne | ano | [Lodička].[Znění RVP] | text |
| Název lodičky dlouhý | `c-bYmKSGL0RL` | ne | ano | [Lodička].[Název lodičky] | text |

### 2. ročník (`table-Ne5GJTiRsp`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Smečka | `c-wdUUsanACr` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-OSMU_hlRmn` | ne | ne | — | lookup |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| - | `c-HgMvO9yZzg` | ne | ano | — | button |
| Stav | `c-AP2fUynFbe` | ne | ano | [Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1) | lookup |
| + | `c-k-Fvl5AU_z` | ne | ano | — | button |
| Datum stavu | `c-9yqQ1W6KnV` | ne | ne | — | date |
| Úspěch | `c-mVx9z4k5pL` | ne | ne | — | text |
| Poznámka | `c-eayFSqWKOg` | ne | ne | — | text |
| 1. plavba | `c-THoLDgrzlc` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 2. plavba | `c-I93mCblJK4` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 3. plavba | `c-LcDCHr388O` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 4. plavba | `c-vZUh_zFRQo` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 5. plavba | `c-_OJHt3jmxm` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| Vstupní stav | `c-X5v5nrWjaW` | ne | ano | [Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum | text |
| Znění RVP | `c-Clh6Bb_xgT` | ne | ano | [Lodička].[Znění RVP] | text |
| Název lodičky dlouhý | `c-bYmKSGL0RL` | ne | ano | [Lodička].[Název lodičky] | text |

### 3. ročník (`table-dlHd_OQzDo`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Smečka | `c-wdUUsanACr` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-OSMU_hlRmn` | ne | ne | — | lookup |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| - | `c-HgMvO9yZzg` | ne | ano | — | button |
| Stav | `c-AP2fUynFbe` | ne | ano | [Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1) | lookup |
| + | `c-k-Fvl5AU_z` | ne | ano | — | button |
| Datum stavu | `c-9yqQ1W6KnV` | ne | ne | — | date |
| Úspěch | `c-mVx9z4k5pL` | ne | ne | — | text |
| Poznámka | `c-eayFSqWKOg` | ne | ne | — | text |
| 1. plavba | `c-THoLDgrzlc` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 2. plavba | `c-I93mCblJK4` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 3. plavba | `c-LcDCHr388O` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 4. plavba | `c-vZUh_zFRQo` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 5. plavba | `c-_OJHt3jmxm` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| Vstupní stav | `c-X5v5nrWjaW` | ne | ano | [Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum | text |
| Název lodičky dlouhý | `c-bYmKSGL0RL` | ne | ano | [Lodička].[Název lodičky] | text |
| Znění RVP | `c-Clh6Bb_xgT` | ne | ano | [Lodička].[Znění RVP] | text |

### 4. ročník (`table-XNp8CBW4b4`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Smečka | `c-wdUUsanACr` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-OSMU_hlRmn` | ne | ne | — | lookup |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| - | `c-HgMvO9yZzg` | ne | ano | — | button |
| Stav | `c-AP2fUynFbe` | ne | ano | [Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1) | lookup |
| + | `c-k-Fvl5AU_z` | ne | ano | — | button |
| Datum stavu | `c-9yqQ1W6KnV` | ne | ne | — | date |
| Úspěch | `c-mVx9z4k5pL` | ne | ne | — | text |
| Poznámka | `c-eayFSqWKOg` | ne | ne | — | text |
| 1. plavba | `c-THoLDgrzlc` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 2. plavba | `c-I93mCblJK4` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 3. plavba | `c-LcDCHr388O` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 4. plavba | `c-vZUh_zFRQo` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 5. plavba | `c-_OJHt3jmxm` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| Vstupní stav | `c-X5v5nrWjaW` | ne | ano | [Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum | text |
| Název lodičky dlouhý | `c-bYmKSGL0RL` | ne | ano | [Lodička].[Název lodičky] | text |
| Znění RVP | `c-Clh6Bb_xgT` | ne | ano | [Lodička].[Znění RVP] | text |

### Hodnocení předmětů export (`table-o85zm2oqc_`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-UXuyii8itd` | ne | ano | [Předmět vysvědčení].[Předmět] | lookup |
| Předmět celkem | `c-HFd9pHASFz` | ne | ano | [Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno], | number |
| Body celkem | `c-VpreYM7lLn` | ne | ano | [Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno], | number |
| Norma | `c-FQEmOP1h7p` | ne | ano | [Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno], | number |
| Hodnocení | `c-cbGW-UNRmI` | ne | ano | [Body celkem]/Norma | percent |
| Jméno | `c-6y8osbNwV1` | ano | ne | — | lookup |

### Hodnocení oblastí export (`table-TbzZTQK1dj`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-FbbeJ33EsP` | ne | ano | Oblast.[Předmět] | lookup |
| Oblast | `c-HlTyztXbdQ` | ne | ne | — | lookup |
| Oblast celkem | `c-5mVt75lgIO` | ne | ano | Oblast.[Suma bodů] | number |
| Dopočet při přestupu | `c-B54-A7-5WI` | ne | ano | (SwitchIf([Počáteční ročník]=1 or [Počáteční ročník]=5,0,and | number |
| Historické lodičky | `c-iKucJbAf8_` | ne | ano | [Lodičky od 1.9.2025].Filter(and(Oblast=Oblast,[Smazaná]=fal | number |
| Aktuální body | `c-wRu87PvHCi` | ne | ano | [Osobní lodičky].Filter(and([Jméno]=[Jméno],Oblast=Oblast,[S | number |
| Body celkem | `c-D1XChdOh40` | ne | ano | [Aktuální body]+[Historické lodičky]+[Dopočet při přestupu] | number |
| Norma | `c-6AxGhTQBq5` | ne | ano | If(or([Základna období]=2,[Základna období]=7),[Křivka plněn | number |
| Hodnocení | `c-LbpmBdYHFo` | ne | ano | [Body celkem]/Norma | percent |
| Jméno | `c-H0Dv3JDsqU` | ano | ne | — | lookup |

### 5. ročník (`table-4ZVEPvhpqK`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Smečka | `c-wdUUsanACr` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-OSMU_hlRmn` | ne | ne | — | lookup |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| - | `c-HgMvO9yZzg` | ne | ano | — | button |
| Stav | `c-AP2fUynFbe` | ne | ano | [Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1) | lookup |
| + | `c-k-Fvl5AU_z` | ne | ano | — | button |
| Datum stavu | `c-9yqQ1W6KnV` | ne | ne | — | date |
| Úspěch | `c-mVx9z4k5pL` | ne | ne | — | text |
| Poznámka | `c-eayFSqWKOg` | ne | ne | — | text |
| 1. plavba | `c-THoLDgrzlc` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 2. plavba | `c-I93mCblJK4` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 3. plavba | `c-LcDCHr388O` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 4. plavba | `c-vZUh_zFRQo` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 5. plavba | `c-_OJHt3jmxm` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| Vstupní stav | `c-X5v5nrWjaW` | ne | ano | [Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum | text |
| Název lodičky dlouhý | `c-bYmKSGL0RL` | ne | ano | [Lodička].[Název lodičky] | text |
| Znění RVP | `c-Clh6Bb_xgT` | ne | ano | [Lodička].[Znění RVP] | text |

### 6. ročník (`table-LwY7_9SdqF`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Smečka | `c-wdUUsanACr` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-OSMU_hlRmn` | ne | ne | — | lookup |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| - | `c-HgMvO9yZzg` | ne | ano | — | button |
| Stav | `c-AP2fUynFbe` | ne | ano | [Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1) | lookup |
| + | `c-k-Fvl5AU_z` | ne | ano | — | button |
| Datum stavu | `c-9yqQ1W6KnV` | ne | ne | — | date |
| Úspěch | `c-mVx9z4k5pL` | ne | ne | — | text |
| Poznámka | `c-eayFSqWKOg` | ne | ne | — | text |
| 1. plavba | `c-THoLDgrzlc` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 2. plavba | `c-I93mCblJK4` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 3. plavba | `c-LcDCHr388O` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 4. plavba | `c-vZUh_zFRQo` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 5. plavba | `c-_OJHt3jmxm` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| Vstupní stav | `c-X5v5nrWjaW` | ne | ano | [Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum | text |
| Název lodičky dlouhý | `c-bYmKSGL0RL` | ne | ano | [Lodička].[Název lodičky] | text |
| Znění RVP | `c-Clh6Bb_xgT` | ne | ano | [Lodička].[Znění RVP] | text |

### 7. ročník (`table-bvqhgv4t6f`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Smečka | `c-wdUUsanACr` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-OSMU_hlRmn` | ne | ne | — | lookup |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| - | `c-HgMvO9yZzg` | ne | ano | — | button |
| Stav | `c-AP2fUynFbe` | ne | ano | [Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1) | lookup |
| + | `c-k-Fvl5AU_z` | ne | ano | — | button |
| Datum stavu | `c-9yqQ1W6KnV` | ne | ne | — | date |
| Úspěch | `c-mVx9z4k5pL` | ne | ne | — | text |
| Poznámka | `c-eayFSqWKOg` | ne | ne | — | text |
| 1. plavba | `c-THoLDgrzlc` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 2. plavba | `c-I93mCblJK4` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 3. plavba | `c-LcDCHr388O` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 4. plavba | `c-vZUh_zFRQo` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 5. plavba | `c-_OJHt3jmxm` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| Vstupní stav | `c-X5v5nrWjaW` | ne | ano | [Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum | text |
| Název lodičky dlouhý | `c-bYmKSGL0RL` | ne | ano | [Lodička].[Název lodičky] | text |
| Znění RVP | `c-Clh6Bb_xgT` | ne | ano | [Lodička].[Znění RVP] | text |

### 8. ročník (`table-Jc9Ad8G8Cp`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Smečka | `c-wdUUsanACr` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-OSMU_hlRmn` | ne | ne | — | lookup |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| - | `c-HgMvO9yZzg` | ne | ano | — | button |
| Stav | `c-AP2fUynFbe` | ne | ano | [Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1) | lookup |
| + | `c-k-Fvl5AU_z` | ne | ano | — | button |
| Datum stavu | `c-9yqQ1W6KnV` | ne | ne | — | date |
| Úspěch | `c-mVx9z4k5pL` | ne | ne | — | text |
| Poznámka | `c-eayFSqWKOg` | ne | ne | — | text |
| 1. plavba | `c-THoLDgrzlc` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 2. plavba | `c-I93mCblJK4` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 3. plavba | `c-LcDCHr388O` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 4. plavba | `c-vZUh_zFRQo` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 5. plavba | `c-_OJHt3jmxm` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| Vstupní stav | `c-X5v5nrWjaW` | ne | ano | [Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum | text |
| Název lodičky dlouhý | `c-bYmKSGL0RL` | ne | ano | [Lodička].[Název lodičky] | text |
| Znění RVP | `c-Clh6Bb_xgT` | ne | ano | [Lodička].[Znění RVP] | text |

### 9. ročník (`table-q6HV_Va-gc`)

| Sloupec (název) | ID | Zobrazen | Vypočítaný | Vzorec / výchozí hodnota | Formát (typ) |
|------------------|-----|----------|------------|---------------------------|---------------|
| Předmět | `c-obSQ5dEK0z` | ne | ano | [Lodička].[Předmět] | lookup |
| Podpředmět | `c-trddTED3wc` | ne | ano | [Lodička].[Podpředmět] | lookup |
| Oblast | `c-RUxQ0_Ii9O` | ne | ano | [Lodička].Oblast | select |
| Smečka | `c-wdUUsanACr` | ne | ano | [Jméno].[Smečka] | lookup |
| Jméno | `c-OSMU_hlRmn` | ne | ne | — | lookup |
| Název lodičky | `c-awKbb-1mcj` | ne | ano | [Lodička].[Zkrácený název] | text |
| - | `c-HgMvO9yZzg` | ne | ano | — | button |
| Stav | `c-AP2fUynFbe` | ne | ano | [Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1) | lookup |
| + | `c-k-Fvl5AU_z` | ne | ano | — | button |
| Datum stavu | `c-9yqQ1W6KnV` | ne | ne | — | date |
| Úspěch | `c-mVx9z4k5pL` | ne | ne | — | text |
| Poznámka | `c-eayFSqWKOg` | ne | ne | — | text |
| 1. plavba | `c-THoLDgrzlc` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 2. plavba | `c-I93mCblJK4` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 3. plavba | `c-LcDCHr388O` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 4. plavba | `c-vZUh_zFRQo` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| 5. plavba | `c-_OJHt3jmxm` | ne | ano | [Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Dat | text |
| Vstupní stav | `c-X5v5nrWjaW` | ne | ano | [Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum | text |
| Název lodičky dlouhý | `c-bYmKSGL0RL` | ne | ano | [Lodička].[Název lodičky] | text |
| Znění RVP | `c-Clh6Bb_xgT` | ne | ano | [Lodička].[Znění RVP] | text |

---

## 4. Relace (identifikované z kódu aplikace)

Následující vztahy jsou použity v `src/lib/coda.ts` a API:

| Tabulka | Sloupec | Odkazuje na | Popis |
|---------|---------|-------------|--------|
| Seznam osob | **Děti** | Seznam osob (řádky) | Relation: rodič → děti |
| Seznam osob | **Rodič(e)** | Seznam osob (řádky) | Fallback pro přiřazení rodič–dítě |
| Lodičky dítěte / Lodičky po plavbách / Hodnocení předmětů / Hodnocení oblastí | **Jméno** (nebo osoba/žák) | Seznam osob | Filtrování řádků podle dítěte |
| Lodičky dítěte (view) | — | Osobní lodičky (base) | View podle ročníku (CODA_VIEW_1_ROCNIK … 9) |

Pro migraci do Supabase: tyto relation sloupce nahradit cizími klíči (např. `parent_id`, `child_id`, `person_id`) odkazujícími na primární klíč odpovídající tabulky.

---

## 5. Sloupce s vzorci (calculated / formula)

### Školní roky

- **Plavby** (`c-OM6siWkPHA`): `Plavby.Filter([Školní rok].Contains(thisRow))`

### Smečky

- **Seznam** (`c-EAZGv7j5AL`): `[Seznam osob].Filter([Smečka].Contains(thisRow))`

### Seznam osob

- **Aktivní** (`c-uLx5khljlC`): `If(IsBlank([Vyřazen od]),true,false)`
- **Jméno** (`c-MzlgfRju0X`): `[Křestní]+" "+[Příjmení]`
- **Docházka** (`c-cxXNqOz_kN`): `Switch([Kód vzdělvání],11 ,"Denní",30,"Zahraniční",21,"IV" )`
- **Ročník** (`c-htPmrPqL_r`): `WithName(   Skupiny.Filter(Skupina = [Aktuální ročník].ToText() + ". ročník"),   g,   If(g.Count() = 0, "", g.First()) )`
- **Rodiče** (`c-myPyzcpQgD`): `[Seznam osob].Filter([Děti].Contains(thisRow))`

### Knihy

- **Exemplare** (`c-Vr4l8K0sb0`): `Exemplare.Filter(Kniha.Contains(thisRow))`

### Exemplare

- **Kniha** (`c-QH2EaA9FXN`): `Knihy.Filter(ID = ToNumber([Book ID])).First()`

### Ostrovy

- **Zapsaní žáci** (`c-uhH8C8ix5p`): `[Zápisy].Filter(Ostrov.Contains(thisRow))`
- **OSTROV** (`c-EQS33vkSSQ`): `[Název] + LineBreak() + "(" + [Průvodce].Jmeno +   ", " +   if([Volná místa] = 0, "obsazeno", "míst: " + [Volná místa]) +   ")"`
- **Volná místa** (`c-_KbbHH9ZtZ`): `[Max dětí]-[Zapsaní žáci].Count()`
- **TentoTýden** (`c-EVnBmbHUeb`): `IsoWeekNumber(Today())=IsoWeekNumber(Datum.Datum) AND  Year(Today()) = Year(Datum.Datum)`
- **Zápis** (`c-B2DL-bElv3`): ``
- **PopisekNeorezany** (`c-oCq1NuwjZ6`): `Popisek._color("#000000")`

### Zápisy

- **Typ** (`c-98CcUqt7zB`): `Ostrov.Typ`
- **Datum** (`c-Og9j81kjyu`): `Termin.Datum`
- **Jmeno zaka** (`c-gHWgB9TIcQ`): `Zak.[Roc jm pr]`
- **Created on** (`c-Y_NwZi0T2p`): `thisRow.Created()`
- **Pruvodce** (`c-BIyuuhqoiP`): `Ostrov.[Průvodce]`
- **Škrtnout** (`c-wRaNQZcYot`): ``

### Seznam techniky

- **ID** (`c-oz32kGPS9E`): `Concatenate(   "T",   [Typy techniky].Filter(Typ=Typ).[Kód].First(),   "-",   [Číslo kusu] )`
- **Výpůjčky** (`c-zhPJDP0h9D`): `[Výpůjčky].Filter([Předmět].Contains(thisRow))`

### Výpůjčky

- **Čas výpůjčky** (`c-HS-UJ7rVKM`): `thisRow.Created()`
- **ID** (`c-hs9L5H1bMn`): `[Předmět].ID`
- **Místo uložení** (`c-7fpMBQxLVA`): `[Předmět].[Místo uložení]`
- **Délka výpůjčky** (`c-Gm5phXi2gY`): `WithName(Now() - [Čas výpůjčky], diff,   If(     diff < 1,  /* méně než 1 den */     ToText(RoundDown(diff*24)) + " h",     ToText(RoundDown(diff)) + " dny"   ) )`
- **Typ** (`c-R181k-D1s4`): `[Předmět].Typ`
- **Obrázek** (`c-HIea6Hp53n`): `[Předmět].[Obrázek]`

### ObecneCasti

- **Charakteristika** (`c-ATUzo6CSPy`): `[HTML Renderer]RenderHtml([Charakteristika RAW])`
- **Subitems** (`c-t3nvwovTk5`): `ObecneCasti.Filter(Parent.Contains(thisRow))`

### Lodičky od 1.9.2025

- **Znění RVP** (`c-JVsr6Q9upe`): `[Kód OVU].OVU_zneni.ListCombine()`
- **Počet let** (`c-tm00TzDguE`): `[Ročník do]-[Ročník od]+1`
- **Počet plaveb** (`c-gRsPRikgnu`): `[Počet let]*5`
- **Kód** (`c-vYO6HGC0Cp`): `[Předmět].Zkratka+"-"+if([Podpředmět],[Podpředmět].Zkratka,[Předmět].Zkratka)+"-"+left(last([Ročník]),1)+"-"+leftpad((RowId(thisRow).ToText()),3,"0")`
- **Smazat** (`c-lZhAAylb0S`): ``
- **Ročník od** (`c-3I1o1VfzA1`): `left([Ročník].First(),1).ToNumber()`
- **Ročník do** (`c-2Pjel3MZQT`): `left([Ročník].Last(),1).ToNumber()`

### Předměty

- **Počet lodiček** (`c-B2UYqeswFR`): `[Lodičky od 1.9.2025].Filter([Předmět]=thisRow).Count()`

### Podpředměty

- **Počet lodiček** (`c-bd70GxC7x9`): `[Lodičky od 1.9.2025].Filter([Podpředmět]=thisRow).Count()`

### Osobní lodičky

- **Stav** (`c-AP2fUynFbe`): `[Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1)`
- **Hodnota** (`c-H7C9KdzQ8I`): `Stav.Hodnota`
- **Smečka** (`c-wdUUsanACr`): `[Jméno].[Smečka]`
- **Aktivní** (`c-wGyKzGNASL`): `[Jméno].[Aktivní]`
- **Garant** (`c-ETfsa_OPRw`): `[Lodička].Garant`
- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **-** (`c-HgMvO9yZzg`): ``
- **+** (`c-k-Fvl5AU_z`): ``
- **Hodnota stavu** (`c-U7KQdppjxK`): `Stav.Hodnota`
- **Kód osobní lodičky** (`c--2LqS2G1oM`): `[ID žáka]+"-"+[Kód lodičky]`
- **ID žáka** (`c-WJOFyTmLb0`): `[Jméno].ID`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **Historie** (`c-LbIdXWqnl0`): `[Historie lodiček].Filter([Osobní lodička].Contains(thisRow))`
- **Kód lodičky** (`c-jHa_FpDumI`): `[Lodička].[Kód]`
- **Ročník** (`c-SE3NZt0wQP`): `[Jméno].[Ročník]`
- **Název lodičky dlouhý** (`c-bYmKSGL0RL`): `[Lodička].[Název lodičky]`
- **Kód OVU** (`c-KjnU2LstNz`): `[Lodička].[Kód OVU]`
- **Znění RVP** (`c-Clh6Bb_xgT`): `[Lodička].[Znění RVP]`
- **Fotka** (`c-Zp1zU2_ulM`): `[Jméno].Fotka`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Přezdívka** (`c-Bqrg4lLbml`): `[Jméno].[Přezdívka]`
- **Typ studia** (`c-Sc2enM5VSp`): `[Jméno].[Docházka]`
- **Změnil** (`c-66wgJF9WAF`): `[Seznam osob].Filter(User=thisRow.ModifiedBy()).First()`
- **Smazaná** (`c-ZFYsSAGsHy`): `[Lodička].[Smazaná]`
- **Počáteční hodnota** (`c-KBmhTcIKRc`): `[Stupně lodiček]`
- **Vstupní stav** (`c-X5v5nrWjaW`): `[Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum stavu]=Date(2025, 9, 1)).Sort(true,[Datum stavu]).Last().Stav`
- **1. plavba** (`c-THoLDgrzlc`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>Date(2025, 9, 1),[Datum stavu]<=Date(2025, 10, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **2. plavba** (`c-I93mCblJK4`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2025, 11, 1),[Datum stavu]<=Date(2025, 12, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **3. plavba** (`c-LcDCHr388O`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 1, 1),[Datum stavu]<=Date(2026, 2, 28))).Sort(true,[Datum stavu]).Last().Stav`
- **4. plavba** (`c-vZUh_zFRQo`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 3, 1),[Datum stavu]<=Date(2026, 4, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **5. plavba** (`c-_OJHt3jmxm`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 5, 1),[Datum stavu]<=Date(2026, 6, 30))).Sort(true,[Datum stavu]).Last().Stav`

### Historie lodiček

- **Hodnota** (`c-1Cs5NzzeVd`): `Stav.Hodnota`
- **Modified on** (`c-r13OL7lcTE`): `thisRow.Modified()`
- **Modified by** (`c-t9w9HRacgb`): `thisRow.ModifiedBy()`
- **Created by** (`c-rozfffQLbC`): `thisRow.CreatedBy()`
- **Školní rok** (`c-DbiQrA-aDZ`): `Plavba.[Školní rok]`
- **Smazaná** (`c-Cg8VkqvaVV`): `[Osobní lodička].[Smazaná]`
- **Ročník** (`c-vRaCLGoKbV`): `Left([Ročník textem],1 ).ToNumber()`
- **Předmět** (`c-RGhm9o0m6m`): `[Osobní lodička].[Předmět]`
- **Hodnota stavu** (`c-mYnRMrAAt2`): `[Osobní lodička].[Hodnota stavu]`
- **Oblast** (`c-lcLy_GFpsL`): `[Osobní lodička].Oblast`
- **Jméno** (`c-2h8jBb6UK4`): `[Osobní lodička].[Přezdívka]`
- **Ročník textem** (`c-YgXgpV6ObC`): `[Osobní lodička].[Ročník]`
- **Smečka** (`c-9uBlbifRZq`): `[Osobní lodička].[Smečka]`

### Osobní lodičky v tabulce

- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Smečka** (`c-wdUUsanACr`): `[Jméno].[Smečka]`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **-** (`c-HgMvO9yZzg`): ``
- **Stav** (`c-AP2fUynFbe`): `[Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1)`
- **+** (`c-k-Fvl5AU_z`): ``

### Slovní hodnocení

- **Smečka** (`c-NNrDg-OVqr`): `[Jméno].[Smečka]`
- **Patron** (`c-jMHnGBxbqH`): `[Smečka].Patron`
- **Dostupný text** (`c-FJhA26yy-l`): `1-Length([Hodnocení])/2000`
- **ID hodnocení** (`c-G6KgC_sv5G`): `thisRow.RowId()`
- **Odeslat** (`c-zaL_k-a6_w`): ``
- **Stav** (`c-T_Reyf5vyv`): `[Stav hodnocení]`
- **Akt.** (`c-AFkCMC02Qc`): ``
- **Celkový prospěch** (`c-WCTIBIAWBg`): `WithName(   [Vysvědčení - hodnocení předmětů]     .Filter(       And(         [Jméno] = [Jméno],         [Známka].IsNotBlank()       )     )     .[Známka],   z,   If(     z.Contains(5),     "Neprospěl",     If(       And(         z.Average() <= 1.5,         z.Max() < 3       ),       "Prospěl s vyznamenáním",       "Prospěl"     )   ) )`

### Hodnocení pro vysvědčení

- **Ročník** (`c-vRaCLGoKbV`): `Left([Ročník textem],1 ).ToNumber()`
- **Smečka** (`c-9uBlbifRZq`): `[Osobní lodička].[Smečka]`
- **Jméno** (`c-2h8jBb6UK4`): `[Osobní lodička].[Přezdívka]`
- **Předmět** (`c-RGhm9o0m6m`): `[Osobní lodička].[Předmět]`
- **Oblast** (`c-lcLy_GFpsL`): `[Osobní lodička].Oblast`
- **Hodnota** (`c-1Cs5NzzeVd`): `Stav.Hodnota`
- **Smazaná** (`c-Cg8VkqvaVV`): `[Osobní lodička].[Smazaná]`

### Oblasti vysvědčení

- **Počet lodiček** (`c-ZGL1UB29Iy`): `[Lodičky od 1.9.2025].Filter(and([Smazaná]=false,[Stupeň]=[Stupeň],[Předmět]=[Předmět],Oblast=thisRow )).Count()`
- **Suma bodů** (`c-kHZtg-gS4W`): `[Počet lodiček]*4`
- **Počet období** (`c-ro3rcqZ8ZF`): `[Ročníky].Count()*2`

### Vysvědčení - slovní hodnocení

- **Smečka** (`c-NNrDg-OVqr`): `[Jméno].[Smečka]`
- **Celkový prospěch** (`c-WCTIBIAWBg`): `WithName(   [Vysvědčení - hodnocení předmětů]     .Filter(       And(         [Jméno] = [Jméno],         [Známka].IsNotBlank()       )     )     .[Známka],   z,   If(     z.Contains(5),     "Neprospěl",     If(       And(         z.Average() <= 1.5,         z.Max() < 3       ),       "Prospěl s vyznamenáním",       "Prospěl"     )   ) )`

### Předměty vysvědčení

- **Počet lodiček** (`c-uoyfwPpoYs`): `[Lodičky od 1.9.2025].Filter(and([Smazaná]=false,[Stupeň]=[Stupeň],[Předmět]=[Předmět]  )).Count()`
- **Počet období** (`c-w9oj9EpJl7`): `[Ročníky].Count()*2`
- **Suma bodů** (`c--7ns0N4lDH`): `[Počet lodiček]*4`
- **Předmět vysvědčení** (`c-Hon8FwJaYd`): `Left([Stupeň],2)+" "+[Předmět].Name`

### Vysvědčení - hodnocení oblastí

- **Aktuální body** (`c-wRu87PvHCi`): `[Osobní lodičky].Filter(and([Jméno]=[Jméno],Oblast=Oblast,[Smazaná]=false)).Hodnota.Sum()`
- **Smečka** (`c--tWX0RYMDQ`): `[Jméno].[Smečka]`
- **Aktuální ročník** (`c-2vDenkjqH9`): `[Jméno].[Aktuální ročník].ToNumber()`
- **Počáteční ročník** (`c-03HKMXeJKh`): `[Jméno].[Počáteční ročník]`
- **Oblast celkem** (`c-5mVt75lgIO`): `Oblast.[Suma bodů]`
- **Stará norma** (`c-H8N9Vt1ryn`): `(([Aktuální ročník]-[Základna období])*2+1)/[Počet období]*[Oblast celkem]`
- **Počet období** (`c-TC410Ngi4Z`): `Oblast.[Počet období]`
- **Staré hodnocení** (`c-jZhu4nEtXD`): `[Body celkem]/[Stará norma]`
- **Dopočet při přestupu** (`c-B54-A7-5WI`): `(SwitchIf([Počáteční ročník]=1 or [Počáteční ročník]=5,0,and([Počáteční ročník]>6,[Aktuální ročník]>6),[Počáteční ročník]-6,and([Počáteční ročník]>1,[Aktuální ročník]<6),[Počáteční ročník]-1,0 )*2)/[Počet období]*[Dopočet základ]`
- **Předmět** (`c-FbbeJ33EsP`): `Oblast.[Předmět]`
- **Základna období** (`c-MyzNz9pERv`): `[Lodičky od 1.9.2025].Filter(Oblast=Oblast).[Ročník od].First()`
- **Historické lodičky** (`c-iKucJbAf8_`): `[Lodičky od 1.9.2025].Filter(and(Oblast=Oblast,[Smazaná]=false,[Ročník do]<[Aktuální ročník])).Count()*4`
- **Body celkem** (`c-D1XChdOh40`): `[Aktuální body]+[Historické lodičky]+[Dopočet při přestupu]`
- **Dopočet základ** (`c-0ayuFLzuR1`): `[Lodičky od 1.9.2025].Filter(And([Smazaná]=false,Oblast=Oblast,[Ročník do]>=[Aktuální ročník],[Ročník od]<[Počáteční ročník])).Count()*4`
- **Norma** (`c-6AxGhTQBq5`): `If(or([Základna období]=2,[Základna období]=7),[Křivka plnění lodiček].Filter([Ročník]=[Ročník] and [Pololetí]=[1. pololetí]).[Norma zkrácená]*[Oblast celkem],[Křivka plnění lodiček].Filter([Ročník]=[Ročník] and [Pololetí]=[1. pololetí]).Norma*[Oblast celkem])`
- **Ročník** (`c-o-wbC0pNhQ`): `[Jméno].[Ročník]`
- **Hodnocení** (`c-LbpmBdYHFo`): `[Body celkem]/Norma`
- **Podpředmět** (`c-T1L9sVXOBM`): `Oblast.[Podpředmět]`
- **Celkový pokrok** (`c-opBivDae2F`): `min([Body celkem]/[Oblast celkem],1)`
- **Předchozí body** (`c-2KoekQ84uU`): `[Historie lodiček].Filter(and([Smazaná]=false,[Datum stavu]=Date(2025, 9, 1),Oblast=Oblast,[Jméno]=[Jméno].ToText())).Hodnota.Sum()+[Dopočet při přestupu]+[Historické lodičky]`
- **Předchozí norma** (`c-q0en51VvcR`): `If(or([Základna období]=2,[Základna období]=7),[Křivka plnění lodiček].Filter([Ročník]=[Ročník] and [Pololetí]=[1. pololetí]).[Předchozí norma zkrácená]*[Oblast celkem],[Křivka plnění lodiček].Filter([Ročník]=[Ročník] and [Pololetí]=[1. pololetí]).[Předchozí norma]*[Oblast celkem])`
- **Předchozí hodnocení** (`c-xYY6K0Z-xr`): `If(   [Předchozí norma].IsBlank() OR [Předchozí norma] = 0,   0,   [Předchozí body] / [Předchozí norma] )`
- **Předchozí celkový pokrok** (`c-rXFsuNTWGH`): `min([Předchozí body]/[Oblast celkem],1)`
- **Tempo změny** (`c-GlqL3aRBg5`): `(([Body celkem] - [Předchozí body]) - (Norma - [Předchozí norma])) / [Oblast celkem]`
- **Zbývá bodů** (`c-JE-uo_HF1P`): `[Oblast celkem]-[Body celkem]`

### Vysvědčení - hodnocení předmětů

- **Smečka** (`c-qlgWy5b7gm`): `[Jméno].[Smečka]`
- **Počet období** (`c-jIR9C8oS3J`): `[Předmět vysvědčení].[Počet období]`
- **Body celkem** (`c-VpreYM7lLn`): `[Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno],[Předmět]=[Předmět])).[Body celkem] .Sum()`
- **Předmět** (`c-UXuyii8itd`): `[Předmět vysvědčení].[Předmět]`
- **Stará norma** (`c-m8z9F6mUfc`): `[Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno],[Předmět]=[Předmět])).[Stará norma].Sum()`
- **Předmět celkem** (`c-HFd9pHASFz`): `[Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno],[Předmět]=[Předmět])).[Oblast celkem].Sum()`
- **Aktuální ročník** (`c-VM1MuomFeZ`): `[Jméno].[Aktuální ročník]`
- **Základna období** (`c-vIV_43NCoU`): `if([Aktuální ročník]>5,6,1)`
- **Staré hodnocení** (`c-xtqoF9CCfy`): `[Body celkem]/[Stará norma]`
- **Stará známka** (`c-7kx_gGkQnW`): `[Známková pásma].Filter([Hodnocení od]<[Staré hodnocení] and [Hodnocení do]>=[Staré hodnocení])`
- **Norma** (`c-FQEmOP1h7p`): `[Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno],[Předmět]=[Předmět])).Norma .Sum()`
- **Hodnocení** (`c-cbGW-UNRmI`): `[Body celkem]/Norma`
- **Známka** (`c-C_HG0Ixe82`): `[Známková pásma].Filter([Hodnocení od]<[Hodnocení] and [Hodnocení do]>=[Hodnocení])`
- **Ročník** (`c--OBfx7zfF2`): `[Jméno].[Ročník]`
- **Předchozí norma** (`c-1o4-CpyKdG`): `[Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno],[Předmět]=[Předmět])).[Předchozí norma].Sum()`
- **Předchozí hodnocení** (`c-P0OQyo1jHi`): `If(   [Předchozí norma].IsBlank() OR [Předchozí norma] = 0,   0,   [Předchozí body] / [Předchozí norma] )`
- **Předchozí body** (`c-9-0e9CQ0zZ`): `[Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno],[Předmět]=[Předmět])).[Předchozí body].Sum()`
- **Tempo změny** (`c-3ilIUhumPd`): `(([Body celkem] - [Předchozí body]) - (Norma - [Předchozí norma])) / [Předmět celkem]`
- **Zbývá bodů** (`c-XwxMW8a5yh`): `[Předmět celkem]-[Body celkem]`

### Křivka plnění lodiček

- **Norma** (`c-ctMybhCUbr`): `thisTable.Filter([Stupeň]=[Stupeň] and [Období]<=[Období]).Hodnota.Sum()`
- **Norma zkrácená** (`c-kRj7A9aitl`): `thisTable.Filter([Stupeň]=[Stupeň] and [Období]<=[Období]).[Hodnota zkrácená].Sum()`
- **Roční podíl** (`c-D1Af035H3k`): `thisTable.Filter([Ročník]=[Ročník]).Hodnota.Sum()`
- **Předchozí norma** (`c--RMRoBV-_-`): `thisTable.Filter([Stupeň]=[Stupeň] and [Období]<[Období]).Hodnota.Sum()`
- **Předchozí norma zkrácená** (`c-6Zt_GKuppG`): `thisTable.Filter([Stupeň]=[Stupeň] and [Období]<[Období]).[Hodnota zkrácená].Sum()`

### Oblasti pro tisk

- **Smečka** (`c--tWX0RYMDQ`): `[Jméno].[Smečka]`
- **Předmět** (`c-FbbeJ33EsP`): `Oblast.[Předmět]`
- **Podpředmět** (`c-T1L9sVXOBM`): `Oblast.[Podpředmět]`
- **Předchozí body** (`c-2KoekQ84uU`): `[Historie lodiček].Filter(and([Smazaná]=false,[Datum stavu]=Date(2025, 9, 1),Oblast=Oblast,[Jméno]=[Jméno].ToText())).Hodnota.Sum()+[Dopočet při přestupu]+[Historické lodičky]`
- **Body celkem** (`c-D1XChdOh40`): `[Aktuální body]+[Historické lodičky]+[Dopočet při přestupu]`
- **Zbývá bodů** (`c-JE-uo_HF1P`): `[Oblast celkem]-[Body celkem]`
- **Předchozí norma** (`c-q0en51VvcR`): `If(or([Základna období]=2,[Základna období]=7),[Křivka plnění lodiček].Filter([Ročník]=[Ročník] and [Pololetí]=[1. pololetí]).[Předchozí norma zkrácená]*[Oblast celkem],[Křivka plnění lodiček].Filter([Ročník]=[Ročník] and [Pololetí]=[1. pololetí]).[Předchozí norma]*[Oblast celkem])`
- **Norma** (`c-6AxGhTQBq5`): `If(or([Základna období]=2,[Základna období]=7),[Křivka plnění lodiček].Filter([Ročník]=[Ročník] and [Pololetí]=[1. pololetí]).[Norma zkrácená]*[Oblast celkem],[Křivka plnění lodiček].Filter([Ročník]=[Ročník] and [Pololetí]=[1. pololetí]).Norma*[Oblast celkem])`

### Předměty pro tisk

- **Smečka** (`c-qlgWy5b7gm`): `[Jméno].[Smečka]`
- **Předmět** (`c-UXuyii8itd`): `[Předmět vysvědčení].[Předmět]`
- **Hodnocení** (`c-cbGW-UNRmI`): `[Body celkem]/Norma`
- **Předchozí hodnocení** (`c-P0OQyo1jHi`): `If(   [Předchozí norma].IsBlank() OR [Předchozí norma] = 0,   0,   [Předchozí body] / [Předchozí norma] )`
- **Tempo změny** (`c-3ilIUhumPd`): `(([Body celkem] - [Předchozí body]) - (Norma - [Předchozí norma])) / [Předmět celkem]`

### Hodnocení předmětů

- **Předmět** (`c-UXuyii8itd`): `[Předmět vysvědčení].[Předmět]`
- **Předmět celkem** (`c-HFd9pHASFz`): `[Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno],[Předmět]=[Předmět])).[Oblast celkem].Sum()`
- **Body celkem** (`c-VpreYM7lLn`): `[Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno],[Předmět]=[Předmět])).[Body celkem] .Sum()`
- **Norma** (`c-FQEmOP1h7p`): `[Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno],[Předmět]=[Předmět])).Norma .Sum()`
- **Hodnocení** (`c-cbGW-UNRmI`): `[Body celkem]/Norma`

### Hodnocení oblastí

- **Předmět** (`c-FbbeJ33EsP`): `Oblast.[Předmět]`
- **Oblast celkem** (`c-5mVt75lgIO`): `Oblast.[Suma bodů]`
- **Dopočet při přestupu** (`c-B54-A7-5WI`): `(SwitchIf([Počáteční ročník]=1 or [Počáteční ročník]=5,0,and([Počáteční ročník]>6,[Aktuální ročník]>6),[Počáteční ročník]-6,and([Počáteční ročník]>1,[Aktuální ročník]<6),[Počáteční ročník]-1,0 )*2)/[Počet období]*[Dopočet základ]`
- **Historické lodičky** (`c-iKucJbAf8_`): `[Lodičky od 1.9.2025].Filter(and(Oblast=Oblast,[Smazaná]=false,[Ročník do]<[Aktuální ročník])).Count()*4`
- **Aktuální body** (`c-wRu87PvHCi`): `[Osobní lodičky].Filter(and([Jméno]=[Jméno],Oblast=Oblast,[Smazaná]=false)).Hodnota.Sum()`
- **Body celkem** (`c-D1XChdOh40`): `[Aktuální body]+[Historické lodičky]+[Dopočet při přestupu]`
- **Norma** (`c-6AxGhTQBq5`): `If(or([Základna období]=2,[Základna období]=7),[Křivka plnění lodiček].Filter([Ročník]=[Ročník] and [Pololetí]=[1. pololetí]).[Norma zkrácená]*[Oblast celkem],[Křivka plnění lodiček].Filter([Ročník]=[Ročník] and [Pololetí]=[1. pololetí]).Norma*[Oblast celkem])`
- **Hodnocení** (`c-LbpmBdYHFo`): `[Body celkem]/Norma`

### Rodiče

- **Aktivní** (`c-uLx5khljlC`): `If(IsBlank([Vyřazen od]),true,false)`
- **Ročník** (`c-htPmrPqL_r`): `WithName(   Skupiny.Filter(Skupina = [Aktuální ročník].ToText() + ". ročník"),   g,   If(g.Count() = 0, "", g.First()) )`

### Lodičky dítěte

- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **Stav** (`c-AP2fUynFbe`): `[Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1)`

### Lodičky dítěte po plavbách

- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **Vstupní stav** (`c-X5v5nrWjaW`): `[Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum stavu]=Date(2025, 9, 1)).Sort(true,[Datum stavu]).Last().Stav`
- **1. plavba** (`c-THoLDgrzlc`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>Date(2025, 9, 1),[Datum stavu]<=Date(2025, 10, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **2. plavba** (`c-I93mCblJK4`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2025, 11, 1),[Datum stavu]<=Date(2025, 12, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **3. plavba** (`c-LcDCHr388O`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 1, 1),[Datum stavu]<=Date(2026, 2, 28))).Sort(true,[Datum stavu]).Last().Stav`
- **4. plavba** (`c-vZUh_zFRQo`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 3, 1),[Datum stavu]<=Date(2026, 4, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **5. plavba** (`c-_OJHt3jmxm`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 5, 1),[Datum stavu]<=Date(2026, 6, 30))).Sort(true,[Datum stavu]).Last().Stav`

### 1. ročník

- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Smečka** (`c-wdUUsanACr`): `[Jméno].[Smečka]`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **-** (`c-HgMvO9yZzg`): ``
- **Stav** (`c-AP2fUynFbe`): `[Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1)`
- **+** (`c-k-Fvl5AU_z`): ``
- **1. plavba** (`c-THoLDgrzlc`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>Date(2025, 9, 1),[Datum stavu]<=Date(2025, 10, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **2. plavba** (`c-I93mCblJK4`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2025, 11, 1),[Datum stavu]<=Date(2025, 12, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **3. plavba** (`c-LcDCHr388O`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 1, 1),[Datum stavu]<=Date(2026, 2, 28))).Sort(true,[Datum stavu]).Last().Stav`
- **4. plavba** (`c-vZUh_zFRQo`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 3, 1),[Datum stavu]<=Date(2026, 4, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **5. plavba** (`c-_OJHt3jmxm`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 5, 1),[Datum stavu]<=Date(2026, 6, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **Vstupní stav** (`c-X5v5nrWjaW`): `[Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum stavu]=Date(2025, 9, 1)).Sort(true,[Datum stavu]).Last().Stav`
- **Znění RVP** (`c-Clh6Bb_xgT`): `[Lodička].[Znění RVP]`
- **Název lodičky dlouhý** (`c-bYmKSGL0RL`): `[Lodička].[Název lodičky]`

### 2. ročník

- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Smečka** (`c-wdUUsanACr`): `[Jméno].[Smečka]`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **-** (`c-HgMvO9yZzg`): ``
- **Stav** (`c-AP2fUynFbe`): `[Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1)`
- **+** (`c-k-Fvl5AU_z`): ``
- **1. plavba** (`c-THoLDgrzlc`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>Date(2025, 9, 1),[Datum stavu]<=Date(2025, 10, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **2. plavba** (`c-I93mCblJK4`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2025, 11, 1),[Datum stavu]<=Date(2025, 12, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **3. plavba** (`c-LcDCHr388O`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 1, 1),[Datum stavu]<=Date(2026, 2, 28))).Sort(true,[Datum stavu]).Last().Stav`
- **4. plavba** (`c-vZUh_zFRQo`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 3, 1),[Datum stavu]<=Date(2026, 4, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **5. plavba** (`c-_OJHt3jmxm`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 5, 1),[Datum stavu]<=Date(2026, 6, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **Vstupní stav** (`c-X5v5nrWjaW`): `[Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum stavu]=Date(2025, 9, 1)).Sort(true,[Datum stavu]).Last().Stav`
- **Znění RVP** (`c-Clh6Bb_xgT`): `[Lodička].[Znění RVP]`
- **Název lodičky dlouhý** (`c-bYmKSGL0RL`): `[Lodička].[Název lodičky]`

### 3. ročník

- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Smečka** (`c-wdUUsanACr`): `[Jméno].[Smečka]`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **-** (`c-HgMvO9yZzg`): ``
- **Stav** (`c-AP2fUynFbe`): `[Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1)`
- **+** (`c-k-Fvl5AU_z`): ``
- **1. plavba** (`c-THoLDgrzlc`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>Date(2025, 9, 1),[Datum stavu]<=Date(2025, 10, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **2. plavba** (`c-I93mCblJK4`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2025, 11, 1),[Datum stavu]<=Date(2025, 12, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **3. plavba** (`c-LcDCHr388O`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 1, 1),[Datum stavu]<=Date(2026, 2, 28))).Sort(true,[Datum stavu]).Last().Stav`
- **4. plavba** (`c-vZUh_zFRQo`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 3, 1),[Datum stavu]<=Date(2026, 4, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **5. plavba** (`c-_OJHt3jmxm`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 5, 1),[Datum stavu]<=Date(2026, 6, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **Vstupní stav** (`c-X5v5nrWjaW`): `[Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum stavu]=Date(2025, 9, 1)).Sort(true,[Datum stavu]).Last().Stav`
- **Název lodičky dlouhý** (`c-bYmKSGL0RL`): `[Lodička].[Název lodičky]`
- **Znění RVP** (`c-Clh6Bb_xgT`): `[Lodička].[Znění RVP]`

### 4. ročník

- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Smečka** (`c-wdUUsanACr`): `[Jméno].[Smečka]`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **-** (`c-HgMvO9yZzg`): ``
- **Stav** (`c-AP2fUynFbe`): `[Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1)`
- **+** (`c-k-Fvl5AU_z`): ``
- **1. plavba** (`c-THoLDgrzlc`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>Date(2025, 9, 1),[Datum stavu]<=Date(2025, 10, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **2. plavba** (`c-I93mCblJK4`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2025, 11, 1),[Datum stavu]<=Date(2025, 12, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **3. plavba** (`c-LcDCHr388O`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 1, 1),[Datum stavu]<=Date(2026, 2, 28))).Sort(true,[Datum stavu]).Last().Stav`
- **4. plavba** (`c-vZUh_zFRQo`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 3, 1),[Datum stavu]<=Date(2026, 4, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **5. plavba** (`c-_OJHt3jmxm`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 5, 1),[Datum stavu]<=Date(2026, 6, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **Vstupní stav** (`c-X5v5nrWjaW`): `[Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum stavu]=Date(2025, 9, 1)).Sort(true,[Datum stavu]).Last().Stav`
- **Název lodičky dlouhý** (`c-bYmKSGL0RL`): `[Lodička].[Název lodičky]`
- **Znění RVP** (`c-Clh6Bb_xgT`): `[Lodička].[Znění RVP]`

### Hodnocení předmětů export

- **Předmět** (`c-UXuyii8itd`): `[Předmět vysvědčení].[Předmět]`
- **Předmět celkem** (`c-HFd9pHASFz`): `[Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno],[Předmět]=[Předmět])).[Oblast celkem].Sum()`
- **Body celkem** (`c-VpreYM7lLn`): `[Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno],[Předmět]=[Předmět])).[Body celkem] .Sum()`
- **Norma** (`c-FQEmOP1h7p`): `[Vysvědčení - hodnocení oblastí].Filter(and([Jméno]=[Jméno],[Předmět]=[Předmět])).Norma .Sum()`
- **Hodnocení** (`c-cbGW-UNRmI`): `[Body celkem]/Norma`

### Hodnocení oblastí export

- **Předmět** (`c-FbbeJ33EsP`): `Oblast.[Předmět]`
- **Oblast celkem** (`c-5mVt75lgIO`): `Oblast.[Suma bodů]`
- **Dopočet při přestupu** (`c-B54-A7-5WI`): `(SwitchIf([Počáteční ročník]=1 or [Počáteční ročník]=5,0,and([Počáteční ročník]>6,[Aktuální ročník]>6),[Počáteční ročník]-6,and([Počáteční ročník]>1,[Aktuální ročník]<6),[Počáteční ročník]-1,0 )*2)/[Počet období]*[Dopočet základ]`
- **Historické lodičky** (`c-iKucJbAf8_`): `[Lodičky od 1.9.2025].Filter(and(Oblast=Oblast,[Smazaná]=false,[Ročník do]<[Aktuální ročník])).Count()*4`
- **Aktuální body** (`c-wRu87PvHCi`): `[Osobní lodičky].Filter(and([Jméno]=[Jméno],Oblast=Oblast,[Smazaná]=false)).Hodnota.Sum()`
- **Body celkem** (`c-D1XChdOh40`): `[Aktuální body]+[Historické lodičky]+[Dopočet při přestupu]`
- **Norma** (`c-6AxGhTQBq5`): `If(or([Základna období]=2,[Základna období]=7),[Křivka plnění lodiček].Filter([Ročník]=[Ročník] and [Pololetí]=[1. pololetí]).[Norma zkrácená]*[Oblast celkem],[Křivka plnění lodiček].Filter([Ročník]=[Ročník] and [Pololetí]=[1. pololetí]).Norma*[Oblast celkem])`
- **Hodnocení** (`c-LbpmBdYHFo`): `[Body celkem]/Norma`

### 5. ročník

- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Smečka** (`c-wdUUsanACr`): `[Jméno].[Smečka]`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **-** (`c-HgMvO9yZzg`): ``
- **Stav** (`c-AP2fUynFbe`): `[Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1)`
- **+** (`c-k-Fvl5AU_z`): ``
- **1. plavba** (`c-THoLDgrzlc`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>Date(2025, 9, 1),[Datum stavu]<=Date(2025, 10, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **2. plavba** (`c-I93mCblJK4`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2025, 11, 1),[Datum stavu]<=Date(2025, 12, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **3. plavba** (`c-LcDCHr388O`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 1, 1),[Datum stavu]<=Date(2026, 2, 28))).Sort(true,[Datum stavu]).Last().Stav`
- **4. plavba** (`c-vZUh_zFRQo`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 3, 1),[Datum stavu]<=Date(2026, 4, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **5. plavba** (`c-_OJHt3jmxm`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 5, 1),[Datum stavu]<=Date(2026, 6, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **Vstupní stav** (`c-X5v5nrWjaW`): `[Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum stavu]=Date(2025, 9, 1)).Sort(true,[Datum stavu]).Last().Stav`
- **Název lodičky dlouhý** (`c-bYmKSGL0RL`): `[Lodička].[Název lodičky]`
- **Znění RVP** (`c-Clh6Bb_xgT`): `[Lodička].[Znění RVP]`

### 6. ročník

- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Smečka** (`c-wdUUsanACr`): `[Jméno].[Smečka]`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **-** (`c-HgMvO9yZzg`): ``
- **Stav** (`c-AP2fUynFbe`): `[Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1)`
- **+** (`c-k-Fvl5AU_z`): ``
- **1. plavba** (`c-THoLDgrzlc`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>Date(2025, 9, 1),[Datum stavu]<=Date(2025, 10, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **2. plavba** (`c-I93mCblJK4`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2025, 11, 1),[Datum stavu]<=Date(2025, 12, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **3. plavba** (`c-LcDCHr388O`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 1, 1),[Datum stavu]<=Date(2026, 2, 28))).Sort(true,[Datum stavu]).Last().Stav`
- **4. plavba** (`c-vZUh_zFRQo`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 3, 1),[Datum stavu]<=Date(2026, 4, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **5. plavba** (`c-_OJHt3jmxm`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 5, 1),[Datum stavu]<=Date(2026, 6, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **Vstupní stav** (`c-X5v5nrWjaW`): `[Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum stavu]=Date(2025, 9, 1)).Sort(true,[Datum stavu]).Last().Stav`
- **Název lodičky dlouhý** (`c-bYmKSGL0RL`): `[Lodička].[Název lodičky]`
- **Znění RVP** (`c-Clh6Bb_xgT`): `[Lodička].[Znění RVP]`

### 7. ročník

- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Smečka** (`c-wdUUsanACr`): `[Jméno].[Smečka]`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **-** (`c-HgMvO9yZzg`): ``
- **Stav** (`c-AP2fUynFbe`): `[Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1)`
- **+** (`c-k-Fvl5AU_z`): ``
- **1. plavba** (`c-THoLDgrzlc`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>Date(2025, 9, 1),[Datum stavu]<=Date(2025, 10, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **2. plavba** (`c-I93mCblJK4`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2025, 11, 1),[Datum stavu]<=Date(2025, 12, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **3. plavba** (`c-LcDCHr388O`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 1, 1),[Datum stavu]<=Date(2026, 2, 28))).Sort(true,[Datum stavu]).Last().Stav`
- **4. plavba** (`c-vZUh_zFRQo`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 3, 1),[Datum stavu]<=Date(2026, 4, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **5. plavba** (`c-_OJHt3jmxm`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 5, 1),[Datum stavu]<=Date(2026, 6, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **Vstupní stav** (`c-X5v5nrWjaW`): `[Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum stavu]=Date(2025, 9, 1)).Sort(true,[Datum stavu]).Last().Stav`
- **Název lodičky dlouhý** (`c-bYmKSGL0RL`): `[Lodička].[Název lodičky]`
- **Znění RVP** (`c-Clh6Bb_xgT`): `[Lodička].[Znění RVP]`

### 8. ročník

- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Smečka** (`c-wdUUsanACr`): `[Jméno].[Smečka]`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **-** (`c-HgMvO9yZzg`): ``
- **Stav** (`c-AP2fUynFbe`): `[Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1)`
- **+** (`c-k-Fvl5AU_z`): ``
- **1. plavba** (`c-THoLDgrzlc`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>Date(2025, 9, 1),[Datum stavu]<=Date(2025, 10, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **2. plavba** (`c-I93mCblJK4`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2025, 11, 1),[Datum stavu]<=Date(2025, 12, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **3. plavba** (`c-LcDCHr388O`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 1, 1),[Datum stavu]<=Date(2026, 2, 28))).Sort(true,[Datum stavu]).Last().Stav`
- **4. plavba** (`c-vZUh_zFRQo`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 3, 1),[Datum stavu]<=Date(2026, 4, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **5. plavba** (`c-_OJHt3jmxm`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 5, 1),[Datum stavu]<=Date(2026, 6, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **Vstupní stav** (`c-X5v5nrWjaW`): `[Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum stavu]=Date(2025, 9, 1)).Sort(true,[Datum stavu]).Last().Stav`
- **Název lodičky dlouhý** (`c-bYmKSGL0RL`): `[Lodička].[Název lodičky]`
- **Znění RVP** (`c-Clh6Bb_xgT`): `[Lodička].[Znění RVP]`

### 9. ročník

- **Předmět** (`c-obSQ5dEK0z`): `[Lodička].[Předmět]`
- **Podpředmět** (`c-trddTED3wc`): `[Lodička].[Podpředmět]`
- **Oblast** (`c-RUxQ0_Ii9O`): `[Lodička].Oblast`
- **Smečka** (`c-wdUUsanACr`): `[Jméno].[Smečka]`
- **Název lodičky** (`c-awKbb-1mcj`): `[Lodička].[Zkrácený název]`
- **-** (`c-HgMvO9yZzg`): ``
- **Stav** (`c-AP2fUynFbe`): `[Stupně lodiček].Filter([Pořadí]=[Pořadí stavu]).Nth(1)`
- **+** (`c-k-Fvl5AU_z`): ``
- **1. plavba** (`c-THoLDgrzlc`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>Date(2025, 9, 1),[Datum stavu]<=Date(2025, 10, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **2. plavba** (`c-I93mCblJK4`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2025, 11, 1),[Datum stavu]<=Date(2025, 12, 31))).Sort(true,[Datum stavu]).Last().Stav`
- **3. plavba** (`c-LcDCHr388O`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 1, 1),[Datum stavu]<=Date(2026, 2, 28))).Sort(true,[Datum stavu]).Last().Stav`
- **4. plavba** (`c-vZUh_zFRQo`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 3, 1),[Datum stavu]<=Date(2026, 4, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **5. plavba** (`c-_OJHt3jmxm`): `[Historie lodiček].Filter(and([Osobní lodička]=thisRow, [Datum stavu]>=Date(2026, 5, 1),[Datum stavu]<=Date(2026, 6, 30))).Sort(true,[Datum stavu]).Last().Stav`
- **Vstupní stav** (`c-X5v5nrWjaW`): `[Historie lodiček].Filter([Osobní lodička]=thisRowand [Datum stavu]=Date(2025, 9, 1)).Sort(true,[Datum stavu]).Last().Stav`
- **Název lodičky dlouhý** (`c-bYmKSGL0RL`): `[Lodička].[Název lodičky]`
- **Znění RVP** (`c-Clh6Bb_xgT`): `[Lodička].[Znění RVP]`

---

## 6. Doporučení pro migraci do Supabase

1. **Base tabulky** z Coda mapovat na PostgreSQL tabulky; **view** buď jako materializované view, nebo dotazy v aplikaci.
2. **Relation sloupce** (Děti, Rodič, Jméno → osoba) nahradit FK na `seznam_osob(id)` resp. odpovídající entity.
3. **Vzorce (calculated columns)** v Coda převést na generované sloupce v PostgreSQL, trigger nebo výpočet v aplikaci.
4. **Multi-select / Select list** (např. Role, Kontaktní maily) uložit jako pole (`text[]`) nebo normalizovanou tabulku.
5. **Křivka plnění** (CODA_TABLE_CURVE): jedna tabulka s sloupci Ročník, Pololetí, Stupeň, Období, Norma, Norma zkrácená.
