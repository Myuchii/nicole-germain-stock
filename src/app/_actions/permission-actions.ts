// src/app/_actions/permission-actions.ts
'use server'

import { prisma } from '@/lib/prisma'
import { UserRole, AppFeature } from '@prisma/client'
import { revalidatePath } from 'next/cache'

export async function updateRolePermission(role: UserRole, feature: AppFeature, canAccess: boolean) {
  try {
    await prisma.rolePermission.upsert({
      where: {
        role_feature: { role, feature }
      },
      update: { canAccess },
      create: { role, feature, canAccess }
    })

    revalidatePath('/settings') // On force le rafraîchissement
    return { success: true }
  } catch (error) {
    return { success: false, error: "Impossible de modifier la permission." }
  }
}