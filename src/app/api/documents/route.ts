import { type NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import mammoth from 'mammoth'; // 🟢 Ajout de la librairie

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL manquante' }, { status: 400 });
  }

  try {
    const result = await get(url, { access: 'private' });

    if (!result) {
      return new NextResponse('Fichier introuvable', { status: 404 });
    }

    const filename = result.blob.pathname.split('/').pop() || 'document';
    const lowerName = filename.toLowerCase();

    // 🟢 SI C'EST UN FICHIER WORD (.docx)
    if (lowerName.endsWith('.docx')) {
      // 1. On transforme le flux (stream) en Buffer lisible par Mammoth
      const arrayBuffer = await new Response(result.stream).arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 2. Mammoth convertit le Word en HTML
      const mammothResult = await mammoth.convertToHtml({ buffer });

      // 3. On crée une jolie petite page web pour afficher le résultat
      const htmlPage = `
        <!DOCTYPE html>
        <html lang="fr">
          <head>
            <meta charset="utf-8">
            <title>${filename} - Aperçu</title>
            <style>
              body { 
                font-family: system-ui, -apple-system, sans-serif; 
                line-height: 1.6; 
                color: #334155; 
                max-width: 900px; 
                margin: 0 auto; 
                padding: 2rem; 
                background: #f8fafc;
              }
              .paper {
                background: white;
                padding: 3rem;
                border-radius: 1rem;
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
              }
              img { max-width: 100%; height: auto; }
              table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
              td, th { border: 1px solid #cbd5e1; padding: 0.5rem; }
            </style>
          </head>
          <body>
            <div class="paper">
              ${mammothResult.value}
            </div>
          </body>
        </html>
      `;

      // 4. On renvoie la page web (HTML) au lieu du fichier brut
      return new NextResponse(htmlPage, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    // 🟢 POUR LE RESTE (PDF, Images...) : Ton code d'origine intact
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error("Erreur de lecture du document :", error);
    return new NextResponse('Erreur serveur lors de la lecture du fichier', { status: 500 });
  }
}