import sqlite3
import os
import json
from datetime import datetime

def create_database(db_path="birdy_flights.db"):
    """Create the SQLite database and tables for flight tracking"""
    
    # Remove existing database if it exists (for fresh start)
    if os.path.exists(db_path):
        print(f"Database {db_path} already exists. Continuing with existing database.")
    
    # Connect to database (creates if doesn't exist)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create flights table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS flights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            icao24 TEXT NOT NULL,
            callsign TEXT,
            origin_country TEXT,
            time_position INTEGER,
            last_contact INTEGER,
            longitude REAL,
            latitude REAL,
            baro_altitude REAL,
            on_ground BOOLEAN,
            velocity REAL,
            true_track REAL,
            vertical_rate REAL,
            sensors TEXT,
            geo_altitude REAL,
            squawk TEXT,
            spi BOOLEAN,
            position_source INTEGER,
            category INTEGER,
            collection_time TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            -- Enhanced fields for flight journey tracking
            flight_date DATE,
            departure_time DATETIME,
            arrival_time DATETIME,
            duration_minutes INTEGER,
            start_status TEXT CHECK(start_status IN ('airborne', 'ground', 'unknown')),
            end_status TEXT CHECK(end_status IN ('airborne', 'ground', 'unknown')),
            flight_status TEXT CHECK(flight_status IN ('complete', 'partial', 'ongoing')),
            max_altitude REAL,
            max_velocity REAL,
            distance_km REAL,
            departure_airport TEXT,
            arrival_airport TEXT,
            route_description TEXT,
            position_count INTEGER DEFAULT 0,
            positions TEXT, -- JSON array of position data
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create active_tracking table (REQUIRED by FlightTracker)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS active_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            icao24 TEXT NOT NULL,
            callsign TEXT,
            origin_country TEXT,
            tracking_start_time TEXT NOT NULL,
            last_update_time TEXT NOT NULL,
            flight_status TEXT NOT NULL,  -- 'ground', 'takeoff', 'airborne', 'landing'
            takeoff_time TEXT,
            positions TEXT,  -- JSON array of position data
            UNIQUE(icao24)
        )
    ''')
    
    # Create raw_positions table for temporary storage during processing
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS raw_positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            icao24 TEXT NOT NULL,
            callsign TEXT,
            origin_country TEXT,
            time_position INTEGER,
            last_contact INTEGER,
            longitude REAL,
            latitude REAL,
            baro_altitude REAL,
            on_ground BOOLEAN,
            velocity REAL,
            true_track REAL,
            vertical_rate REAL,
            sensors TEXT,
            geo_altitude REAL,
            squawk TEXT,
            spi BOOLEAN,
            position_source INTEGER,
            category INTEGER,
            collection_time DATETIME NOT NULL,
            processed BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create aircraft_metadata table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS aircraft_metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            icao24 TEXT UNIQUE NOT NULL,
            registration TEXT,
            manufacturer_icao TEXT,
            manufacturer_name TEXT,
            model TEXT,
            typecode TEXT,
            serial_number TEXT,
            line_number TEXT,
            icao_aircraft_type TEXT,
            operator TEXT,
            operator_callsign TEXT,
            operator_icao TEXT,
            operator_iata TEXT,
            owner TEXT,
            category_description TEXT,
            built TEXT,
            first_flight_date TEXT,
            seat_configuration TEXT,
            engines TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create indexes for better performance
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_flights_icao24 ON flights(icao24)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_flights_collection_time ON flights(collection_time)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_flights_callsign ON flights(callsign)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_aircraft_icao24 ON aircraft_metadata(icao24)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_aircraft_registration ON aircraft_metadata(registration)
    ''')
    
    # Additional indexes for enhanced functionality
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_flights_date ON flights(flight_date)''')
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_flights_status ON flights(flight_status)''')
    
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_raw_positions_icao24 ON raw_positions(icao24)''')
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_raw_positions_callsign ON raw_positions(callsign)''')
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_raw_positions_time ON raw_positions(collection_time)''')
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_raw_positions_processed ON raw_positions(processed)''')
    
    # Indexes for active_tracking table
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_active_tracking_icao24 ON active_tracking(icao24)''')
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_active_tracking_status ON active_tracking(flight_status)''')
    cursor.execute('''CREATE INDEX IF NOT EXISTS idx_active_tracking_update_time ON active_tracking(last_update_time)''')
    
    # Create a view for joined flight and aircraft data
    cursor.execute('''
        CREATE VIEW IF NOT EXISTS flights_with_metadata AS
        SELECT 
            f.*,
            am.registration,
            am.manufacturer_name,
            am.model,
            am.operator,
            am.operator_callsign
        FROM flights f
        LEFT JOIN aircraft_metadata am ON f.icao24 = am.icao24
    ''')
    
    # Additional views
    cursor.execute('''
        CREATE VIEW IF NOT EXISTS active_flights AS
        SELECT * FROM flights 
        WHERE flight_status = 'ongoing'
        ORDER BY updated_at DESC
    ''')
    
    cursor.execute('''
        CREATE VIEW IF NOT EXISTS completed_flights AS
        SELECT * FROM flights 
        WHERE flight_status = 'complete'
        ORDER BY departure_time DESC
    ''')
    
    # Create flight_statistics table for analytics
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS flight_statistics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flight_id INTEGER NOT NULL,
            avg_altitude REAL,
            avg_velocity REAL,
            time_airborne_minutes INTEGER,
            time_ground_minutes INTEGER,
            climb_rate_avg REAL,
            descent_rate_avg REAL,
            course_changes INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (flight_id) REFERENCES flights (id)
        )
    ''')
    
    # Commit changes
    conn.commit()
    
    print(f"Database '{db_path}' created successfully with the following tables:")
    print("  - flights: Stores real-time flight data")
    print("  - active_tracking: Stores ongoing flight tracking sessions")
    print("  - aircraft_metadata: Stores aircraft information")
    print("  - flights_with_metadata: View joining both tables")
    print("  - raw_positions: Temporary storage for individual position reports")
    print("  - flight_statistics: Stores computed flight analytics")
    print("\nAdditional views:")
    print("  - active_flights: Currently ongoing flights")
    print("  - completed_flights: Completed flight journeys")
    print("\nIndexes created for optimal query performance.")
    
    # Show table schemas
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table'")
    schemas = cursor.fetchall()
    
    print("\nTable schemas:")
    for schema in schemas:
        print(f"  {schema[0]}")
        print()
    
    conn.close()
    return db_path

def group_positions_into_flights(db_path="birdy_flights.db"):
    """Process raw positions and group them into flight journeys"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get unprocessed positions grouped by aircraft and callsign
    cursor.execute('''
        SELECT icao24, callsign, origin_country, 
               DATE(collection_time) as flight_date,
               COUNT(*) as position_count
        FROM raw_positions 
        WHERE processed = FALSE AND callsign IS NOT NULL AND callsign != ''
        GROUP BY icao24, callsign, DATE(collection_time)
        ORDER BY icao24, callsign, flight_date
    ''')
    
    flight_groups = cursor.fetchall()
    print(f"Found {len(flight_groups)} potential flight groups to process")
    
    flights_created = 0
    
    for group in flight_groups:
        icao24, callsign, origin_country, flight_date, position_count = group
        
        # Get all positions for this flight group, ordered by time
        cursor.execute('''
            SELECT id, longitude, latitude, baro_altitude, geo_altitude, 
                   velocity, true_track, vertical_rate, on_ground,
                   time_position, last_contact, collection_time,
                   squawk, spi, position_source, category, sensors
            FROM raw_positions 
            WHERE icao24 = ? AND callsign = ? AND DATE(collection_time) = ?
              AND processed = FALSE
            ORDER BY collection_time ASC
        ''', (icao24, callsign, flight_date))
        
        positions = cursor.fetchall()
        
        if len(positions) < 2:  # Need at least 2 positions for a flight
            continue
            
        # Analyze flight characteristics
        first_pos = positions[0]
        last_pos = positions[-1]
        
        # Determine flight status and timing
        departure_time = datetime.fromisoformat(first_pos[11])  # collection_time
        arrival_time = datetime.fromisoformat(last_pos[11])
        duration_minutes = int((arrival_time - departure_time).total_seconds() / 60)
        
        # Determine start/end status
        start_status = 'ground' if first_pos[8] else 'airborne'  # on_ground
        end_status = 'ground' if last_pos[8] else 'airborne'
        
        # Determine flight status
        if start_status == 'ground' and end_status == 'ground':
            flight_status = 'complete'
        elif start_status == 'airborne' and end_status == 'airborne':
            flight_status = 'partial'
        else:
            flight_status = 'complete' if start_status == 'ground' or end_status == 'ground' else 'partial'
        
        # Calculate flight statistics
        altitudes = [pos[2] for pos in positions if pos[2] is not None]  # baro_altitude
        velocities = [pos[4] for pos in positions if pos[4] is not None]  # velocity
        
        max_altitude = max(altitudes) if altitudes else None
        max_velocity = max(velocities) if velocities else None
        
        # Create position array
        position_array = []
        for pos in positions:
            position_data = {
                'timestamp': pos[11],
                'lon': pos[1],
                'lat': pos[2],
                'alt_baro': pos[3],
                'alt_geo': pos[4],
                'velocity': pos[5],
                'track': pos[6],
                'vert_rate': pos[7],
                'on_ground': pos[8]
            }
            position_data = {k: v for k, v in position_data.items() if v is not None}
            position_array.append(position_data)
        
        # Insert flight record
        cursor.execute('''
            INSERT INTO flights (
                icao24, callsign, origin_country, collection_time,
                flight_date, departure_time, arrival_time, duration_minutes,
                start_status, end_status, flight_status,
                max_altitude, max_velocity, position_count, positions
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            icao24, callsign, origin_country, departure_time.isoformat(),
            flight_date, departure_time.isoformat(), arrival_time.isoformat(), duration_minutes,
            start_status, end_status, flight_status,
            max_altitude, max_velocity, len(position_array), 
            json.dumps(position_array)
        ))
        
        # Mark raw positions as processed
        position_ids = [pos[0] for pos in positions]
        cursor.executemany('UPDATE raw_positions SET processed = TRUE WHERE id = ?', 
                          [(pos_id,) for pos_id in position_ids])
        
        flights_created += 1
        
        if flights_created % 10 == 0:
            print(f"Processed {flights_created} flights...")
    
    conn.commit()
    conn.close()
    
    print(f"Successfully created {flights_created} flight journeys from raw positions")
    return flights_created

