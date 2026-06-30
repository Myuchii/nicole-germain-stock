'use client'; // Si tu utilises une action serveur pour la sauvegarde

import React, { useState } from 'react';
import pdfToText from 'react-pdftotext';
import { parseNGPdfContent } from '@/lib/pdf-parser-ng';
import { useRouter } from 'next/navigation'; // 👈 On importe le routeur client

export default function ImportOrderModal({ onOrderImported }: { onOrderImported?: () => void }) {
  const router = useRouter(); // 👈 On initialise le routeur
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Extraction du texte brut du PDF dans le navigateur
      const text = await pdfToText(file);
      
      // 2. Parsing dynamique avec notre script révisé
      const parsedOrder = parseNGPdfContent(text);
      
      // 3. Stockage dans l'état pour afficher une preview à l'utilisateur
      setPreviewData(parsedOrder);
    } catch (err) {
      console.error(err);
      setError("Impossible de lire le fichier PDF. Assure-toi qu'il s'agit d'un format texte valide.");
    } finally {
      setLoading(false);
    }
  };

const handleConfirmImport = async () => {
    if (!previewData) return;
    setLoading(true);

    try {
      // Ton action serveur pour sauvegarder dans Neon ici...
      
      alert("Commande importée avec succès !");
      setPreviewData(null);
      
      // 🔥 On rafraîchit les données de la page automatiquement !
      router.refresh(); 
      
      if (onOrderImported) onOrderImported();
    } catch (err) {
      setError("Erreur lors de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-md border border-slate-200 max-w-2xl mx-auto my-4">
      <h2 className="text-xl font-bold text-slate-800 mb-4">📥 Import de Commande Nicole Germain</h2>
      
      {/* Zone de Drop / Sélection du fichier */}
      {!previewData && (
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-500 transition cursor-pointer relative">
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={handleFileChange} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={loading}
          />
          <p className="text-slate-600 font-medium">
            {loading ? "Analyse du PDF en cours... ⏳" : "Glisse le PDF de la commande ici ou clique pour parcourir"}
          </p>
          <span className="text-xs text-slate-400 block mt-1">Format PDF textuel provenant du site</span>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-2 font-medium">⚠️ {error}</p>}

      {/* Écran de vérification / Preview de la commande extraite */}
      {previewData && (
        <div className="mt-4 space-y-4 animate-fade-in">
<div className="p-4 bg-indigo-50/40 rounded-lg border border-indigo-100 text-sm space-y-1">
  <p className="font-semibold text-slate-700">📋 Référence : <span className="text-indigo-600 font-bold">{previewData.orderReference}</span></p>
  <p className="text-slate-700"><strong>Client :</strong> {previewData.client.prenom} {previewData.client.nom} ({previewData.client.email})</p>
  <p className="text-slate-700"><strong>Date :</strong> {previewData.dateCommande}</p>
  <p className="text-slate-700"><strong>Total Commande :</strong> <span className="font-semibold text-indigo-700">{previewData.totalTTC.toFixed(2)} €</span></p>
</div>

          <h3 className="font-semibold text-sm text-slate-700 uppercase tracking-wider">Articles détectés pour l'Atelier</h3>
          <div className="divide-y divide-slate-100 border-y border-slate-200">
            {previewData.items.map((item: any, idx: number) => (
              <div key={idx} className="py-3 flex justify-between items-center text-sm">
                <div>
                  <p className="font-bold text-slate-800">{item.designation}</p>
                  <p className="text-xs text-slate-500">Tissu : {item.tissu} | Taille : {item.taille} | Épaisseur : {item.epaisseur}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">Qté : {item.quantite}</p>
                  <p className="text-xs text-slate-400">{item.prixUnitaire.toFixed(2)} € / ut.</p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions de validation */}
          <div className="flex justify-end space-x-3 pt-2">
            <button 
              onClick={() => setPreviewData(null)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              disabled={loading}
            >
              Annuler
            </button>
            <button 
              onClick={handleConfirmImport}
              className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 transition shadow-sm"
              disabled={loading}
            >
              {loading ? "Création..." : "Valider et envoyer à l'Atelier 🚀"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}