# Hva materialet dokumenterer

Denne oversikten ble skrevet etter den opprinnelige kjøringen 26. september 2026. Den skiller mellom etterprøvbare resultater og historikk som bare støttes av lokale registreringer.

## Resultatene kan beregnes på nytt

Reproduksjonspakken inneholder originaltekstene, lagrede modellvurderinger, spørsmålene, rangeringskoden og resultatene. En leser kan beregne resultatene på nytt uten API-nøkkel og uten å kjøpe nye modellkall.

| Påstand eller del av studien | Lagret grunnlag | Hva det kan kontrollere |
| --- | --- | --- |
| Hele BANKING77 ble brukt | `data/banking77/train.csv`, `test.csv`, `manifest.json`, låst kildecommit | Tekster, etiketter, 10 003 dokumenter, 3 080 testsøk og kildefingeravtrykk |
| 34 egenskaper per melding | `study/schema.js`, tabellen `vectors` i `study.sqlite` | Alle 444 822 egenskapsverdier, tilhørende typede svar og tekstfingeravtrykk |
| Hovedresultatene og usikkerhetsintervallene | `study/math.js`, `evaluate.js`, `results.json`, `e1-predictions.jsonl` | Alle rangeringer, treffmål, resultater per kategori, duplikatkontroll og bootstrap |
| 100 tilleggssøk i 25 grupper | `queries.js`, `query-fixtures.json`, `e3-interpretations.json`, `e3-queries.json` | Søketekster, krav, modellens beslutninger, relevansgrupper og alle resultater |
| Åtte kontrolltilfeller og 38 ablasjoner | `results.json`, `e5-ablation-per-query.json`, samme kode og lagrede vektorer | Beregningene og hvilke treff som endres |
| Forklaringer av konkrete treff | `explanations.json`, `feature-weights.json` | Hvert egenskapsbidrag og den samlede scoren |
| Etteranalyse av dokumenter som ofte vant | `diagnose.js`, `diagnostics.json` | Vinnerfrekvenser, normer og antall sterke egenskaper |
| Registrert API-bruk | Tabellene `calls`, `vectors`, `query_results`, `sessions` i `study.sqlite` | Lokalt registrert modellnavn, tokenbruk, kallantall, forsøk, latens og tidspunkt |
| Låste definisjoner og metode | `frozen.json`, `frozen-queries.json`, `frozen-code.json`, `PROTOCOL.md`, `AMENDMENTS.md` | At de nåværende filene samsvarer med de lagrede fingeravtrykkene |

`study/results/reproduction-audit.json` dokumenterer en ny full beregning fra databasen i en separat arbeidsmappe. Den sammenligner alle resultatfelter med originalen, med unntak av nye genereringstidspunkt og lokal evalueringslatens. De opprinnelige API-tidsstemplene, tokenverdiene og API-latensene er ikke unntatt sammenligningen. Sju av de avledede resultatfilene sammenlignes også byte for byte. Originalresultatene overskrives ikke.

Kontrollen bruker den opprinnelige evalueringskoden. Det viser reproduserbarhet, men utelukker ikke en systematisk feil i samme kode. I tillegg kjøres `audit.js`, som bruker en separat fullsortering for 31 faste testsøk og sammenligner topp ti og første relevante rang for alle fire metoder. Denne kontrollen har fortsatt noe delt kode, blant annet BM25-beregningen. Dette er ikke en ekstern fagfellevurdering.

## Hva som er lagret fra API-et

For dokumentene er de parsede, typede JEV-svarene bevart i `vectors.answers`, sammen med egenskapsverdier og metadata. For tilleggssøkene er valg, sannsynligheter, konfidens, de avledede kravene og dekningsverdien bevart i `query_results`. Kalloversikten inneholder 13 183 logiske kall og ett ekstra forsøk.

Forespørselens JSON kan rekonstrueres fra originalteksten, skjemaet og den lagrede kildekoden. Det finnes derimot ikke en separat, opprinnelig kopi av alle HTTP-forespørsler og komplette HTTP-responser. HTTP-headere, eventuelle leverandør-ID-er og hele responskonvolutten utenfor feltene adapteren tok vare på, ble ikke arkivert. Mellomliggende mislykkede forsøk er ikke bevart med hver sin fullstendige respons.

Det ville være feil å fremstille rekonstruerte forespørsler som nettverkslogger fanget under kjøringen. Den nåværende pakken gjør ikke det.

## Hva lokale logger ikke beviser

Databasen er et detaljert lokalt spor av forsøket. Men lokale filer og tidsstempler kan i prinsippet endres. Verken databasen eller JSON-filene inneholder signerte kvitteringer fra TypeSafe som en ekstern leser kan autentisere.

Derfor dokumenterer pakken hvordan resultatene følger av de lagrede JEV-vurderingene. Den beviser ikke uavhengig at hvert svar kom fra leverandøren på det oppgitte tidspunktet. Tilsvarende støtter de lokale frysingsfilene den beskrevne rekkefølgen, men er ikke en eksternt attestert forhåndsregistrering eller et bevis på at testmaterialet aldri var sett tidligere.