def get_database_info(db_path="birdy_flights.db"):
    """Get information about the database"""
    if not os.path.exists(db_path):
        print(f"Database {db_path} does not exist. Run create_database() first.")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get table counts
    cursor.execute("SELECT COUNT(*) FROM flights")
    flights_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM aircraft_metadata")
    metadata_count = cursor.fetchone()[0]
    
    # Check if active_tracking table exists and get count
    try:
        cursor.execute("SELECT COUNT(*) FROM active_tracking")
        active_tracking_count = cursor.fetchone()[0]
    except sqlite3.OperationalError:
        active_tracking_count = 0
    
    print(f"Database: {db_path}")
    print(f"  Flights records: {flights_count:,}")
    print(f"  Aircraft metadata records: {metadata_count:,}")
    print(f"  Active tracking sessions: {active_tracking_count:,}")
    
    # Get latest collection time
    cursor.execute("SELECT collection_time FROM flights ORDER BY collection_time DESC LIMIT 1")
    latest = cursor.fetchone()
    if latest:
        print(f"  Latest collection: {latest[0]}")
    
    # Get raw positions count if table exists
    try:
        cursor.execute("SELECT COUNT(*) FROM raw_positions")
        raw_positions_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM raw_positions WHERE processed = TRUE")
        processed_positions_count = cursor.fetchone()[0]
        
        print(f"  Raw positions: {raw_positions_count:,}")
        print(f"  Processed positions: {processed_positions_count:,}")
        
        # Get flight status breakdown
        cursor.execute('''
            SELECT flight_status, COUNT(*) 
            FROM flights 
            WHERE flight_status IS NOT NULL
            GROUP BY flight_status
        ''')
        status_counts = cursor.fetchall()
        
        if status_counts:
            print(f"  Flight status breakdown:")
            for status, count in status_counts:
                print(f"    {status}: {count:,}")
    except sqlite3.OperationalError:
        # Tables don't exist yet
        pass
    
    conn.close()

if __name__ == "__main__":
    # Create the database
    db_path = create_database()
    
    # Show database info
    get_database_info(db_path)