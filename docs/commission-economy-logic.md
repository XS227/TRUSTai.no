# Komplett økonomilogikk for Animer

Dette er en operativ spesifikasjon for hvordan provisjon flyter mellom **tilgjengelig**, **reservert** og **utbetalt**, med full historikk.

## 1) Saldomodell

Per ambassadør (`wallets/{ambassadorId}`):
- `pendingNok`: opptjent men ikke frigitt (f.eks. angrefrist, fakturavalidering)
- `availableNok`: klar til utbetaling
- `paidLifetimeNok`: total historisk utbetalt

Formel for kontroll:
- `netEarned = sum(CREDIT) - sum(DEBIT)` fra ledger
- `pendingNok + availableNok + paidLifetimeNok` skal være konsistent med statusfordeling per case.

## 2) Statusflyt for provisjon

`commissionCases.status`:
1. `DRAFT` – grunnlag opprettet, ikke bokført
2. `EARNED` – bokført til `pendingNok`
3. `AVAILABLE` – frigitt til `availableNok`
4. `PAID` – knyttet til payout
5. `CANCELLED` – annullert før utbetaling

Tillatte overganger:
- `DRAFT -> EARNED`
- `EARNED -> AVAILABLE`
- `AVAILABLE -> PAID`
- `DRAFT|EARNED -> CANCELLED`

## 3) Ledger-regler (append-only)

Hver økonomisk hendelse skal skrive én rad til `wallets/{id}/ledger/{entryId}`.

Obligatorisk:
- `entryType`, `amountNok`, `direction`, `sourceType`, `sourceId`
- `deltaPendingNok`, `deltaAvailableNok`, `deltaPaidLifetimeNok`
- `balanceAfter` snapshot
- `createdAt`, `createdBy`

Ingen oppdatering/sletting av ledger entries.
Korrigering gjøres med ny `ADJUSTMENT`-entry.

## 4) Utbetaling (payout)

`payouts.status`:
- `REQUESTED -> APPROVED -> PROCESSING -> PAID`
- `PROCESSING -> FAILED` ved feil

Ved `PAID`:
- `availableNok` debiteres
- `paidLifetimeNok` krediteres
- tilhørende `commissionCases` settes `PAID` med `payoutId`

## 5) Historikkvisning i UI

### Tilgjengelig nå
- les `wallet.availableNok`

### Klar til senere
- les `wallet.pendingNok`

### Historikk
- vis sortert ledger (desc på `createdAt`)
- grupper per måned
- vis referanse til case/payout

### Reviderbarhet
- alle tall i dashboard skal kunne spores til ledger-entry og kildeobjekt (`commissionCase` eller `payout`).

## 6) Kontrolljobber

Kjør daglig Cloud Scheduler-jobb:
1. Rekalkuler wallet fra ledger.
2. Flag avvik > 0 NOK.
3. Opprett `auditLogs` event ved avvik.
