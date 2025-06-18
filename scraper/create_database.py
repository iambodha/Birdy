import sqlite3
import os
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
    
    # Commit changes
    conn.commit()
    
    print(f"Database '{db_path}' created successfully with the following tables:")
    print("  - flights: Stores real-time flight data")
    print("  - aircraft_metadata: Stores aircraft information")
    print("  - flights_with_metadata: View joining both tables")
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
    
    print(f"Database: {db_path}")
    print(f"  Flights records: {flights_count:,}")
    print(f"  Aircraft metadata records: {metadata_count:,}")
    
    # Get latest collection time
    cursor.execute("SELECT collection_time FROM flights ORDER BY collection_time DESC LIMIT 1")
    latest = cursor.fetchone()
    if latest:
        print(f"  Latest collection: {latest[0]}")
    
    conn.close()

if __name__ == "__main__":
    # Create the database
    db_path = create_database()
    
    # Show database info
    get_database_info(db_path)