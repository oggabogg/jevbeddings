# Kostnad: leverandørpanelet og studieloggene

Etter første publisering la jeg til skjermbildet fra JEVs brukspanel som dokumentasjon på prosjektets samlede forbruk. Bildet ble levert 26. september 2026 og er bevart uten redigering i [jevbeddings-usage-2026-09-26.png](results/jevbeddings-usage-2026-09-26.png). En maskinlesbar avskrift finnes i [provider-usage.json](results/provider-usage.json).

Det valgte prosjektfilteret er «JEVbeddings», perioden er «Last 7 days», og grafene vises per time. Jeg har ikke en eksport med eksakte periodegrenser eller leverandørens tidssone.

| Verdi | Avlest i panelet |
| --- | ---: |
| Kostnad (USD) | 2,0765 |
| Inputtokens | 49 439 654 |
| Tokens totalt | 57 833 096 |
| Forespørsler | 13 232 |

Panelets fotnote sier «Estimated at $0.042/MTok input · Free output». Kostnaden er derfor omtalt som **kostnaden vist i JEV-panelet**, ikke som betalt eller fakturert beløp. Avlest inputbruk ganger denne satsen gir USD 2,076465468, som avrundes til panelets USD 2,0765.

## Sammenheng med studiens egne logger

De lagrede studiekallene har 49 252 004 inputtokens, 8 361 371 outputtokens og 13 183 fullførte logiske kall. Ett kall krevde et ekstra forsøk. Kostnadsestimatet for den registrerte inputbruken var USD 2,068584168, avrundet til USD 2,0686.

Panelet viser 187 650 flere inputtokens og 48 flere forespørsler enn studiens 13 184 registrerte forsøk. Total minus input gir 8 393 442 øvrige tokens i panelet, 32 071 flere enn loggenes outputtokens. Dette siste tallet er beregnet fra panelets summer, ikke separat avlest outputbruk.

Prosjektpanelet dekker et større forbruk enn de lagrede studiekallene. Jeg har ikke avstemt dette kall for kall og vet derfor ikke hvilke forespørsler som forklarer differansen. Jeg endrer ikke de opprinnelige loggene, resultatene eller evalueringsberegningene for å få dem til å stemme med panelet.

Skjermbildet og avskriften inngår i pakkens SHA-256-inventar. Dette kontrollerer senere filendringer, men er ikke en uavhengig autentisering av skjermbildets opphav.
