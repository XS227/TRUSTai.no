# MVP-lanseringsplan for Animer

## Fase 0 – Fundament (uke 1)
- Etabler Firestore-modell, security rules og indekser.
- Deploy Cloud Functions for provisjonsflyt.
- Opprett dev/staging/prod-prosjekter i Firebase.

**Exit-kriterie:** En testambassadør kan provisjoneres automatisk og få wallet opprettet.

## Fase 1 – Kjerneflyt (uke 2)
- Ambassadør onboarding + admin-godkjenning.
- Referral-lenke med tracking.
- Lead-registrering og pipeline (`NEW -> WON/LOST`).

**Exit-kriterie:** Ett lead går fra klikk til `WON` med synlig attribution.

## Fase 2 – Økonomi (uke 3)
- Oppretting av `commissionCases` ved `WON`.
- Flyt `DRAFT -> EARNED -> AVAILABLE` via funksjoner.
- Payout request/approval/paid og wallet-oppdatering.

**Exit-kriterie:** Full økonomiflyt i staging med historikk i ledger.

## Fase 3 – Kontrollert pilot (uke 4)
- 5–10 ambassadører i pilot.
- Ukentlig operativ gjennomgang: leads, conversion, payout-feil.
- Etabler support-SLA og FAQ.

**Exit-kriterie:** <5% feilrate i økonomihendelser, ingen kritiske sikkerhetshull.

## Fase 4 – Offisiell MVP-lansering (uke 5)
- Aktivér produksjonsdomene + auth-domener.
- Sett opp monitorering (Cloud Logging alerts + feilrate).
- Publiser enkel partnerguide og onboardingvideo.

**Exit-kriterie:** Plattformen håndterer første 100 ambassadører uten manuell datareparasjon.

---

## KPI-er for MVP
- Aktive ambassadører per uke.
- Leads per ambassadør.
- Win-rate per lead.
- Tid fra `WON` til `AVAILABLE` provisjon.
- Tid fra payout request til `PAID`.

## Risiko og tiltak
- **Feil attribution:** lås first-click regel server-side + audit-log.
- **Dobbeltutbetaling:** bruk idempotensnøkler i payout-funksjon.
- **Ustabil datakvalitet:** daglig rekonsiliering mot ledger.
