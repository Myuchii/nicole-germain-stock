import { type NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL manquante' }, { status: 400 });
  }

  try {
    const result = await get(url, { access: 'private' });

    // 🟢 On gère le cas où le fichier n'existe pas sur Vercel Blob
    if (!result) {
      return new NextResponse('Fichier introuvable', { status: 404 });
    }

    const filename = result.blob.pathname.split('/').pop();

return new NextResponse(result.stream, {
      headers: {
        // 🟢 On ajoute "|| 'application/octet-stream'" pour remplacer null par une vraie string
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