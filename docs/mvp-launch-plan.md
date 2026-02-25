# MVP-lanseringsplan for TrustAi (flat modell)

## Fase 0 – Datagrunnlag (uke 1)
- Etabler de 6 collectionene: `ambassadors`, `leads`, `payouts`, `tickets`, `content`, `settings`.
- Opprett `settings/global`.
- Opprett 3 nødvendige `leads`-indekser.

**Exit-kriterie:** Data kan lagres og leses med kun disse 6 collectionene.

## Fase 1 – Kjerneflyt (uke 2)
- Ambassadør-onboarding i `ambassadors`.
- Referral-lenke `trustai.no/a/{referralCode}`.
- Cookie-basert attribution til lead.
- Lead-pipeline: `open -> meeting_booked -> offer_sent -> approved/rejected`.

**Exit-kriterie:** Ett lead går fra referral-klikk til `approved` med riktig `ambassadorId`.

## Fase 2 – Økonomi (uke 3)
- Lagre `commissionAmount` ferdig beregnet på lead.
- Oppdater aggregater på ambassadør (`totalRevenue`, `totalCommissionEarned`, `availableForPayout`).
- Innfør payout-flyt med `pending|approved|paid|rejected`.

**Exit-kriterie:** Et approved lead gir synlig provisjon, og `paid` payout reduserer `availableForPayout`.

## Fase 3 – Pilot (uke 4)
- 5–10 ambassadører i test.
- Bruk `tickets` for supportspørsmål.
- Bruk `content` for å justere delingstekster uten deploy.

**Exit-kriterie:** Stabil daglig drift med lav manuell oppfølging.

## Fase 4 – Offisiell MVP-lansering (uke 5)
- Produksjonsdomene + auth-domener.
- Overvåkning og alerts.
- Enkel partnerguide.

**Exit-kriterie:** Plattformen håndterer første 100 ambassadører med flat datamodell.

---

## KPI-er
- Aktive ambassadører per uke.
- Leads per ambassadør.
- Andel leads i `approved`.
- Tid fra `offer_sent` til `approved`.
- Tid fra payout `pending` til `paid`.

## Risiko og tiltak
- **Feil attribution:** bruk cookie + `first_click` fra `settings`.
- **Feil provisjon:** lagre `commissionAmount` på lead ved oppdatering.
- **Dobbeltutbetaling:** bruk transaksjon når payout settes til `paid`.
