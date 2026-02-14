# Firestore-datamodell for Animer (ren arkitektur)

Dette dokumentet beskriver en produksjonsklar Firestore-struktur med tydelig separasjon mellom:
- **Domene (kjerneobjekter og regler)**
- **Applikasjon (use-cases / workflows)**
- **Infrastruktur (Firestore, Cloud Functions, indekser)**

Målet er en modell som er enkel å utvikle videre fra MVP til skalerbar drift.

---

## 1) Domenegrenser (bounded contexts)

### Identity & Access
- Brukere, roller, godkjenning, claims.

### Ambassador Program
- Ambassadører, profil, status, referral-koder.

### Lead & Attribution
- Klikk, leads, pipeline-steg, regler for attribution-vindu.

### Commission & Payout
- Provisjonsgrunnlag, tilgjengelig saldo, reservering, utbetaling, justeringer.

### Support & Audit
- Ticketing, kommentarflyt, hendelseslogg.

---

## 2) Firestore collections (kanonisk struktur)

## `users/{userId}`
```json
{
  "email": "string",
  "phone": "string|null",
  "fullName": "string",
  "locale": "nb-NO",
  "roles": ["AMBASSADOR"],
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

## `ambassadors/{ambassadorId}`
```json
{
  "userId": "string",
  "status": "APPLIED|APPROVED|PAUSED|TERMINATED",
  "type": "PRIVATE|BUSINESS",
  "defaultCommissionPct": 12.5,
  "referralCode": "string",
  "attributionWindowDays": 90,
  "approvedBy": "userId|null",
  "approvedAt": "Timestamp|null",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

## `ambassadors/{ambassadorId}/profile/main`
```json
{
  "address": "string",
  "postalCode": "string",
  "city": "string",
  "country": "NO",
  "organizationName": "string|null",
  "organizationNumber": "string|null",
  "billingEmail": "string|null"
}
```

## `referrals/{referralId}`
```json
{
  "ambassadorId": "string",
  "shareChannel": "SMS|EMAIL|LINK|SOCIAL",
  "landingPath": "/kampanje-x",
  "clickedAt": "Timestamp",
  "leadId": "string|null",
  "sourceFingerprint": "string"
}
```

## `leads/{leadId}`
```json
{
  "ambassadorId": "string",
  "referralId": "string|null",
  "customer": {
    "name": "string",
    "email": "string|null",
    "phone": "string|null",
    "company": "string|null"
  },
  "status": "NEW|CONTACTED|MEETING|OFFER_SENT|WON|LOST",
  "offerValueNok": 0,
  "wonAt": "Timestamp|null",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

## `commissionCases/{caseId}`
```json
{
  "leadId": "string",
  "ambassadorId": "string",
  "basisAmountNok": 50000,
  "commissionPct": 12.5,
  "grossCommissionNok": 6250,
  "status": "DRAFT|EARNED|AVAILABLE|PAID|CANCELLED",
  "earnedAt": "Timestamp|null",
  "availableAt": "Timestamp|null",
  "paidAt": "Timestamp|null",
  "payoutId": "string|null",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

## `wallets/{ambassadorId}`
```json
{
  "currency": "NOK",
  "availableNok": 0,
  "pendingNok": 0,
  "paidLifetimeNok": 0,
  "updatedAt": "Timestamp"
}
```

## `wallets/{ambassadorId}/ledger/{entryId}`
```json
{
  "entryType": "EARNED|RELEASED|PAYOUT|ADJUSTMENT",
  "amountNok": 1200,
  "direction": "CREDIT|DEBIT",
  "sourceType": "COMMISSION_CASE|PAYOUT|MANUAL",
  "sourceId": "string",
  "balanceAfter": {
    "availableNok": 3000,
    "pendingNok": 900
  },
  "note": "string",
  "createdBy": "system|userId",
  "createdAt": "Timestamp"
}
```

## `payouts/{payoutId}`
```json
{
  "ambassadorId": "string",
  "amountNok": 3000,
  "status": "REQUESTED|APPROVED|PROCESSING|PAID|FAILED",
  "requestedAt": "Timestamp",
  "approvedAt": "Timestamp|null",
  "paidAt": "Timestamp|null",
  "failureReason": "string|null",
  "bankReference": "string|null"
}
```

## `auditLogs/{eventId}`
```json
{
  "aggregateType": "AMBASSADOR|LEAD|COMMISSION|PAYOUT",
  "aggregateId": "string",
  "action": "string",
  "actorType": "SYSTEM|USER",
  "actorId": "string|null",
  "metadata": {},
  "createdAt": "Timestamp"
}
```

---

## 3) Regler for ren arkitektur (praktisk)

1. **All forretningslogikk i Cloud Functions / backend-lag**, aldri direkte i klient ved skriving av økonomidata.
2. **Ledger er append-only** (ingen oppdatering/sletting av historikk).
3. **Wallet totals er read-model** (kan rekalkuleres fra ledger ved behov).
4. **Idempotensnøkler** for funksjoner som kan trigges flere ganger.
5. **Statusmaskiner** må valideres server-side (f.eks. `EARNED -> AVAILABLE -> PAID`).

---

## 4) Nødvendige indekser (MVP)

- `commissionCases`: `ambassadorId + status + availableAt desc`
- `leads`: `ambassadorId + status + updatedAt desc`
- `payouts`: `ambassadorId + status + requestedAt desc`
- `referrals`: `ambassadorId + clickedAt desc`

---

## 5) Multi-tenant / miljø

Hvis flere merkevarer skal støttes senere:
- legg inn `tenantId` i alle toppnivådokumenter,
- bruk security rules på `tenantId`-match,
- og inkluder `tenantId` i alle komposittindekser.
