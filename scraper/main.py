# enhanced_collector.py
import requests
import sqlite3
from datetime import datetime
import time
import os

def init_database(db_path="birdy_flights.db"):
    """Initialize database if it doesn't exist"""
    if not os.path.exists(db_path):
        from create_database import create_database
        create_database(db_path)
    return db_path

def save_flights_to_db(flights, db_path="birdy_flights.db"):
    """Save flights data to SQLite database"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Insert flights data
    insert_query = '''
        INSERT INTO flights (
            icao24, callsign, origin_country, time_position, last_contact,
            longitude, latitude, baro_altitude, on_ground, velocity,
            true_track, vertical_rate, sensors, geo_altitude, squawk,
            spi, position_source, category, collection_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''
    
    flight_records = []
    for flight in flights:
        flight_records.append((
            flight["icao24"],
            flight["callsign"],
            flight["origin_country"],
            flight["time_position"],
            flight["last_contact"],
            flight["longitude"],
            flight["latitude"],
            flight["baro_altitude"],
            flight["on_ground"],
            flight["velocity"],
            flight["true_track"],
            flight["vertical_rate"],
            flight["sensors"],
            flight["geo_altitude"],
            flight["squawk"],
            flight["spi"],
            flight["position_source"],
            flight["category"],
            flight["collection_time"]
        ))
    
    cursor.executemany(insert_query, flight_records)
    conn.commit()
    
    rows_inserted = cursor.rowcount
    conn.close()
    
    return rows_inserted

def fetch_adsb_data():
    """Basic ADS-B data collection without derived fields"""
    # Initialize database
    db_path = init_database()
    
    url = "https://opensky-network.org/api/states/all"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        print(f"Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Error: HTTP {response.status_code}")
            return
            
        data = response.json()
        
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return
    except ValueError as e:
        print(f"JSON decode error: {e}")
        return

    flights = []
    states = data.get("states", [])
    print(f"Found {len(states)} aircraft states")
    collection_timestamp = datetime.utcnow()
    
    for state in states:
        if len(state) >= 10 and state[1] and state[5] and state[6]:
            
            flight = {
                "icao24": state[0],
                "callsign": state[1].strip() if state[1] else "",
                "origin_country": state[2],
                "time_position": state[3],
                "last_contact": state[4],
                "longitude": state[5],
                "latitude": state[6],
                "baro_altitude": state[7],
                "on_ground": state[8],
                "velocity": state[9],
                "true_track": state[10] if len(state) > 10 else None,
                "vertical_rate": state[11] if len(state) > 11 else None,
                "sensors": state[12] if len(state) > 12 else None,
                "geo_altitude": state[13] if len(state) > 13 else None,
                "squawk": state[14] if len(state) > 14 else None,
                "spi": state[15] if len(state) > 15 else None,
                "position_source": state[16] if len(state) > 16 else None,
                "category": state[17] if len(state) > 17 else None,
                "collection_time": collection_timestamp.isoformat()
            }
            
            flights.append(flight)

    if flights:
        rows_inserted = save_flights_to_db(flights, db_path)
        print(f"Saved {rows_inserted} flights to database '{db_path}'")
        
        # Show database stats
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM flights")
        total_flights = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(DISTINCT icao24) FROM flights")
        unique_aircraft = cursor.fetchone()[0]
        conn.close()
        
        print(f"Total flights in database: {total_flights:,}")
        print(f"Unique aircraft tracked: {unique_aircraft:,}")
    else:
        print("No flights found")

if __name__ == "__main__":
    fetch_adsb_data()