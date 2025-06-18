import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import path from 'path';

export async function GET() {
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

        // Get total aircraft count
        db.get(`SELECT COUNT(*) as count FROM aircraft_metadata`, (err, totalAircraft: { count: number }) => {
          if (err) {
            db.close();
            resolve(NextResponse.json({ error: 'Failed to fetch total count' }, { status: 500 }));
            return;
          }

          // Get manufacturer distribution
          db.all(`
            SELECT manufacturer_name, COUNT(*) as count 
            FROM aircraft_metadata 
            WHERE manufacturer_name IS NOT NULL 
            GROUP BY manufacturer_name 
            ORDER BY count DESC 
            LIMIT 10
          `, (err, manufacturers: { manufacturer_name: string; count: number }[]) => {
            if (err) {
              db.close();
              resolve(NextResponse.json({ error: 'Failed to fetch manufacturers' }, { status: 500 }));
              return;
            }

            // Get operator distribution
            db.all(`
              SELECT operator, COUNT(*) as count 
              FROM aircraft_metadata 
              WHERE operator IS NOT NULL AND operator != '' 
              GROUP BY operator 
              ORDER BY count DESC 
              LIMIT 10
            `, (err, operators: { operator: string; count: number }[]) => {
              if (err) {
                db.close();
                resolve(NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 }));
                return;
              }

              // Get aircraft types
              db.all(`
                SELECT model, COUNT(*) as count 
                FROM aircraft_metadata 
                WHERE model IS NOT NULL 
                GROUP BY model 
                ORDER BY count DESC 
                LIMIT 10
              `, (err, aircraftTypes: { model: string; count: number }[]) => {
                if (err) {
                  db.close();
                  resolve(NextResponse.json({ error: 'Failed to fetch aircraft types' }, { status: 500 }));
                  return;
                }

                // Get recent additions
                db.get(`
                  SELECT COUNT(*) as count 
                  FROM aircraft_metadata 
                  WHERE updated_at >= datetime('now', '-7 days')
                `, (err, recentAdditions: { count: number }) => {
                  db.close();
                  
                  if (err) {
                    resolve(NextResponse.json({ error: 'Failed to fetch recent additions' }, { status: 500 }));
                    return;
                  }

                  resolve(NextResponse.json({
                    totalAircraft: totalAircraft.count,
                    recentAdditions: recentAdditions.count,
                    topManufacturers: manufacturers,
                    topOperators: operators,
                    topAircraftTypes: aircraftTypes
                  }));
                });
              });
            });
          });
        });
      });

    } catch (error) {
      console.error('Database error:', error);
      resolve(NextResponse.json(
        { error: 'Failed to fetch statistics' },
        { status: 500 }
      ));
    }
  });
}