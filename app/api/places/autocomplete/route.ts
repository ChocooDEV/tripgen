import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const input = searchParams.get('input');

  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Places API key not configured' },
      { status: 500 }
    );
  }

  try {
    // Use Places Autocomplete API
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=(cities)&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.predictions) {
      const predictions = data.predictions.map((pred: any) => ({
        description: pred.description,
        place_id: pred.place_id,
        structured_formatting: pred.structured_formatting,
      }));
      return NextResponse.json({ predictions });
    }

    return NextResponse.json({ predictions: [] });
  } catch (error) {
    console.error('Autocomplete error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch autocomplete suggestions' },
      { status: 500 }
    );
  }
}

