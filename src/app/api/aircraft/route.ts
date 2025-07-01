import { NextRequest, NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import path from 'path';

interface AircraftMetadata {
  id: number;
  icao24: string;
  registration: string | null;
  manufacturer_name: string | null;
  model: string | null;
  typecode: string | null;
  operator: string | null;
  operator_callsign: string | null;
  owner: string | null;
  category_description: string | null;
  built: string | null;
  first_flight_date: string | null;
  engines: string | null;
  seat_configuration: string | null;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || '';
  const offset = (page - 1) * limit;

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

        let whereClause = '';
        let params: any[] = [];

        if (search) {
          whereClause = `WHERE 
            icao24 LIKE ? OR 
            registration LIKE ? OR 
            manufacturer_name LIKE ? OR 
            model LIKE ? OR 
            operator LIKE ?`;
          const searchPattern = `%${search}%`;
          params = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
        }

        // Get total count first
        const countQuery = `SELECT COUNT(*) as total FROM aircraft_metadata ${whereClause}`;
        db.get(countQuery, params, (err, countResult: { total: number }) => {
          if (err) {
            db.close();
            resolve(NextResponse.json(
              { error: 'Failed to fetch count' },
              { status: 500 }
            ));
            return;
          }

          const total = countResult.total;

          // Get paginated data
          const dataQuery = `
            SELECT 
              id, icao24, registration, manufacturer_name, model, typecode,
              operator, operator_callsign, owner, category_description,
              built, first_flight_date, engines, seat_configuration, updated_at
            FROM aircraft_metadata 
            ${whereClause}
            ORDER BY updated_at DESC
            LIMIT ? OFFSET ?
          `;
          
          const dataParams = [...params, limit, offset];
          db.all(dataQuery, dataParams, (err, aircraft: AircraftMetadata[]) => {
            db.close();
            
            if (err) {
              resolve(NextResponse.json(
                { error: 'Failed to fetch aircraft data' },
                { status: 500 }
              ));
              return;
            }

            resolve(NextResponse.json({
              aircraft,
              pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
              }
            }));
          });
        });
      });

    } catch (error) {
      console.error('Database error:', error);
      resolve(NextResponse.json(
        { error: 'Failed to fetch aircraft data' },
        { status: 500 }
      ));
    }
  });
}