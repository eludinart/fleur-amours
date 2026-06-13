/**
 * Contrôle d'accès Mycelium — rôles org (fleur_memberships) + admin app.
 */
import type { NextRequest } from 'next/server'
import { ApiError, requireAdmin, requireAuth, requireManagerOrRh } from './api-auth'
import {
  getManagedOrg,
  getMembershipForUser,
  getOrganisation,
  type OrgRole,
  type Organisation,
} from './db-organisations'

const RH_ORG_ROLES: OrgRole[] = ['owner', 'manager', 'rh']

export type MyceliumAccessInfo = {
  member: boolean
  canManage: boolean
  orgId: number | null
  orgName: string | null
  orgRole: OrgRole | null
}

export async function isAppAdmin(req: NextRequest): Promise<boolean> {
  try {
    await requireAdmin(req)
    return true
  } catch {
    return false
  }
}

export async function getMyceliumAccess(userId: number): Promise<MyceliumAccessInfo> {
  const base: MyceliumAccessInfo = {
    member: false,
    canManage: false,
    orgId: null,
    orgName: null,
    orgRole: null,
  }
  const membership = await getMembershipForUser(userId)
  if (!membership) return base
  const org = await getOrganisation(membership.orgId)
  const canManage = RH_ORG_ROLES.includes(membership.role)
  return {
    member: true,
    canManage,
    orgId: membership.orgId,
    orgName: org?.name ?? null,
    orgRole: membership.role,
  }
}

/** Tout membre d'une organisation (salarié, RH, etc.). */
export async function requireMyceliumMember(req: NextRequest): Promise<{
  userId: string
  uid: number
  membership: NonNullable<Awaited<ReturnType<typeof getMembershipForUser>>>
  org: Organisation
}> {
  const { userId } = await requireAuth(req)
  const uid = parseInt(userId, 10)

  const membership = await getMembershipForUser(uid)
  if (membership) {
    const org = await getOrganisation(membership.orgId)
    if (org) return { userId, uid, membership, org }
  }

  if (await isAppAdmin(req)) {
    throw new ApiError(403, 'Créez ou rejoignez une organisation pour accéder à votre espace pro')
  }

  throw new ApiError(403, 'Organisation requise')
}

export type MyceliumRhContext = {
  userId: string
  uid: number
  org: Organisation | null
  role: OrgRole | null
  isAppAdmin: boolean
}

/** RH / manager / owner org — ou admin app (même sans org, pour la configuration). */
export async function requireMyceliumRh(req: NextRequest): Promise<MyceliumRhContext> {
  const { userId } = await requireAuth(req)
  const uid = parseInt(userId, 10)
  const admin = await isAppAdmin(req)

  const managed = await getManagedOrg(uid)
  if (managed) {
    return { userId, uid, org: managed.org, role: managed.role, isAppAdmin: admin }
  }

  if (admin) {
    return { userId, uid, org: null, role: null, isAppAdmin: true }
  }

  throw new ApiError(403, 'Accès RH ou manager requis')
}

/** Création org : admin app ou rôle global manager/rh. */
export async function requireMyceliumOrgCreator(req: NextRequest): Promise<{ userId: string }> {
  try {
    return await requireAdmin(req)
  } catch {
    return requireManagerOrRh(req).then(({ userId }) => ({ userId }))
  }
}
