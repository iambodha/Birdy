import { NextRequest, NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import path from 'path';

interface FlightHistory {
  id: number;
  icao24: string;
  callsign: string | null;
  origin_country: string | null;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  on_ground: boolean | null;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  collection_time: string;
  time_position: number | null;
  last_contact: number | null;
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
            id, icao24, callsign, origin_country, longitude, latitude,
            baro_altitude, on_ground, velocity, true_track, vertical_rate,
            collection_time, time_position, last_contact
          FROM flights 
          WHERE icao24 = ?
          ORDER BY collection_time ASC
        `;

        db.all(query, [icao24], (err, flights: FlightHistory[]) => {
          db.close();
          
          if (err) {
            console.error('Database error:', err);
            resolve(NextResponse.json(
              { error: 'Failed to fetch flight history' },
              { status: 500 }
            ));
            return;
          }

          resolve(NextResponse.json({
            flights,
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