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
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0
    },
    message: 'This API route is not available in static export mode'
  });
}