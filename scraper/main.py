# enhanced_collector.py
import requests
import sqlite3
from datetime import datetime, timedelta, timezone
import time
import os
import json
import math

def init_database(db_path="birdy_flights.db"):
    """Initialize database if it doesn't exist"""
    if not os.path.exists(db_path):
        from create_database import create_database
        create_database(db_path)
    return db_path

def save_raw_positions_to_db(positions, db_path="birdy_flights.db"):
    """Save raw position data to the temporary table for later processing"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    insert_query = '''
        INSERT INTO raw_positions (
            icao24, callsign, origin_country, time_position, last_contact,
            longitude, latitude, baro_altitude, on_ground, velocity,
            true_track, vertical_rate, sensors, geo_altitude, squawk,
            spi, position_source, category, collection_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''
    
    position_records = []
    for pos in positions:
        position_records.append((
            pos["icao24"],
            pos["callsign"],
            pos["origin_country"],
            pos["time_position"],
            pos["last_contact"],
            pos["longitude"],
            pos["latitude"],
            pos["baro_altitude"],
            pos["on_ground"],
            pos["velocity"],
            pos["true_track"],
            pos["vertical_rate"],
            pos["sensors"],
            pos["geo_altitude"],
            pos["squawk"],
            pos["spi"],
            pos["position_source"],
            pos["category"],
            pos["collection_time"]
        ))
    
    cursor.executemany(insert_query, position_records)
    conn.commit()
    
    rows_inserted = cursor.rowcount
    conn.close()
    
    return rows_inserted

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    if None in [lat1, lon1, lat2, lon2]:
        return None
    
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371  # Earth's radius in kilometers
    
    return c * r

def process_flight_from_positions(positions, icao24, callsign, origin_country, flight_date):
    """Process a group of positions into a flight record"""
    if len(positions) < 2:
        return None
    
    # Sort positions by time
    positions.sort(key=lambda x: x['collection_time'])
    
    first_pos = positions[0]
    last_pos = positions[-1]
    
    # Parse timestamps
    departure_time = datetime.fromisoformat(first_pos['collection_time'])
    arrival_time = datetime.fromisoformat(last_pos['collection_time'])
    duration_minutes = int((arrival_time - departure_time).total_seconds() / 60)
    
    # Determine flight status
    start_status = 'ground' if first_pos.get('on_ground') else 'airborne'
    end_status = 'ground' if last_pos.get('on_ground') else 'airborne'
    
    # Determine overall flight status
    if start_status == 'ground' and end_status == 'ground':
        flight_status = 'complete'
    elif start_status == 'airborne' and end_status == 'airborne':
        flight_status = 'partial'
    else:
        flight_status = 'complete'
    
    # Calculate statistics
    altitudes = [pos['baro_altitude'] for pos in positions if pos.get('baro_altitude') is not None]
    velocities = [pos['velocity'] for pos in positions if pos.get('velocity') is not None]
    
    max_altitude = max(altitudes) if altitudes else None
    max_velocity = max(velocities) if velocities else None
    
    # Calculate total distance
    total_distance = 0
    for i in range(1, len(positions)):
        prev_pos = positions[i-1]
        curr_pos = positions[i]
        
        if all(k in prev_pos and k in curr_pos and prev_pos[k] is not None and curr_pos[k] is not None 
               for k in ['latitude', 'longitude']):
            dist = calculate_distance(
                prev_pos['latitude'], prev_pos['longitude'],
                curr_pos['latitude'], curr_pos['longitude']
            )
            if dist:
                total_distance += dist
    
    # Create compressed position array (only store changing values)
    position_array = []
    for pos in positions:
        position_data = {
            'ts': pos['collection_time'],
            'lon': pos.get('longitude'),
            'lat': pos.get('latitude'),
            'alt': pos.get('baro_altitude'),
            'vel': pos.get('velocity'),
            'trk': pos.get('true_track'),
            'vrt': pos.get('vertical_rate'),
            'gnd': pos.get('on_ground')
        }
        # Remove null values to save space
        position_data = {k: v for k, v in position_data.items() if v is not None}
        position_array.append(position_data)
    
    flight_record = {
        'icao24': icao24,
        'callsign': callsign,
        'origin_country': origin_country,
        'flight_date': flight_date,
        'departure_time': departure_time.isoformat(),
        'arrival_time': arrival_time.isoformat(),
        'duration_minutes': duration_minutes,
        'start_status': start_status,
        'end_status': end_status,
        'flight_status': flight_status,
        'max_altitude': max_altitude,
        'max_velocity': max_velocity,
        'distance_km': total_distance if total_distance > 0 else None,
        'position_count': len(position_array),
        'positions': json.dumps(position_array)
    }
    
    return flight_record

def process_raw_positions_into_flights(db_path="birdy_flights.db", max_gap_hours=4):
    """Process raw positions into flight journeys and delete processed raw data"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get unprocessed positions grouped by aircraft and callsign
    cursor.execute('''
        SELECT icao24, callsign, origin_country, DATE(collection_time) as flight_date
        FROM raw_positions 
        WHERE processed = FALSE 
          AND callsign IS NOT NULL 
          AND callsign != ''
          AND longitude IS NOT NULL 
          AND latitude IS NOT NULL
        GROUP BY icao24, callsign, DATE(collection_time)
        ORDER BY icao24, callsign, flight_date
    ''')
    
    flight_groups = cursor.fetchall()
    print(f"Found {len(flight_groups)} potential flight groups to process")
    
    flights_created = 0
    raw_positions_deleted = 0
    single_positions_kept = 0
    
    for group in flight_groups:
        icao24, callsign, origin_country, flight_date = group
        
        # Get all positions for this flight group, ordered by time
        cursor.execute('''
            SELECT *
            FROM raw_positions 
            WHERE icao24 = ? AND callsign = ? AND DATE(collection_time) = ?
              AND processed = FALSE
              AND longitude IS NOT NULL AND latitude IS NOT NULL
            ORDER BY collection_time ASC
        ''', (icao24, callsign, flight_date))
        
        raw_positions = cursor.fetchall()
        
        if len(raw_positions) < 2:
            # Keep single positions for future processing (don't delete on fresh start)
            single_positions_kept += len(raw_positions)
            continue
        
        # Convert to dictionaries for easier handling
        columns = [desc[0] for desc in cursor.description]
        positions = []
        position_ids = []
        
        for row in raw_positions:
            pos_dict = dict(zip(columns, row))
            positions.append(pos_dict)
            position_ids.append(pos_dict['id'])
        
        # Split positions into separate flights if there are large time gaps
        flight_segments = []
        current_segment = [positions[0]]
        
        for i in range(1, len(positions)):
            prev_time = datetime.fromisoformat(positions[i-1]['collection_time'])
            curr_time = datetime.fromisoformat(positions[i]['collection_time'])
            time_gap = (curr_time - prev_time).total_seconds() / 3600  # hours
            
            if time_gap > max_gap_hours:
                # Start new flight segment
                if len(current_segment) >= 2:
                    flight_segments.append(current_segment)
                current_segment = [positions[i]]
            else:
                current_segment.append(positions[i])
        
        # Add the last segment
        if len(current_segment) >= 2:
            flight_segments.append(current_segment)
        
        # Process each flight segment
        for segment in flight_segments:
            flight_record = process_flight_from_positions(
                segment, icao24, callsign, origin_country, flight_date
            )
            
            if flight_record:
                # Insert flight record
                cursor.execute('''
                    INSERT INTO flights (
                        icao24, callsign, origin_country, collection_time,
                        flight_date, departure_time, arrival_time, duration_minutes,
                        start_status, end_status, flight_status,
                        max_altitude, max_velocity, distance_km,
                        position_count, positions
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    flight_record['icao24'], flight_record['callsign'], 
                    flight_record['origin_country'], flight_record['departure_time'],
                    flight_record['flight_date'], flight_record['departure_time'], 
                    flight_record['arrival_time'], flight_record['duration_minutes'], 
                    flight_record['start_status'], flight_record['end_status'], 
                    flight_record['flight_status'], flight_record['max_altitude'], 
                    flight_record['max_velocity'], flight_record['distance_km'], 
                    flight_record['position_count'], flight_record['positions']
                ))
                
                flights_created += 1
        
        # Delete processed raw positions (now that they're converted to flights)
        cursor.executemany(
            'DELETE FROM raw_positions WHERE id = ?', 
            [(pos_id,) for pos_id in position_ids]
        )
        raw_positions_deleted += len(position_ids)
        
    
    conn.commit()
    conn.close()
    
    print(f"Successfully created {flights_created} flight journeys from raw positions")
    if raw_positions_deleted > 0:
        print(f"Deleted {raw_positions_deleted} raw position records (temporary data cleanup)")
    if single_positions_kept > 0:
        print(f"Kept {single_positions_kept} single positions for future processing")
    return flights_created

def fetch_adsb_data(process_immediately=True):
    """Fetch ADS-B data and optionally process into flights immediately"""
    # Initialize database
    db_path = init_database()
    
    url = "https://opensky-network.org/api/states/all"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        print("Fetching ADS-B data from OpenSky Network...")
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

    positions = []
    states = data.get("states", [])
    print(f"Found {len(states)} aircraft states")
    collection_timestamp = datetime.now(timezone.utc).isoformat()
    
    for state in states:
        if len(state) >= 10 and state[1] and state[5] and state[6]:  # Must have callsign, lon, lat
            
            position = {
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
                "collection_time": collection_timestamp
            }
            
            positions.append(position)

    if positions:
        rows_inserted = save_raw_positions_to_db(positions, db_path)
        print(f"Saved {rows_inserted} raw positions to database")
        
        if process_immediately:
            print("Processing raw positions into flights...")
            flights_created = process_raw_positions_into_flights(db_path)
            print(f"Created {flights_created} new flight journeys")
        
        # Show database stats
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT COUNT(*) FROM raw_positions")
            total_positions = cursor.fetchone()[0]
        except sqlite3.OperationalError:
            total_positions = 0
        
        cursor.execute("SELECT COUNT(*) FROM flights")
        total_flights = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT icao24) FROM flights")
        unique_aircraft = cursor.fetchone()[0]
        
        conn.close()
        
        print(f"\nDatabase Statistics:")
        print(f"  Total raw positions: {total_positions:,}")
        print(f"  Total flight journeys: {total_flights:,}")
        print(f"  Unique aircraft tracked: {unique_aircraft:,}")
    else:
        print("No valid positions found")

def continuous_collection(interval_minutes=5):
    """Run continuous data collection"""
    print(f"Starting continuous ADS-B data collection (every {interval_minutes} minutes)")
    print("Press Ctrl+C to stop")
    
    try:
        while True:
            print(f"\n--- Collection at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---")
            fetch_adsb_data(process_immediately=True)
            
            print(f"Waiting {interval_minutes} minutes until next collection...")
            time.sleep(interval_minutes * 60)
            
    except KeyboardInterrupt:
        print("\nCollection stopped by user")

# Legacy function for backward compatibility
def save_flights_to_db(flights, db_path="birdy_flights.db"):
    """Legacy function - now redirects to raw_positions"""
    return save_raw_positions_to_db(flights, db_path)

if __name__ == "__main__":
    # Single collection run
    fetch_adsb_data()
    
    # Uncomment for continuous collection
    # continuous_collection(interval_minutes=5)