import { NextRequest, NextResponse } from 'next/server';
import { generateTrip } from '@/lib/trip-generator';
import { TripSearchParams } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: TripSearchParams = await request.json();
    
    // Validate required fields
    if (!body.destination) {
      return NextResponse.json(
        { error: 'Destination is required' },
        { status: 400 }
      );
    }

    if (!body.interests || body.interests.length === 0) {
      return NextResponse.json(
        { error: 'At least one interest is required' },
        { status: 400 }
      );
    }

    // Generate trip
    const trip = await generateTrip(body);

    return NextResponse.json({ trip });
  } catch (error: any) {
    console.error('Trip generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate trip' },
      { status: 500 }
    );
  }
}