SHA-256-kontrollsummer oppdager at innhold er endret siden en bestemt kjent kontrollsum. Hvis noen kan endre både materialet og kontrollsummen, er ikke kontrollsummen alene et bevis på autentisitet. En publisering kan gi en ekstern referanse for hva som var tilgjengelig fra publiseringstidspunktet; den kan ikke gi forsøket en tidligere, uavhengig tidsstempling i ettertid.

Brukstallene i de opprinnelige resultatfilene er rapporterte API-verdier som er lagret lokalt. Kostnadsestimatene der er beregnet fra disse og en oppgitt inputpris. Pakken inneholder nå også et [skjermbilde fra leverandørens brukspanel](results/jevbeddings-usage-2026-09-26.png), med Jevbeddings som prosjektfilter: USD 2,0765, 49 439 654 inputtokens, 57 833 096 tokens totalt og 13 232 forespørsler. Bildet ble lagt til etter første publisering. Det støtter prosjektets aggregerte bruk, men er ikke en signert kvittering eller en leverandørfaktura. Panelet merker selv kostnaden «Estimated». Prosjekttotalen er ikke avstemt mot studieloggene kall for kall; se [kostnadsnotatet](KOSTNAD.md). Aggregerte tokenverdier beviser ikke innholdet i hvert enkelt svar.

## Slik kan en leser kontrollere pakken

Pakk ZIP-filen ut i en tom mappe. Kjør kommandoene fra mappen som inneholder `package.json`. Node.js 24 kreves; ingen eksterne npm-pakker, API-nøkkel eller `.env` er nødvendig for denne kontrollen.

```sh
node study/verify-evidence.js
node study/reproduce.js
node --test
```

Den første kommandoen kontrollerer filene mot pakkens inventar. Den andre beregner alle eksperimentresultatene på nytt i `data/reproductions/replay-*`, kontrollerer dem og skriver en ny `study/results/reproduction-audit.json`. Den sender ingen API-nøkkel til delprosessene og stopper hvis evalueringskoden forsøker å bruke `fetch`. Det er ikke et generelt operativsystembasert nettverkssandbox; de kontrollerte evalueringsskriptene gjør ingen modellkall.

Kjør inventarkontrollen før ny beregning. Den nye kontrollrapporten får et nytt tidspunkt og vil dermed avvike fra den opprinnelige filkontrollsummen. Dette er forventet; ta vare på den publiserte ZIP-filen som original.

En ny API-ekstraksjon er en annen form for reproduksjon. Den krever nøkkel og kan gi andre modellvurderinger. `study/run.js` gjenbruker eksisterende rader. En faktisk ny ekstraksjon må derfor gjøres i en separat kopi uten den gamle ekstraksjonsdatabasen, ikke ved å overskrive forsøket.

## Hva som må følge et GitHub-repo

Kode, manuskript og små resultatfiler alene er ikke nok. GitHub-utgaven inkluderer derfor de offentlige datasettene, SQLite-databasen, `e1-predictions.jsonl` og `e5-ablation-per-query.json` som vanlige Git-filer. `.gitignore` utelater lokale arbeidsfiler og hemmeligheter, men tillater disse navngitte forskningsfilene.

Den komplette `study/results/banking77-reproduction.zip` er derimot ikke ignorert og inneholder både SQLite-databasen, de offentlige datasettene og de detaljerte resultatfilene. Den kan følge repoet, eller publiseres som en separat nedlastbar forskningspakke med tydelig lenke fra README. Hvis pakken ligger separat, må den faktisk publiseres sammen med koden; en lokal lenke er ikke tilstrekkelig.

Pakken inneholder `evidence-manifest.json` med SHA-256 for datagrunnlag, kode og resultater. Inventaret ble laget etter studien og er merket med denne begrensningen. `.gitattributes` bevarer filbytes ved Git-utsjekking, slik at automatiske endringer av linjeskift ikke ødelegger kontrollsummene.

API-nøkkelen og `.env` skal ikke med. ZIP-pakkingen bruker eksplisitte datakataloger og utelater `.env`, arbeidskopier fra reproduksjon, SQLite-sidefiler og midlertidige låsefiler. BANKING77-lisensen og krediteringen følger med. Prosjektets egen kode har foreløpig ingen valgt åpen kildekodelisens; det er et eget valg før materialet eventuelt tilbys med gjenbruksrettigheter.

Materialet er publisert i [jevbeddings-repoet](https://github.com/oggabogg/jevbeddings). Publiseringen endrer ikke de opprinnelige loggenes eller tidsstemplenes status. [Publiseringsnotatet](../docs/PUBLICATION.md) beskriver innhold og kontroller før opplasting.

## En presis formulering til studien

> Jeg har bevart datagrunnlag, egenskapsvurderinger, metodekode og resultater per søk. Resultatene er beregnet på nytt fra de lagrede modellvurderingene uten nye API-kall. Kallmetadata og tidspunkt er lokale registreringer, ikke uavhengig signerte bekreftelser fra leverandøren.

Dette beskriver styrken i dokumentasjonen uten å tillegge den beviskraft den ikke har.
