// src/lib/ability.ts
// 🚀 On importe l'Ability standard ou l'arborescence brute pour l'Edge
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability'
import { UserRole, AppFeature } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// On adapte le type à createMongoAbility qui passe partout sans bugger au build
export type Actions = 'view' | 'manage'
export type Subjects = AppFeature | 'all'
export type AppAbility = MongoAbility<[Actions, Subjects]>

export async function getAbilityForUser(role: UserRole): Promise<AppAbility> {
  // createMongoAbility remplace PureAbility de manière stable sur Next.js Edge
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  if (role === 'ADMIN') {
    can('manage', 'all')
    return build()
  }

  const permissions = await prisma.rolePermission.findMany({
    where: { role }
  })

  permissions.forEach((perm) => {
    if (perm.canAccess === true) {
      can('view', perm.feature)
    }
  })

  return build()
}

function themePermissionActive(perm: { canAccess: boolean }) {
  return perm.canAccess === true
}