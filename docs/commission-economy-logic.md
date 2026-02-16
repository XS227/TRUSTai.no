# Økonomilogikk for MVP (forenklet)

MVP bruker en flat økonomimodell uten wallet/ledger-collections.

## 1) Kilde for provisjon

Provisjon beregnes og lagres på hvert lead:

- `approvedAmount`
- `commissionPercent`
- `commissionAmount`

Formel:

```txt
commissionAmount = round(approvedAmount * (commissionPercent / 100))
```

Denne beregningen gjøres når lead oppdateres, ikke i visningslaget.

## 2) Hva som teller som opptjent provisjon

Lead med `status = approved` regnes som opptjent provisjon.

Anbefalt aggregering per ambassadør:
- `totalLeads`
- `totalRevenue` (sum `approvedAmount`)
- `totalCommissionEarned` (sum `commissionAmount`)
- `availableForPayout` (opptjent minus utbetalt)

Disse feltene lagres direkte i `ambassadors/{id}` for rask dashboard-lesing.

## 3) Payout-status

`payouts.status`:
- `pending`
- `approved`
- `paid`
- `rejected`

Ved overgang til `paid`:
1. Sett `paidAt`.
2. Trekk `amount` fra `ambassadors.availableForPayout`.

## 4) Datamodell for payout

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

## 5) Kontrollregler

- `availableForPayout` må aldri bli negativ.
- `commissionAmount` skal alltid være et lagret felt på lead.
- Oppdatering av payout til `paid` og trekk i ambassador bør skje atomisk (transaksjon).
