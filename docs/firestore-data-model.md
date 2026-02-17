# Firestore-datamodell (Super Admin MVP)

MVP-en bruker kun tre collections for å dekke 80% av kontrollbehovet med lav kompleksitet.

## Tillatte collections

1. `leads`
2. `ambassadors`
3. `payouts`

---

## `leads/{leadId}`

```json
{
  "id": "lead-123",
  "companyName": "Nordic Dental",
  "contactName": "Mina Solberg",
  "ambassadorId": "amb-nora",
  "status": "offer_sent",
  "offerValue": 160000,
  "commissionPercent": 12,
  "commissionAmount": 19200,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

Statusverdier i MVP:
- `open`
- `meeting_booked`
- `offer_sent`
- `approved`
- `rejected`

---

## `ambassadors/{ambassadorId}`

```json
{
  "id": "amb-nora",
  "name": "Nora Hansen",
  "email": "nora@animer.no",
  "status": "Active",
  "defaultCommission": 12,
  "totalRevenue": 160000,
  "totalCommission": 19200,
  "availableCommission": 19200,
  "createdAt": "Timestamp"
}
```

Statusverdier i MVP:
- `Pending` (søknad)
- `Active`
- `Paused`

---

## `payouts/{payoutId}`

```json
{
  "id": "payout-123",
  "ambassadorId": "amb-nora",
  "amount": 19200,
  "invoiceUrl": "https://...",
  "status": "approved",
  "createdAt": "Timestamp"
}
```

Statusverdier i MVP:
- `pending`
- `approved`
- `paid`

Regel:
- Når payout settes til `paid`, skal beløpet trekkes fra tilgjengelig provisjon.
