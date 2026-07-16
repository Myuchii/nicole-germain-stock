'use client';

import React, { useState } from 'react';
import pdfToText from 'react-pdftotext';
import { saveImportedNGOrder } from '@/app/_actions/ng-order-actions';
import { Plus, Trash2, FileText, UploadCloud } from 'lucide-react';

export default function ImportOrderModal({ onOrderImported }: { onOrderImported?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'PDF' | 'TEXT' | null>(null);
  const [rawText, setRawText] = useState('');
  const [formData, setFormData] = useState<any | null>(null);

  const parseTextContent = (text: string) => {
    const orderNum = text.match(/(?:Numéro de commande:\s*|\bN°\s*)\s*"?(\d+)"?/)?.[1] || "";
    const totalTTC = text.match(/TOTAL TTC\s*"?\s*([\d,.]+)\s*€/)?.[1] || "0";

    const email = text.match(/E-mail:\s*"?\s*([^\n"()]+)"?/)?.[1]?.trim() || "";
    const nom = text.match(/Nom:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
    const prenom = text.match(/Prénom:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
    const adresse = text.match(/Adresse:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
    const codePostal = text.match(/Code Postal:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
    const city = text.match(/Ville:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";

    const items: any[] = [];
    
    const texteNettoye = text
      .replace(/Couleur\s*\n\s*principale/gi, "Couleur principale")
      .replace(/Couleur\s*\n\s*secondaire/gi, "Couleur secondaire");

    const blocs = texteNettoye.split(/(?=Taille\s*:)/i);
    const lignesPremierBloc = blocs[0].split('\n').map(l => l.trim()).filter(Boolean);
    let premiereDesignation = "HOUSSE DE COUETTE";
    
    for (let i = lignesPremierBloc.length - 1; i >= 0; i--) {
      const l = lignesPremierBloc[i];
      if (l === l.toUpperCase() && !l.includes("€") && isNaN(Number(l)) && l.length > 5 && !["DÉSIGNATION", "PRIX UNITAIRE"].some(w => l.includes(w))) {
        premiereDesignation = l;
        break;
      }
    }

    blocs.forEach((bloc, idx) => {
      if (idx === 0) return;

      const tailleMatch = bloc.match(/Taille\s*:\s*([^\n€|]+)/i);
      const tissuMatch = bloc.match(/Tissu\s*:\s*([^\n€|]+)/i);
      const couleurPrincMatch = bloc.match(/Couleur principale\s*:\s*([^\n€|]+)/i);
      const couleurSecMatch = bloc.match(/Couleur secondaire\s*:\s*([^\n€|]+)/i);
      const epaisseurMatch = bloc.match(/Epaisseur\s*:\s*([^\n€|]+)/i);
      const prixMatch = bloc.match(/([\d,.]+)\s*€\s+(\d+)\s+([\d,.]+)\s*€/);

      const lignesBloc = bloc.split('\n').map(l => l.trim()).filter(Boolean);
      let designationSuivante = "";
      
      for (let i = lignesBloc.length - 1; i >= 0; i--) {
        const l = lignesBloc[i];
        if (l === l.toUpperCase() && !l.includes("€") && isNaN(Number(l)) && l.length > 5 && !["TOTAL", "FRAIS", "SUIVI"].some(w => l.includes(w))) {
          designationSuivante = l;
          break;
        }
      }

      if (tailleMatch) {
        const designation = idx === 1 ? premiereDesignation : (window as any)._derniereDesignation || "ARTICLE IMPORTÉ";
        
        if (designationSuivante) {
          (window as any)._derniereDesignation = designationSuivante;
        }

        let couleurFinale = couleurPrincMatch?.[1]?.trim() || "Blanc";
        if (couleurSecMatch && couleurSecMatch[1].trim() !== couleurFinale) {
          couleurFinale += ` / ${couleurSecMatch[1].trim()}`;
        }

        items.push({
          designation: designation.trim(),
          taille: tailleMatch[1].split(/[\d,.]+\s*€/)[0].replace(/[:|]/g, "").trim(),
          tissu: tissuMatch?.[1]?.replace(/[:|]/g, "").trim() || "Coton Vosges 57 fils/cm2",
          couleur: couleurFinale,
          epaisseur: epaisseurMatch?.[1]?.replace(/[:|]/g, "").trim() || "Standard",
          prixUnitaire: prixMatch ? parseFloat(prixMatch[1].replace(',', '.')) : 0,
          quantite: prixMatch ? parseInt(prixMatch[2], 10) : 1,
        });
      }
    });

    delete (window as any)._derniereDesignation;

    if (items.length === 0) {
      items.push({ designation: "", taille: "", tissu: "Coton Vosges 57 fils/cm2", couleur: "Blanc", epaisseur: "Standard", prixUnitaire: 0, quantite: 1 });
    }

    setFormData({
      orderReference: `NG-#${orderNum || Date.now()}`,
      totalTTC: parseFloat(totalTTC.replace(',', '.')),
      client: { email, nom, prenom, adresse, codePostal, ville: city },
      items
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const text = await pdfToText(file);
      parseTextContent(text);
    } catch (err) {
      setError("Impossible de lire le fichier PDF.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = (idx: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { designation: "", taille: "", tissu: "Coton Vosges 57 fils/cm2", couleur: "Blanc", epaisseur: "Standard", prixUnitaire: 0, quantite: 1 }]
    });
  };

  const handleRemoveItem = (idx: number) => {
    const newItems = formData.items.filter((_: any, i: number) => i !== idx);
    setFormData({ ...formData, items: newItems });
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await saveImportedNGOrder(formData);
      if (res.success) {
        alert("Commande enregistrée et envoyée à la coupe ! 🪡");
        setFormData(null);
        setImportMode(null);
        setRawText('');
        if (onOrderImported) onOrderImported();
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError("Erreur serveur lors de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-3xl border border-slate-200 max-w-5xl mx-auto my-4 shadow-sm">
      <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">📥 Import de Commande Nicole Germain</h2>

      {!importMode && !formData && (
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setImportMode('PDF')} className="p-6 border-2 border-dashed rounded-2xl flex flex-col items-center gap-2 hover:border-indigo-500 transition text-slate-600 font-bold text-sm">
            <UploadCloud size={32} className="text-indigo-500" /> Glisser un fichier PDF
          </button>
          <button onClick={() => setImportMode('TEXT')} className="p-6 border-2 border-dashed rounded-2xl flex flex-col items-center gap-2 hover:border-indigo-500 transition text-slate-600 font-bold text-sm">
            <FileText size={32} className="text-emerald-500" /> Copier-coller du texte brut (Word/Web)
          </button>
        </div>
      )}

      {importMode === 'PDF' && !formData && (
        <div className="border-2 border-dashed border-indigo-300 rounded-2xl p-8 text-center relative cursor-pointer">
          <input type="file" accept="application/pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <p className="text-slate-600 font-medium text-xs">
            {loading ? "Lecture du document... ⏳" : "Clique ou dépose le PDF ici pour l'analyser"}
          </p>
        </div>
      )}

      {importMode === 'TEXT' && !formData && (
        <div className="space-y-3">
          <textarea
            rows={8}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Colle le texte du mail ou du fichier Word ici..."
            className="w-full p-4 bg-slate-50 border rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
          />
          <button onClick={() => parseTextContent(rawText)} className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition">
            Lancer l'analyse du texte ⚡
          </button>
        </div>
      )}

      {error && <p className="text-red-500 text-xs font-bold mt-2">⚠️ {error}</p>}

      {formData && (
        <div className="mt-6 space-y-6">
          {/* CLIENT BLOCK (Comprend désormais l'adresse, CP, Ville) */}
          <div className="bg-slate-50 p-4 rounded-2xl border space-y-3">
            <h3 className="font-bold text-xs uppercase text-slate-500 tracking-wider">Informations Dossier & Client</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Référence</label>
                <input type="text" value={formData.orderReference} onChange={(e) => setFormData({...formData, orderReference: e.target.value})} className="w-full p-2 border rounded-lg bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Nom Complet</label>
                <input type="text" value={`${formData.client.prenom || ''} ${formData.client.nom || ''}`.trim()} onChange={(e) => setFormData({...formData, client: {...formData.client, nom: e.target.value, prenom: ''}})} className="w-full p-2 border rounded-lg bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Email Client</label>
                <input type="text" value={formData.client.email} onChange={(e) => setFormData({...formData, client: {...formData.client, email: e.target.value}})} className="w-full p-2 border rounded-lg bg-white" />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Total TTC (€)</label>
                <input type="number" step="0.01" value={formData.totalTTC} onChange={(e) => setFormData({...formData, totalTTC: parseFloat(e.target.value)})} className="w-full p-2 border rounded-lg bg-white" />
              </div>
            </div>
            
            {/* Nouvelle ligne d'inputs pour l'adresse complète */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
              <div className="md:col-span-1">
                <label className="block text-slate-500 mb-1">Adresse Livraison / Facturation</label>
                <input type="text" value={formData.client.adresse || ''} onChange={(e) => setFormData({...formData, client: {...formData.client, adresse: e.target.value}})} className="w-full p-2 border rounded-lg bg-white" placeholder="Ex: 60 RUE CENTRALE" />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Code Postal</label>
                <input type="text" value={formData.client.codePostal || ''} onChange={(e) => setFormData({...formData, client: {...formData.client, codePostal: e.target.value}})} className="w-full p-2 border rounded-lg bg-white" placeholder="Ex: 74940" />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Ville</label>
                <input type="text" value={formData.client.ville || ''} onChange={(e) => setFormData({...formData, client: {...formData.client, ville: e.target.value}})} className="w-full p-2 border rounded-lg bg-white" placeholder="Ex: ANNECY" />
              </div>
            </div>
          </div>

{/* ATELIER ITEMS BLOCK */}
<div className="space-y-3">
  <div className="flex justify-between items-center">
    <h3 className="font-bold text-xs uppercase text-slate-500 tracking-wider">Lignes de Coupe (Atelier)</h3>
    <button onClick={handleAddItem} className="px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-100 transition">
      <Plus size={14} /> Ajouter un produit
    </button>
  </div>

  <div className="space-y-3">
    {formData.items.map((item: any, idx: number) => (
      <div key={idx} className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm grid grid-cols-1 md:grid-cols-7 gap-2 text-xs relative items-end">
        <div>
          <label className="text-slate-500 block mb-0.5 font-medium">Désignation</label>
          <input 
            type="text" 
            value={item.designation} 
            onChange={(e) => handleUpdateItem(idx, 'designation', e.target.value.toUpperCase())} 
            className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 transition" 
          />
        </div>
        <div>
          <label className="text-slate-500 block mb-0.5 font-medium">Taille</label>
          <input 
            type="text" 
            value={item.taille} 
            onChange={(e) => handleUpdateItem(idx, 'taille', e.target.value)} 
            className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 transition" 
          />
        </div>
        <div>
          <label className="text-slate-500 block mb-0.5 font-medium">Bonnet / Épaisseur</label>
          <input 
            type="text" 
            value={item.epaisseur} 
            onChange={(e) => handleUpdateItem(idx, 'epaisseur', e.target.value)} 
            className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 transition" 
          />
        </div>
        <div>
          <label className="text-slate-500 block mb-0.5 font-medium">Tissu / Matière</label>
          <input 
            type="text" 
            value={item.tissu} 
            onChange={(e) => handleUpdateItem(idx, 'tissu', e.target.value)} 
            className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 transition" 
          />
        </div>
        <div>
          <label className="text-slate-500 block mb-0.5 font-medium">Couleur</label>
          <input 
            type="text" 
            value={item.couleur} 
            onChange={(e) => handleUpdateItem(idx, 'couleur', e.target.value)} 
            className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 transition" 
          />
        </div>
        <div>
          <label className="text-slate-500 block mb-0.5 font-medium">Quantité</label>
          <input 
            type="number" 
            value={item.quantite} 
            onChange={(e) => handleUpdateItem(idx, 'quantite', parseInt(e.target.value) || 1)} 
            className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-indigo-500 transition" 
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-full">
            <label className="text-slate-500 block mb-0.5 font-medium">P.U. (€)</label>
            <input 
              type="number" 
              step="0.01" 
              value={item.prixUnitaire} 
              onChange={(e) => handleUpdateItem(idx, 'prixUnitaire', parseFloat(e.target.value) || 0)} 
              className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 transition" 
            />
          </div>
          {formData.items.length > 1 && (
            <button onClick={() => handleRemoveItem(idx)} className="p-2 border border-red-200 text-red-500 rounded-lg bg-red-50 hover:bg-red-100 transition mt-4 shrink-0">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    ))}
  </div>
</div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={() => { setFormData(null); setImportMode(null); }} className="px-4 py-2 border rounded-xl text-xs text-slate-600 hover:bg-slate-50 font-medium">
              Annuler
            </button>
            <button onClick={handleConfirmImport} disabled={loading} className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 shadow-sm transition">
              {loading ? "Enregistrement..." : "Valider et envoyer à la Coupe 🚀"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}