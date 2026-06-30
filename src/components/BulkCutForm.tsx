'use client'; // 👈 Indispensable ici !

import { Layers } from 'lucide-react';
import { validateBulkCuttingStep } from '@/app/_actions/atelier-actions';

interface BulkCutFormProps {
  itemIds: string[];
  count: number;
}

export default function BulkCutForm({ itemIds, count }: BulkCutFormProps) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await validateBulkCuttingStep(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="pt-1">
      {itemIds.map((id) => (
        <input key={id} type="hidden" name="itemIds" value={id} />
      ))}
      <button 
        type="submit"
        className="w-full py-2 bg-indigo-600 hover:bg-slate-900 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1"
      >
        Couper le lot ({count} pièces)
      </button>
    </form>
  );
}