# TrustAi MVP Structure Map

Denne mappen beskriver hvordan MVP-en er strukturert, hvilke lag som eier hva, og hvordan data flyter mellom klient, Firestore, Cloud Functions og admin-operasjoner.

## 1) Frontend (walkthrough)

- `walkthrough/index.html`: landing, onboarding og registreringsskjema.
- `walkthrough/ambassador.html`: ambassadørdashboard, lead capture og deling.
- `walkthrough/admin.html`: admin-dashboard for leads, provisjonssats, payout og status.
- `walkthrough/app.js`: klientlogikk (auth, formularer, routing, rendering, redirects).
- `walkthrough/data-store.js`: Firestore-tilgang og lokal MVP-beregning.
- `walkthrough/referral.js` + `walkthrough/referral.html`: first-click referral-attribution.

## 2) Backend (Cloud Functions)

- `functions/src/index.js`:
  - `grantAdminToFirstUser`: setter admin-claim for første bruker.
  - `provisionAmbassadorOnApproval`: oppretter wallet/profile ved godkjenning.
  - `bindLeadCommissionAndNotifyAdmin`: auto-binder lead→commissionCase + e-postvarsel-kø.
  - `markCommissionAsEarned`, `releaseCommissionToAvailable`, `executePayout`: økonomi-kommandoer.

- `functions/index.js`: re-export av `functions/src/index.js`.

## 3) Firestore Collections (kjerne)

- `ambassadors/{uid}`: status, referralCode, commissionRate.
- `leads/{leadId}`: leadinfo, ambassador-binding, kommisjonsfelt, commissionCaseId.
- `commissionCases/{id}`: økonomisk lifecycle per lead.
- `wallets/{ambassadorId}` + `wallets/{ambassadorId}/ledger/{entryId}`: saldo og bokføring.
- `payouts/{id}`: utbetalingsordre.
- `auditLogs/{id}`: system- og adminhendelser.
- `mail/{id}`: e-postkø for Firebase Trigger Email extension.

## 4) Sikkerhetslag (production rules)

- `firestore.rules`:
  - least privilege (default deny)
  - admin-only for sensitive writes
  - ambassadør kan lese egne data
  - ingen klientskriving til `mail`/`auditLogs`/wallet-ledger

- `storage.rules`:
  - isolerte mapper for faktura/support
  - ambassadør får kun tilgang til egne filer
  - admin har overstyring

## 5) Operasjonell flyt (MVP)

1. Bruker logger inn / registrerer seg.
2. Referral blir fanget og lagret (`ambassadorRef`).
3. Lead opprettes via skjema med auto-binding til ambassadør + commissionRate.
4. Cloud Function oppretter `commissionCase` og legger e-postvarsel i `mail`.
5. Admin følger opp lead i dashboard, oppdaterer status/verdier.
6. Kommisjon flyttes gjennom lifecycle (`DRAFT → EARNED → AVAILABLE → PAID`).
7. Wallet + ledger oppdateres transaksjonelt.

## 6) Dashboard-koblinger

- Ambassadør ser egne leads/KPI og kan sende nye leads.
- Admin ser alle leads, filtrerer på status/ambassadør, setter satser og styrer payout.
- Ved vellykket skjema-innsending i klienten brukes auto-redirect tilbake til dashboard.

## 7) MVP -> Production gap

- Flytt all provisjonslogikk til backend som eneste sannhetskilde.
- Legg til idempotency checks for triggers/callables.
- Bytt demo-auth med produksjonsrutiner for roller/claims.
- Overvåk `mail`-kø og legg på retry/alerting.
- Utvid audit trail med før/etter-diff per adminoperasjon.
