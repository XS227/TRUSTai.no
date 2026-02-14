const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const COMMISSION_STATUS = {
  DRAFT: 'DRAFT',
  EARNED: 'EARNED',
  AVAILABLE: 'AVAILABLE',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
};

const PAYOUT_STATUS = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED',
};

async function appendLedgerEntry(tx, ambassadorId, payload) {
  const walletRef = db.collection('wallets').doc(ambassadorId);
  const ledgerRef = walletRef.collection('ledger').doc();

  const walletSnap = await tx.get(walletRef);
  const wallet = walletSnap.exists
    ? walletSnap.data()
    : {
        currency: 'NOK',
        availableNok: 0,
        pendingNok: 0,
        paidLifetimeNok: 0,
      };

  const deltaPending = payload.deltaPendingNok || 0;
  const deltaAvailable = payload.deltaAvailableNok || 0;
  const deltaPaidLifetime = payload.deltaPaidLifetimeNok || 0;

  const next = {
    availableNok: (wallet.availableNok || 0) + deltaAvailable,
    pendingNok: (wallet.pendingNok || 0) + deltaPending,
    paidLifetimeNok: (wallet.paidLifetimeNok || 0) + deltaPaidLifetime,
  };

  if (next.availableNok < 0 || next.pendingNok < 0) {
    throw new HttpsError('failed-precondition', 'Wallet balance kan ikke bli negativ.');
  }

  tx.set(walletRef, {
    currency: 'NOK',
    ...next,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  tx.create(ledgerRef, {
    entryType: payload.entryType,
    amountNok: payload.amountNok,
    direction: payload.direction,
    sourceType: payload.sourceType,
    sourceId: payload.sourceId,
    deltaPendingNok: deltaPending,
    deltaAvailableNok: deltaAvailable,
    deltaPaidLifetimeNok: deltaPaidLifetime,
    balanceAfter: {
      availableNok: next.availableNok,
      pendingNok: next.pendingNok,
      paidLifetimeNok: next.paidLifetimeNok,
    },
    note: payload.note || null,
    createdBy: payload.createdBy || 'system',
    createdAt: FieldValue.serverTimestamp(),
  });
}

exports.provisionAmbassadorOnApproval = onDocumentCreated('ambassadors/{ambassadorId}', async (event) => {
  const ambassadorId = event.params.ambassadorId;
  const ambassador = event.data?.data();

  if (!ambassador || ambassador.status !== 'APPROVED') {
    return;
  }

  await db.runTransaction(async (tx) => {
    const walletRef = db.collection('wallets').doc(ambassadorId);
    const profileRef = db.collection('ambassadors').doc(ambassadorId).collection('profile').doc('main');

    const walletSnap = await tx.get(walletRef);
    if (!walletSnap.exists) {
      tx.set(walletRef, {
        currency: 'NOK',
        availableNok: 0,
        pendingNok: 0,
        paidLifetimeNok: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const profileSnap = await tx.get(profileRef);
    if (!profileSnap.exists) {
      tx.set(profileRef, {
        address: null,
        postalCode: null,
        city: null,
        country: 'NO',
        organizationName: null,
        organizationNumber: null,
        billingEmail: null,
      });
    }

    tx.set(db.collection('auditLogs').doc(), {
      aggregateType: 'AMBASSADOR',
      aggregateId: ambassadorId,
      action: 'AMBASSADOR_PROVISIONED',
      actorType: 'SYSTEM',
      actorId: null,
      metadata: {
        reason: 'auto_provision_on_approval',
      },
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  logger.info('Ambassador auto-provisioned', { ambassadorId });
});

exports.markCommissionAsEarned = onCall(async (request) => {
  const { commissionCaseId } = request.data || {};
  if (!commissionCaseId) {
    throw new HttpsError('invalid-argument', 'commissionCaseId er påkrevd.');
  }

  await db.runTransaction(async (tx) => {
    const caseRef = db.collection('commissionCases').doc(commissionCaseId);
    const caseSnap = await tx.get(caseRef);

    if (!caseSnap.exists) {
      throw new HttpsError('not-found', 'Fant ikke commission case.');
    }

    const c = caseSnap.data();
    if (c.status !== COMMISSION_STATUS.DRAFT) {
      throw new HttpsError('failed-precondition', 'Kun DRAFT kan flyttes til EARNED.');
    }

    const amount = Number(c.grossCommissionNok || 0);
    if (amount <= 0) {
      throw new HttpsError('failed-precondition', 'grossCommissionNok må være større enn 0.');
    }

    tx.update(caseRef, {
      status: COMMISSION_STATUS.EARNED,
      earnedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await appendLedgerEntry(tx, c.ambassadorId, {
      entryType: 'EARNED',
      amountNok: amount,
      direction: 'CREDIT',
      sourceType: 'COMMISSION_CASE',
      sourceId: commissionCaseId,
      deltaPendingNok: amount,
      note: 'Provisjon opptjent (reservert).',
      createdBy: request.auth?.uid || 'system',
    });
  });

  return { ok: true, commissionCaseId };
});

exports.releaseCommissionToAvailable = onCall(async (request) => {
  const { commissionCaseId } = request.data || {};
  if (!commissionCaseId) {
    throw new HttpsError('invalid-argument', 'commissionCaseId er påkrevd.');
  }

  await db.runTransaction(async (tx) => {
    const caseRef = db.collection('commissionCases').doc(commissionCaseId);
    const caseSnap = await tx.get(caseRef);

    if (!caseSnap.exists) {
      throw new HttpsError('not-found', 'Fant ikke commission case.');
    }

    const c = caseSnap.data();
    if (c.status !== COMMISSION_STATUS.EARNED) {
      throw new HttpsError('failed-precondition', 'Kun EARNED kan flyttes til AVAILABLE.');
    }

    const amount = Number(c.grossCommissionNok || 0);

    tx.update(caseRef, {
      status: COMMISSION_STATUS.AVAILABLE,
      availableAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await appendLedgerEntry(tx, c.ambassadorId, {
      entryType: 'RELEASED',
      amountNok: amount,
      direction: 'CREDIT',
      sourceType: 'COMMISSION_CASE',
      sourceId: commissionCaseId,
      deltaPendingNok: -amount,
      deltaAvailableNok: amount,
      note: 'Provisjon frigitt til tilgjengelig saldo.',
      createdBy: request.auth?.uid || 'system',
    });
  });

  return { ok: true, commissionCaseId };
});

exports.executePayout = onCall(async (request) => {
  const { payoutId } = request.data || {};
  if (!payoutId) {
    throw new HttpsError('invalid-argument', 'payoutId er påkrevd.');
  }

  await db.runTransaction(async (tx) => {
    const payoutRef = db.collection('payouts').doc(payoutId);
    const payoutSnap = await tx.get(payoutRef);

    if (!payoutSnap.exists) {
      throw new HttpsError('not-found', 'Fant ikke payout.');
    }

    const payout = payoutSnap.data();
    if (payout.status !== PAYOUT_STATUS.APPROVED) {
      throw new HttpsError('failed-precondition', 'Kun APPROVED payouts kan utføres.');
    }

    const amount = Number(payout.amountNok || 0);
    if (amount <= 0) {
      throw new HttpsError('failed-precondition', 'Payout amount må være > 0.');
    }

    await appendLedgerEntry(tx, payout.ambassadorId, {
      entryType: 'PAYOUT',
      amountNok: amount,
      direction: 'DEBIT',
      sourceType: 'PAYOUT',
      sourceId: payoutId,
      deltaAvailableNok: -amount,
      deltaPaidLifetimeNok: amount,
      note: 'Utbetaling gjennomført.',
      createdBy: request.auth?.uid || 'system',
    });

    tx.update(payoutRef, {
      status: PAYOUT_STATUS.PAID,
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, payoutId };
});
