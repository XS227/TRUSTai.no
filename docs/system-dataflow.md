# Hele dataflyten i systemet (MVP)

Dette dokumentet beskriver hele maskinen fra identitet til utbetaling i 6 lag, slik løsningen fungerer i dag.

## 1) Auth-laget (identitet)

- **System:** Firebase Authentication.
- Når en bruker registrerer seg/logger inn opprettes en Auth-bruker med unik `uid`.
- `uid` er primærnøkkelen som kobler identitet til alle domeneobjekter.

Eksempel:

```json
{
  "uid": "OyU4L3..."
}
```

## 2) Ambassador-dokument (profil + rolle)

- **Firestore path:** `ambassadors/{uid}`.
- Auth sier **hvem** brukeren er.
- Firestore-dokumentet sier **hva** brukeren kan gjøre (rolle/status) og hvilke økonomiske regler som gjelder.

Eksempel:

```json
{
  "name": "Khabat",
  "email": "...",
  "commissionRate": 0.1,
  "status": "pending"
}
```

## 3) Referral-flyt (attribution)

- Ambassadør deler referral-lenke, typisk med kode som `AMB123`.
- Klientkode i `referral.js` leser referral fra URL.
- Referral lagres i `localStorage` som `ambassadorRef`.
- Når et lead opprettes, settes `ambassadorId` på leadet.
- **First-click attribution** brukes for å låse attribution tidlig i flyten.

Nøkkeldata:

```txt
ambassadorRef = "AMB123"
```

## 4) Lead-systemet

- **Collection:** `leads/{leadId}`.
- Hvert lead kobles til én ambassadør via `ambassadorId`.

Eksempel:

```json
{
  "company": "Test AS",
  "normalizedCompany": "testas",
  "ambassadorId": "OyU4L3...",
  "status": "new",
  "value": 0
}
```

MVP-statusflyt (konseptuelt):

```txt
new -> contacted -> approved -> rejected
```

Når et lead blir **approved**, går det videre til provisjonsmotoren.

## 5) Commission-motor

- **Collection:** `commissions/{commissionId}`.
- Hver provisjon peker til både `ambassadorId` og `leadId`.

Eksempel:

```json
{
  "ambassadorId": "...",
  "leadId": "...",
  "amount": 5000,
  "status": "available"
}
```

Statusmapping mellom lead og payout-status i MVP:

| Lead status        | Commission status |
|--------------------|-------------------|
| `approved`         | `available`       |
| `payout_requested` | `pending`         |
| `paid`             | `locked`          |

## 6) Payout-motor

- Admin markerer provisjoner som `paid`.
- `payoutDate` settes for sporbarhet.
- Dashboard summerer nøkkeltall:
  - Earned
  - Available
  - Pending
  - Paid
  - Unpaid total

## End-to-end flyt

```txt
User registers
  -> Auth user created
  -> ambassadors/{uid} (status=pending)
  -> Admin sets active
  -> Ambassador shares link
  -> Visitor clicks referral
  -> Lead created
  -> Admin approves lead
  -> Commission created
  -> Admin marks paid
  -> Dashboard updates
```

## Roller og ansvar

| Rolle       | Ansvar |
|-------------|--------|
| Ambassadør  | Se egne leads og provisjoner |
| Admin       | Endre lead-status og utbetaling |
| System      | Kalkulere provisjon og aggregere dashboard-tall |
