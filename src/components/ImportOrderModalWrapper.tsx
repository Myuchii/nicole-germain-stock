'use client'; // 👈 On dit à Next.js que ce fichier s'exécute côté client

import dynamicImport from 'next/dynamic';

// C'est ici qu'on applique le ssr: false en toute légalité
const ImportOrderModal = dynamicImport(
  () => import('@/components/ImportOrderModal'),
  { ssr: false }
);

export default function ImportOrderModalWrapper() {
  return <ImportOrderModal />;
}