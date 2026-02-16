# Firestore-datamodell (MVP – flat struktur)

Denne modellen er optimalisert for MVP: **få collections, få indekser, enkel drift**.

## Tillatte collections (kun disse 6)

1. `ambassadors`
2. `leads`
3. `payouts`
4. `tickets`
5. `content`
6. `settings`

> Ikke lag `wallets`, `commissionCases`, `referrals`, `auditLogs` eller andre ekstra collections i MVP.

---

## 1) `ambassadors/{ambassadorId}`

Dokument-ID kan være auto-ID eller custom referral-ID.

```json
{
  "name": "Ola Nordmann",
  "email": "ola@email.no",
  "type": "private",
  "orgNumber": null,
  "status": "active",
  "referralCode": "ambhs3kthiq",
  "defaultCommission": 15,
  "totalLeads": 12,
  "totalRevenue": 240000,
  "totalCommissionEarned": 36000,
  "availableForPayout": 12000,
  "createdAt": "Timestamp",
  "invitedBy": null
}
```

Verdier:
- `type`: `private | business`
- `status`: `pending | active | paused | closed`

Referral-lenke bygges direkte fra `referralCode`:

```txt
animer.no/a/{referralCode}
```

---

## 2) `leads/{leadId}` (kjerne-collection)

```json
{
  "companyName": "Veidekke",
  "contactName": "Per Hansen",
  "email": "per@veidekke.no",
  "phone": "12345678",
  "ambassadorId": "docId_of_ambassador",
  "referralCode": "ambhs3kthiq",
  "source": "email",
  "landingPage": "training",
  "status": "offer_sent",
  "offerAmount": 120000,
  "approvedAmount": 120000,
  "commissionPercent": 15,
  "commissionAmount": 18000,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

Verdier:
- `source`: `email | sms | direct | linkedin`
- `status`: `open | meeting_booked | offer_sent | approved | rejected`

Viktig:
- `commissionAmount` skal lagres ferdig beregnet ved skriv/oppdatering.
- Frontend skal ikke regne provisjon hver gang data vises.

---

## 3) `payouts/{payoutId}`

```json
{
  "ambassadorId": "docId",
  "amount": 12000,
  "invoiceUrl": "storage-link",
  "status": "pending",
  "paidAt": null,
  "createdAt": "Timestamp"
}
```

Verdier:
- `status`: `pending | approved | paid | rejected`

Regel:
- Når payout settes til `paid`, trekk beløpet fra `ambassadors.availableForPayout`.

---

## 4) `tickets/{ticketId}`

```json
{
  "ambassadorId": "docId",
  "subject": "Utbetaling",
  "message": "Når blir den utbetalt?",
  "status": "open",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

Verdier:
- `status`: `open | closed`

Svar kan lagres som subcollection (tillatt):

```txt
tickets/{ticketId}/messages/{messageId}
```

---

## 5) `content/{contentId}`

```json
{
  "type": "lead_share",
  "title": "Bruk animasjon til opplæring",
  "text": "Hei {{name}}...",
  "clicks": 34,
  "conversions": 11,
  "active": true,
  "createdAt": "Timestamp"
}
```

Verdier:
- `type`: `lead_share | invite`

Formål:
- Endre delingstekster uten ny deploy.

---

## 6) `settings/global`

Kun ett dokument i `settings`:

```json
{
  "defaultCommissionPercent": 15,
  "cookieDurationDays": 90,
  "attributionModel": "first_click"
}
```

---

## Viktigste queries

Ambassadør-dashboard:

```js
leads
  .where("ambassadorId", "==", userId)
  .orderBy("createdAt", "desc")
```

Approved leads:

```js
leads
  .where("ambassadorId", "==", userId)
  .where("status", "==", "approved")
  .orderBy("createdAt", "desc")
```

Super admin pipeline:

```js
leads
  .where("status", "==", "offer_sent")
  .orderBy("createdAt", "desc")
```

---

## Indekser (MVP)

Lag kun disse komposittindeksene i `leads`:

1. `ambassadorId + createdAt desc`
2. `ambassadorId + status + createdAt desc`
3. `status + createdAt desc`

---

## Arkitekturvalg

- Hold data **flat**.
- Ikke lag leads som subcollection under `ambassadors`.
- Ikke bygg nested økonomistruktur i MVP.

Flat struktur gir:
- færre indekser,
- raskere queries,
- enklere utvikling og vedlikehold.

---

## Referral-tracking (MVP)

Ved klikk på:

```txt
animer.no/a/{referralCode}
```

Flyt:
1. Finn ambassadør via `referralCode`.
2. Sett cookie med `ambassadorId`.
3. Når lead opprettes: les cookie og skriv `ambassadorId` på lead.

MVP-krav:
- Ikke nødvendig å lagre klikk-events i Firestore.
- Leads er primærmåling for attribution.
