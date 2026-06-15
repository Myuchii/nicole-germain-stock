import os
import pandas as pd

# 1. Nom de ton fichier Excel d'origine
excel_file = "REFERENCE FOURNISSEURS TISSUS ET ACCESSOIRES.xlsx"

# 2. Dossier de destination (celui attendu par notre script de seed Prisma)
output_dir = "prisma/data"

# Créer le dossier s'il n'existe pas encore
os.makedirs(output_dir, exist_ok=True)

print(f"⏳ Lecture du fichier Excel : {excel_file}...")
xls = pd.ExcelFile(excel_file)

# 3. Boucle magique : extrait chaque feuille une par une
for sheet_name in xls.sheet_names:
    print(f"-> Extraction de l'onglet : {sheet_name}")
    
    # Lire l'onglet en ignorant les lignes complètement vides
    df = pd.read_excel(excel_file, sheet_name=sheet_name)
    
    # Remplacer les noms d'onglets avec des espaces complexes pour le script
    clean_name = sheet_name.replace(" ", "_")
    csv_file_path = os.path.join(output_dir, f"{clean_name}.csv")
    
    # Sauvegarder en CSV propre (Séparateur: Virgule, Encodage: UTF-8 pour Nicole et Betty)
    df.to_csv(csv_file_path, index=False, encoding='utf-8')

print(f"🏁 Terminé ! Tes fichiers CSV sont disponibles dans : {output_dir}/")