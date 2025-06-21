import sqlite3

def print_icao24_stats(db_path="birdy_flights.db"):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Most common ICAO24 and its count
    cursor.execute("""
        SELECT icao24, COUNT(*) AS count
        FROM flights
        GROUP BY icao24
        ORDER BY count DESC
        LIMIT 1;
    """)
    most_common = cursor.fetchone()
    
    # Total number of entries
    cursor.execute("SELECT COUNT(*) FROM flights")
    total_entries = cursor.fetchone()[0]
    
    # Total number of unique ICAO24
    cursor.execute("SELECT COUNT(DISTINCT icao24) FROM flights")
    unique_icao24 = cursor.fetchone()[0]
    
    conn.close()
    
    if most_common:
        icao24, count = most_common
        print(f"Most common ICAO24: {icao24} with {count} entries")
    else:
        print("No flights found in database.")
    
    print(f"Total number of flight entries: {total_entries}")
    print(f"Total number of unique ICAO24 identifiers: {unique_icao24}")

def print_ground_to_flight_journey(db_path="birdy_flights.db"):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Find aircraft that start on ground and have subsequent flight data
    cursor.execute("""
        SELECT DISTINCT icao24
        FROM flights
        WHERE on_ground = 1 OR baro_altitude < 100
        ORDER BY icao24;
    """)
    
    ground_aircraft = cursor.fetchall()
    
    for aircraft in ground_aircraft:
        icao24 = aircraft[0]
        
        # Get chronological journey for this aircraft
        cursor.execute("""
            SELECT icao24, callsign, collection_time, baro_altitude, on_ground, latitude, longitude, velocity
            FROM flights
            WHERE icao24 = ?
            ORDER BY collection_time ASC;
        """, (icao24,))
        
        journey = cursor.fetchall()
        
        if journey:
            # Check if first entry is on ground
            first_flight = journey[0]
            if first_flight[4] == 1 or (first_flight[3] is not None and first_flight[3] < 100):  # on_ground or low altitude
                
                callsign = first_flight[1] if first_flight[1] else "Unknown"
                print(f"\n{'='*60}")
                print(f"Aircraft: {icao24} | Callsign: {callsign}")
                print(f"Ground-to-Flight Journey:")
                print(f"{'='*60}")
                
                for i, flight in enumerate(journey):
                    _, _, time, altitude, on_ground, lat, lon, velocity = flight
                    
                    status = "ON GROUND" if on_ground else f"AIRBORNE ({altitude}m)" if altitude else "AIRBORNE (alt unknown)"
                    velocity_str = f"{velocity} m/s" if velocity else "N/A"
                    
                    print(f"{i+1:2d}. {time} | {status}")
                    print(f"    Position: ({lat:.4f}, {lon:.4f}) | Velocity: {velocity_str}")
                    
                    # Stop printing once aircraft is clearly airborne
                    if not on_ground and altitude and altitude > 500:
                        print(f"    >>> Aircraft is now airborne at {altitude}m altitude")
                        break
                
                # Only show first aircraft to avoid overwhelming output
                break
    
    conn.close()

# Usage example
print_icao24_stats()
print_ground_to_flight_journey()
