# Hele dataflyten i systemet (MVP)

Dette dokumentet beskriver dataflyt for en **flat Firestore-MVP** med seks collections.

## 1) Auth-laget

- Firebase Authentication håndterer identitet.
- `uid` brukes for tilgangskontroll og kobling mot ambassadørdata.

## 2) Ambassador-laget

- **Collection:** `ambassadors/{ambassadorId}`.
- Inneholder profil, status, referral-kode og summerte økonomifelt.

Eksempel:

```json
{
  "name": "Khabat",
  "email": "khabat@example.com",
  "status": "active",
  "referralCode": "ambhs3kthiq",
  "defaultCommission": 15,
  "availableForPayout": 12000
}
```

## 3) Referral og attribution

- Delbar lenke: `animer.no/a/{referralCode}`.
- Klient finner `referralCode`, slår opp ambassadør, og lagrer `ambassadorId` i cookie.
- Ved lead-innsending leses cookie, og `ambassadorId` settes på lead.
- Attributionmodell i MVP: `first_click` (konfigureres i `settings/global`).

## 4) Lead-systemet (kjerne)

- **Collection:** `leads/{leadId}`.
- Leadet inneholder både pipeline-status og økonomiske felter.
- `commissionAmount` lagres ferdig beregnet ved oppdatering.

Eksempel:

```json
{
  "companyName": "Test AS",
  "contactName": "Per Hansen",
  "ambassadorId": "amb123",
  "status": "offer_sent",
  "approvedAmount": 120000,
  "commissionPercent": 15,
  "commissionAmount": 18000
}
```

Statusflyt:

```txt
open -> meeting_booked -> offer_sent -> approved/rejected
```

## 5) Payout-flyt

- **Collection:** `payouts/{payoutId}`.
- Når payout markeres `paid`, trekkes beløpet fra `ambassadors.availableForPayout`.

Eksempel:

```json
{
  "ambassadorId": "amb123",
  "amount": 12000,
  "status": "paid",
  "paidAt": "Timestamp"
}
```

## 6) Support og innhold

- **Support:** `tickets/{ticketId}` (+ `messages` subcollection per ticket).
- **Delingstekster:** `content/{contentId}`.
- **Global konfig:** `settings/global`.

## End-to-end flyt

```txt
Ambassador active
  -> deler referral-lenke
  -> bruker klikker lenke
  -> ambassadorId lagres i cookie
  -> lead opprettes i leads
  -> admin oppdaterer status til approved
  -> payout opprettes og markeres paid
  -> availableForPayout oppdateres
```

## Designprinsipp

- Kun 6 collections i MVP.
- Hold alt flatt for enklere queries, færre indekser og raskere iterasjon.
