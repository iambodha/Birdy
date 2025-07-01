import { NextRequest, NextResponse } from 'next/server';

// Required for static export
export const dynamic = 'force-dynamic';

interface FlightJourney {
  id: number;
  icao24: string;
  callsign: string | null;
  origin_country: string | null;
  collection_time: string;
  flight_date: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number | null;
  start_status: string | null;
  end_status: string | null;
  flight_status: string | null;
  max_altitude: number | null;
  max_velocity: number | null;
  position_count: number | null;
  positions: Position[];
}

interface Position {
  timestamp: string;
  lon: number;
  lat: number;
  alt_baro?: number;
  alt_geo?: number;
  velocity?: number;
  track?: number;
  vert_rate?: number;
  on_ground?: boolean;
}

// Mock flight history generator
function generateMockFlightHistory(icao24: string): FlightJourney[] {
  const callsigns = ['AAL1234', 'UAL5678', 'DAL9012', 'SWA3456', 'BAW7890', 'DLH2345', 'AFR6789', 'KLM0123'];
  const countries = ['United States', 'United Kingdom', 'Germany', 'France', 'Canada', 'Netherlands'];
  const statuses = ['completed', 'active', 'cancelled', 'delayed'];
  const startStatuses = ['on_time', 'delayed', 'early'];
  const endStatuses = ['on_time', 'delayed', 'early', 'diverted'];
  
  const flights: FlightJourney[] = [];
  const numFlights = Math.floor(Math.random() * 15) + 5; // 5-20 flights
  
  for (let i = 0; i < numFlights; i++) {
    const flightDate = new Date(Date.now() - (i * 24 * 60 * 60 * 1000) - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));
    const departureTime = new Date(flightDate.getTime() + Math.floor(Math.random() * 24 * 60 * 60 * 1000));
    const durationMinutes = Math.floor(Math.random() * 600) + 60; // 1-11 hours
    const arrivalTime = new Date(departureTime.getTime() + durationMinutes * 60 * 1000);
    
    // Generate realistic flight path positions
    const positions: Position[] = [];
    const numPositions = Math.floor(Math.random() * 100) + 20; // 20-120 positions
    
    // Start and end coordinates (mock flight route)
    const startLat = (Math.random() - 0.5) * 160; // -80 to 80
    const startLon = (Math.random() - 0.5) * 360; // -180 to 180
    const endLat = (Math.random() - 0.5) * 160;
    const endLon = (Math.random() - 0.5) * 360;
    
    for (let j = 0; j < numPositions; j++) {
      const progress = j / (numPositions - 1);
      const lat = startLat + (endLat - startLat) * progress + (Math.random() - 0.5) * 2;
      const lon = startLon + (endLon - startLon) * progress + (Math.random() - 0.5) * 2;
      
      // Simulate realistic altitude profile (takeoff, cruise, landing)
      let altitude: number;
      if (progress < 0.1) {
        // Takeoff
        altitude = progress * 100000; // 0 to 10,000m
      } else if (progress > 0.9) {
        // Landing
        altitude = (1 - progress) * 100000; // 10,000m to 0
      } else {
        // Cruise
        altitude = 10000 + Math.random() * 2000; // 10,000-12,000m
      }
      
      const velocity = altitude < 1000 ? Math.random() * 100 + 50 : Math.random() * 200 + 400; // Ground: 50-150, Air: 400-600
      
      positions.push({
        timestamp: new Date(departureTime.getTime() + progress * durationMinutes * 60 * 1000).toISOString(),
        lat: parseFloat(lat.toFixed(4)),
        lon: parseFloat(lon.toFixed(4)),
        alt_baro: Math.round(altitude),
        alt_geo: Math.round(altitude + Math.random() * 100 - 50),
        velocity: Math.round(velocity),
        track: Math.floor(Math.random() * 360),
        vert_rate: altitude < 1000 || altitude > 11000 ? Math.random() * 1000 - 500 : Math.random() * 200 - 100,
        on_ground: altitude < 100
      });
    }
    
    flights.push({
      id: i + 1,
      icao24: icao24,
      callsign: Math.random() > 0.2 ? callsigns[Math.floor(Math.random() * callsigns.length)] : null,
      origin_country: countries[Math.floor(Math.random() * countries.length)],
      collection_time: new Date().toISOString(),
      flight_date: flightDate.toISOString().split('T')[0],
      departure_time: departureTime.toISOString(),
      arrival_time: arrivalTime.toISOString(),
      duration_minutes: durationMinutes,
      start_status: startStatuses[Math.floor(Math.random() * startStatuses.length)],
      end_status: endStatuses[Math.floor(Math.random() * endStatuses.length)],
      flight_status: statuses[Math.floor(Math.random() * statuses.length)],
      max_altitude: Math.max(...positions.map(p => p.alt_baro || 0)),
      max_velocity: Math.max(...positions.map(p => p.velocity || 0)),
      position_count: positions.length,
      positions: positions
    });
  }
  
  return flights.sort((a, b) => new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime());
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const icao24 = searchParams.get('icao24');

  if (!icao24) {
    return NextResponse.json(
      { error: 'ICAO24 parameter is required' },
      { status: 400 }
    );
  }

  // Simulate some delay
  await new Promise(resolve => setTimeout(resolve, 300));

  try {
    const flights = generateMockFlightHistory(icao24);

    return NextResponse.json({
      flights: flights,
      total: flights.length
    });

  } catch (error) {
    console.error('Mock data generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate flight history' },
      { status: 500 }
    );
  }
}