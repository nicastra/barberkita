import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from '../server/node_modules/drizzle-orm';

import { createDatabase } from '../server/src/db/client';
import {
  organizationMemberships,
  organizations,
  organizationSubscriptions,
  platformAdmins,
  shops,
  supportGrantEvents,
  supportGrants,
  users,
} from '../server/src/db/schema';
import { createSupportAccessService } from '../server/src/services/support-access-service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required.');

const connection = createDatabase(databaseUrl);
const database = connection.database;
const now = new Date('2026-01-01T00:00:00.000Z');
const support = createSupportAccessService(database, () => now);

let providerUserId = '';
let ownerUserId = '';
let organizationId = '';
let shopId = '';
let otherOrganizationId = '';

beforeAll(async () => {
  const [provider] = await database
    .insert(users)
    .values({
      name: 'Support Acceptance Provider',
      email: 'support-provider@acceptance.test',
      passwordHash: 'unused',
      active: true,
    })
    .returning({ id: users.id });
  const [owner] = await database
    .insert(users)
    .values({
      name: 'Support Acceptance Owner',
      email: 'support-owner@acceptance.test',
      passwordHash: 'unused',
      active: true,
    })
    .returning({ id: users.id });
  if (!provider || !owner) throw new Error('Support fixture users failed.');
  providerUserId = provider.id;
  ownerUserId = owner.id;
  await database.insert(platformAdmins).values({ userId: providerUserId });

  const [organization] = await database
    .insert(organizations)
    .values({
      name: 'Support Acceptance Organization',
      slug: 'support-acceptance-org',
    })
    .returning({ id: organizations.id });
  const [otherOrganization] = await database
    .insert(organizations)
    .values({ name: 'Support Other Organization', slug: 'support-other-org' })
    .returning({ id: organizations.id });
  if (!organization || !otherOrganization)
    throw new Error('Support fixture organizations failed.');
  organizationId = organization.id;
  otherOrganizationId = otherOrganization.id;

  const [shop] = await database
    .insert(shops)
    .values({
      organizationId,
      slug: 'support-acceptance-shop',
      name: 'Support Acceptance Shop',
      phone: '+62 21 555 0188',
      email: 'support-shop@acceptance.test',
      address: 'Support Street',
      timezone: 'Asia/Jakarta',
    })
    .returning({ id: shops.id });
  if (!shop) throw new Error('Support fixture shop failed.');
  shopId = shop.id;
  await database.insert(organizationMemberships).values({
    organizationId,
    userId: ownerUserId,
    role: 'organization_owner',
    active: true,
  });
  await database.insert(organizationSubscriptions).values({
    organizationId,
    status: 'active',
    trialEndsAt: new Date('2027-01-01T00:00:00.000Z'),
  });
});

afterAll(async () => {
  await database
    .delete(supportGrantEvents)
    .where(eq(supportGrantEvents.organizationId, organizationId));
  await database
    .delete(supportGrants)
    .where(eq(supportGrants.organizationId, organizationId));
  await database
    .delete(organizationMemberships)
    .where(eq(organizationMemberships.organizationId, organizationId));
  await database
    .delete(organizationSubscriptions)
    .where(eq(organizationSubscriptions.organizationId, organizationId));
  await database.delete(shops).where(eq(shops.organizationId, organizationId));
  await database
    .delete(organizations)
    .where(eq(organizations.id, organizationId));
  await database
    .delete(organizations)
    .where(eq(organizations.id, otherOrganizationId));
  await database
    .delete(platformAdmins)
    .where(eq(platformAdmins.userId, providerUserId));
  await database.delete(users).where(eq(users.id, providerUserId));
  await database.delete(users).where(eq(users.id, ownerUserId));
  await connection.client.end();
});

describe('support access PostgreSQL acceptance', () => {
  it('covers approval, scoping, concurrency, operations, revocation, expiry, and audit history', async () => {
    const pending = await support.request(providerUserId, {
      organizationId,
      reason: 'Investigate acceptance issue',
      expiresInMinutes: 30,
    });
    expect(pending.status).toBe('pending_approval');

    await expect(
      support.authorize(providerUserId, pending.id, organizationId),
    ).rejects.toMatchObject({
      code: 'SUPPORT_GRANT_INVALID',
    });

    const approved = await support.approve(ownerUserId, pending.id);
    expect(approved.status).toBe('active');

    await expect(
      support.authorize(providerUserId, pending.id, otherOrganizationId),
    ).rejects.toMatchObject({
      code: 'SUPPORT_GRANT_NOT_FOUND',
    });

    const entries = await Promise.all(
      Array.from({ length: 3 }, () =>
        support.authorize(providerUserId, pending.id, organizationId),
      ),
    );
    expect(entries).toHaveLength(3);
    await support.recordOperationalAction?.(
      providerUserId,
      pending.id,
      organizationId,
      `GET /api/shops/${shopId}/services`,
    );

    const providerMembership = await database
      .select({ userId: organizationMemberships.userId })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, providerUserId),
        ),
      );
    expect(providerMembership).toHaveLength(0);

    const revoked = await support.revoke(ownerUserId, pending.id);
    expect(revoked.status).toBe('revoked');
    await expect(
      support.authorize(providerUserId, pending.id, organizationId),
    ).rejects.toMatchObject({
      code: 'SUPPORT_GRANT_INVALID',
    });

    const breakGlass = await support.createBreakGlass(providerUserId, {
      organizationId,
      reason: 'Emergency production incident',
      expiresInMinutes: 15,
    });
    expect(breakGlass.breakGlass).toBe(true);
    now.setTime(breakGlass.expiresAt.getTime() + 1);
    await expect(
      support.authorize(providerUserId, breakGlass.id, organizationId),
    ).rejects.toMatchObject({
      code: 'SUPPORT_GRANT_EXPIRED',
    });

    const events = await database
      .select({ action: supportGrantEvents.action })
      .from(supportGrantEvents)
      .where(eq(supportGrantEvents.organizationId, organizationId));
    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        'requested',
        'approved',
        'entry',
        'operational_action',
        'revoked',
        'break_glass_created',
        'expired',
      ]),
    );
  });
});
