import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const photoReference = searchParams.get('photo_reference');
  const maxWidth = searchParams.get('maxwidth') || '400';

  if (!photoReference) {
    return NextResponse.json(
      { error: 'photo_reference is required' },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Places API key not configured' },
      { status: 500 }
    );
  }

  // Proxy the photo request through our server
  const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${apiKey}`;

  try {
    const response = await fetch(photoUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch photo' },
        { status: response.status }
      );
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Photo proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photo' },
      { status: 500 }
    );
  }
}

