# TrustAI multi-tenant: neste konkrete steg

Dette dokumentet tar neste steg i spesifikasjonen ved å levere:

1. **Konkrete Firebase Security Rules** (Firestore)
2. **Konkrete Cloud Function skjelett/pseudokode** for API-endepunkter
3. **Detaljert SDK-struktur** for `sdk.js`

## 1) Firebase Security Rules (multi-tenant)

Mål: alle lesinger/skrivinger må være isolert per `clientId`, med roller fra custom claims.

> Forutsetning: custom claims inneholder minst:
>
> - `role`: `super_admin` | `client_admin` | `ambassador`
> - `clientId`: klienten brukeren tilhører
>
> og ambassador-brukere har i tillegg `ambassadorId` claim.

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function role() {
      return signedIn() && request.auth.token.role is string
        ? request.auth.token.role
        : "";
    }

    function tokenClientId() {
      return signedIn() && request.auth.token.clientId is string
        ? request.auth.token.clientId
        : "";
    }

    function isSuperAdmin() {
      return role() == "super_admin";
    }

    function isClientAdmin(clientId) {
      return role() == "client_admin" && tokenClientId() == clientId;
    }

    function isAmbassador(clientId) {
      return role() == "ambassador" && tokenClientId() == clientId;
    }

    function inTenant(clientId) {
      return isSuperAdmin() || isClientAdmin(clientId) || isAmbassador(clientId);
    }

    function ambassadorOwnsDoc(resourceData) {
      return request.auth.token.ambassadorId is string
        && resourceData.ambassadorId == request.auth.token.ambassadorId;
    }

    match /clients/{clientId} {
      allow read: if inTenant(clientId);
      allow create, update, delete: if isSuperAdmin() || isClientAdmin(clientId);

      match /settings/{docId} {
        allow read: if inTenant(clientId);
        allow write: if isSuperAdmin() || isClientAdmin(clientId);
      }

      match /ambassadors/{ambassadorId} {
        allow read: if inTenant(clientId);

        allow create: if isSuperAdmin() || isClientAdmin(clientId);

        // commissionPercent kun av client_admin/super_admin
        allow update: if (
          isSuperAdmin() ||
          isClientAdmin(clientId)
        ) || (
          isAmbassador(clientId)
          && request.auth.token.ambassadorId == ambassadorId
          && request.resource.data.commissionPercent == resource.data.commissionPercent
        );

        allow delete: if isSuperAdmin() || isClientAdmin(clientId);
      }

      match /leads/{leadId} {
        allow read: if (
          isSuperAdmin() ||
          isClientAdmin(clientId) ||
          (isAmbassador(clientId) && ambassadorOwnsDoc(resource.data))
        );

        // klient-app skal normalt skrive via backend (Cloud Functions)
        allow create, update, delete: if false;
      }

      match /payouts/{payoutId} {
        allow read: if (
          isSuperAdmin() ||
          isClientAdmin(clientId) ||
          (isAmbassador(clientId) && ambassadorOwnsDoc(resource.data))
        );

        allow create, update: if isSuperAdmin() || isClientAdmin(clientId);
        allow delete: if isSuperAdmin();
      }
    }

    // Global abuse/rate-limit logs kun backend
    match /securityLogs/{logId} {
      allow read: if isSuperAdmin();
      allow write: if false;
    }
  }
}
```

## 2) Cloud Functions API skjelett (server-side attribution)

Anbefalt struktur under `functions/src`:

- `api/index.ts` (router)
- `api/middleware.ts` (origin, rate-limit, tenant guard)
- `api/attribution.ts` (HMAC cookie-verifisering)
- `api/endpoints/*.ts`

### Felles krav i middleware

- Krev `clientId` i body/query (eller hent fra subdomain ved dashboard-kall)
- Verifiser `Origin` mot whitelist i `clients/{clientId}/settings.origins`
- Rate-limit per IP + client (`securityLogs/rateLimits`)
- Audit logg ved avvik/misbruk

### Pseudokode: `POST /api/validate-ref`

```ts
// input: { clientId, ref }
// output: { valid, ambassadorId?, signature?, expiresAt? }

assertClientId();
assertOriginAllowed();
assertRateLimit("validate-ref");

const ambassador = await findAmbassadorByReferralCode(clientId, ref);
if (!ambassador || ambassador.status !== "active") {
  return { valid: false };
}

const ttlDays = 90;
const payload = {
  clientId,
  ambassadorId: ambassador.id,
  firstClickAt: nowIso(),
  expiresAt: nowPlusDays(ttlDays),
};

const signature = hmacSign(payload, process.env.ATTRIBUTION_SECRET);

return {
  valid: true,
  ambassadorId: ambassador.id,
  signature,
  expiresAt: payload.expiresAt,
};
```

### Pseudokode: `POST /api/track-click`

```ts
// input: { clientId, ambassadorId, source, landingPage, signature }

assertClientId();
assertOriginAllowed();
assertRateLimit("track-click");
assertAmbassadorBelongsToClient(clientId, ambassadorId);
assertSignatureValid({ clientId, ambassadorId, signature });

await db.collection(`clients/${clientId}/events`).add({
  type: "click",
  ambassadorId,
  source,
  landingPage,
  ipHash: sha256(requestIp),
  userAgent: req.headers["user-agent"] || "",
  createdAt: serverTimestamp(),
});

return { ok: true };
```

### Pseudokode: `POST /api/lead`

```ts
// input: { clientId, name, email, phone, message, source }

assertClientId();
assertOriginAllowed();
assertRateLimit("lead");

const cookieRef = readCookie("trustai_ref");
const cookieClient = readCookie("trustai_client");
const cookieSig = readCookie("trustai_sig");

let ambassadorId: string | null = null;

if (cookieRef && cookieClient === clientId && cookieSig) {
  const verified = verifyAttributionCookie({
    clientId,
    ambassadorId: cookieRef,
    signature: cookieSig,
    maxAgeDays: 90,
  });

  if (verified) {
    const ambassadorOk = await ambassadorBelongsToClient(clientId, cookieRef);
    ambassadorId = ambassadorOk ? cookieRef : null;
  }
}

const existingLead = await findExistingLeadByEmailOrPhone(clientId, email, phone);
if (existingLead) {
  // first-click: ikke overskriv eksisterende ambassador
  return { ok: true, leadId: existingLead.id, deduplicated: true };
}

const commissionPercent = ambassadorId
  ? await resolveCommissionPercent(clientId, ambassadorId)
  : 0;

const dealValue = 0; // oppdateres senere i pipeline
const commissionAmount = dealValue * commissionPercent;

const leadRef = await db.collection(`clients/${clientId}/leads`).add({
  clientId,
  ambassadorId,
  source,
  landingPage: req.headers.referer || "",
  status: "new",
  dealValue,
  commissionPercent,
  commissionAmount,
  name,
  email,
  phone,
  message,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

await logEvent(clientId, "lead_created", { leadId: leadRef.id, ambassadorId });
return { ok: true, leadId: leadRef.id };
```

### Pseudokode: `POST /api/payout`

```ts
// krever auth: client_admin/super_admin
assertAuthRole(["client_admin", "super_admin"]);
assertClientAccess(clientIdFromTokenOrBody());
assertRateLimit("payout");

// input: { clientId, ambassadorId, amount, note }
assertAmbassadorBelongsToClient(clientId, ambassadorId);

await db.collection(`clients/${clientId}/payouts`).add({
  clientId,
  ambassadorId,
  amount,
  currency: "NOK",
  status: "requested",
  note,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

return { ok: true };
```

### Pseudokode: `GET /api/dashboard-data`

```ts
// auth required, client scoping fra token/subdomain
assertAuth();
const clientId = resolveClientFromSubdomainOrToken(req);
assertClientAccess(clientId);

const [leadAgg, payoutAgg, ambassadorAgg] = await Promise.all([
  aggregateLeads(clientId),
  aggregatePayouts(clientId),
  aggregateAmbassadors(clientId),
]);

return { clientId, leadAgg, payoutAgg, ambassadorAgg };
```

## 3) SDK-struktur (`sdk.js`) – én fil hos kunden

Kunden inkluderer kun:

```html
<script src="https://trustai.no/sdk.js"></script>
<script>
  TrustAISDK.init({
    clientId: "animer",
    apiBase: "https://trustai.no/api",
    redirectTo: "https://animer.no",
  });
</script>
```

### Foreslått intern struktur

```txt
sdk/
  index.ts                 // eksponerer TrustAISDK.init
  core/config.ts           // valider config
  core/url.ts              // les ref-param
  core/cookies.ts          // sett/les trustai_ref/client/sig
  core/http.ts             // fetch-wrapper
  flows/referral.ts        // validate-ref, track-click, redirect
  types.ts
```

### Runtime-flyt i SDK

1. Les `ref` fra URL (`?ref=AMB123`)
2. Hvis mangler: returner uten sideeffekt
3. Kall `POST /api/validate-ref` med `{ clientId, ref }`
4. Hvis gyldig:
   - sett cookies i 90 dager:
     - `trustai_ref=<ambassadorId>`
     - `trustai_client=<clientId>`
     - `trustai_sig=<hmac-signature>`
   - kall `POST /api/track-click`
5. Redirect til `redirectTo`

### Viktige SDK-regler

- Ingen sensitiv logikk i SDK
- Ingen provisjonsberegning i SDK
- Ingen tillit til frontend alene (kun transport + event capture)

## 4) Forslag til implementeringsrekkefølge

1. Etabler claims + subdomain->client mapping
2. Implementer middleware (origin/rate-limit/tenant guard)
3. Implementer `/api/validate-ref` og `/api/lead`
4. Legg på `/api/track-click`, `/api/payout`, `/api/dashboard-data`
5. Koble SDK til API
6. Stram Firestore rules og verifiser med emulator tester

Dette gir raskeste vei til en sikker MVP der attribution er fullt server-validert.
