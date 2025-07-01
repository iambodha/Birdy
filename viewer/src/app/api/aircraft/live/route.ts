// Move the data generation to client-side since GitHub Pages doesn't support API routes
// This file is kept for development compatibility but won't be used in production

import { NextRequest, NextResponse } from 'next/server';

// Required for static export - but this route won't be called in production
export const dynamic = 'force-static';
export const revalidate = false;

// Simple static response for build process
export async function GET() {
  // Return minimal static data for build compatibility
  return NextResponse.json({
    aircraft: [],
    stats: {
      totalAircraft: 0,
      airborneAircraft: 0,
      groundAircraft: 0,
      trackedCountries: 0
    },
    timestamp: new Date().toISOString(),
    authenticated: false,
    dataSource: 'static',
    fromCache: false,
    message: 'This API route is not available in static export mode'
  });
}