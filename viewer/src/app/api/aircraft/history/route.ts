import { NextRequest, NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import path from 'path';

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
  positions: string | null; // JSON string of position array
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const icao24 = searchParams.get('icao24');

  if (!icao24) {
    return NextResponse.json(
      { error: 'ICAO24 parameter is required' },
      { status: 400 }
    );
  }

  return new Promise((resolve) => {
    try {
      const dbPath = path.join(process.cwd(), 'birdy_flights.db');
      
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          resolve(NextResponse.json(
            { error: 'Failed to connect to database' },
            { status: 500 }
          ));
          return;
        }

        const query = `
          SELECT 
            id, icao24, callsign, origin_country, collection_time,
            flight_date, departure_time, arrival_time, duration_minutes,
            start_status, end_status, flight_status, max_altitude, max_velocity,
            position_count, positions
          FROM flights 
          WHERE icao24 = ?
          ORDER BY departure_time DESC
        `;

        db.all(query, [icao24], (err, flights: FlightJourney[]) => {
          db.close();
          
          if (err) {
            console.error('Database error:', err);
            resolve(NextResponse.json(
              { error: 'Failed to fetch flight history' },
              { status: 500 }
            ));
            return;
          }

          // Parse positions JSON for each flight
          const flightsWithParsedPositions = flights.map(flight => ({
            ...flight,
            positions: flight.positions ? JSON.parse(flight.positions) as Position[] : []
          }));

          resolve(NextResponse.json({
            flights: flightsWithParsedPositions,
            total: flights.length
          }));
        });
      });

    } catch (error) {
      console.error('Database error:', error);
      resolve(NextResponse.json(
        { error: 'Failed to fetch flight history' },
        { status: 500 }
      ));
    }
  });
}