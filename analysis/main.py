import sqlite3
import json
import folium
import random
from datetime import datetime

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

def create_longest_flight_map(db_path="birdy_flights.db"):
    """Find the longest flight and create a map showing its path"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Find the longest flight by distance
    cursor.execute("""
        SELECT icao24, callsign, distance_km, duration_minutes, max_altitude, 
               departure_time, arrival_time, positions
        FROM flights
        WHERE distance_km IS NOT NULL
        ORDER BY distance_km DESC
        LIMIT 1;
    """)
    
    longest_flight = cursor.fetchone()
    
    if not longest_flight:
        print("No flights with distance data found in database.")
        conn.close()
        return
    
    icao24, callsign, distance_km, duration_minutes, max_altitude, departure_time, arrival_time, positions_json = longest_flight
    
    # Parse positions
    try:
        positions = json.loads(positions_json)
    except json.JSONDecodeError:
        print("Error parsing position data")
        conn.close()
        return
    
    # Filter positions with valid coordinates
    valid_positions = []
    for pos in positions:
        if pos.get('lat') is not None and pos.get('lon') is not None:
            valid_positions.append(pos)
    
    if len(valid_positions) < 2:
        print("Not enough valid position data for mapping")
        conn.close()
        return
    
    print(f"\n{'='*80}")
    print(f"LONGEST FLIGHT VISUALIZATION")
    print(f"{'='*80}")
    print(f"Aircraft: {icao24}")
    print(f"Callsign: {callsign}")
    print(f"Distance: {distance_km:.1f} km")
    print(f"Duration: {duration_minutes} minutes ({duration_minutes/60:.1f} hours)")
    print(f"Max Altitude: {max_altitude:.0f}m" if max_altitude else "Max Altitude: N/A")
    print(f"Departure: {departure_time}")
    print(f"Arrival: {arrival_time}")
    print(f"Position Points: {len(valid_positions)}")
    
    # Create map centered on flight path
    center_lat = sum(pos['lat'] for pos in valid_positions) / len(valid_positions)
    center_lon = sum(pos['lon'] for pos in valid_positions) / len(valid_positions)
    
    # Create the map
    flight_map = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=6,
        tiles='OpenStreetMap'
    )
    
    # Extract coordinates for the flight path
    flight_coords = [[pos['lat'], pos['lon']] for pos in valid_positions]
    
    # Add flight path as a polyline
    folium.PolyLine(
        locations=flight_coords,
        color='red',
        weight=3,
        opacity=0.8,
        popup=f"Flight {callsign} ({icao24})"
    ).add_to(flight_map)
    
    # Add markers for departure and arrival
    start_pos = valid_positions[0]
    end_pos = valid_positions[-1]
    
    # Departure marker (green)
    folium.Marker(
        location=[start_pos['lat'], start_pos['lon']],
        popup=f"Departure: {callsign}<br>Time: {start_pos.get('ts', 'N/A')}<br>Altitude: {start_pos.get('alt', 'N/A')}m",
        icon=folium.Icon(color='green', icon='play')
    ).add_to(flight_map)
    
    # Arrival marker (red)
    folium.Marker(
        location=[end_pos['lat'], end_pos['lon']],
        popup=f"Arrival: {callsign}<br>Time: {end_pos.get('ts', 'N/A')}<br>Altitude: {end_pos.get('alt', 'N/A')}m",
        icon=folium.Icon(color='red', icon='stop')
    ).add_to(flight_map)
    
    # Add altitude markers at regular intervals
    step = max(1, len(valid_positions) // 10)  # Show ~10 altitude markers
    for i in range(0, len(valid_positions), step):
        pos = valid_positions[i]
        if pos.get('alt') is not None:
            folium.CircleMarker(
                location=[pos['lat'], pos['lon']],
                radius=3,
                popup=f"Altitude: {pos['alt']:.0f}m<br>Time: {pos.get('ts', 'N/A')}",
                color='blue',
                fill=True,
                opacity=0.6
            ).add_to(flight_map)
    
    # Save the map
    map_filename = f"longest_flight_{icao24}_{callsign.replace(' ', '_')}.html"
    flight_map.save(map_filename)
    
    print(f"\n✅ Flight map saved as: {map_filename}")
    print(f"Open this file in your web browser to view the interactive map")
    
    # Print some interesting statistics about the flight path
    print(f"\nFlight Path Analysis:")
    altitudes = [pos['alt'] for pos in valid_positions if pos.get('alt') is not None]
    if altitudes:
        print(f"  Min altitude: {min(altitudes):.0f}m")
        print(f"  Max altitude: {max(altitudes):.0f}m")
        print(f"  Avg altitude: {sum(altitudes)/len(altitudes):.0f}m")
    
    velocities = [pos['vel'] for pos in valid_positions if pos.get('vel') is not None]
    if velocities:
        print(f"  Min velocity: {min(velocities):.1f} m/s")
        print(f"  Max velocity: {max(velocities):.1f} m/s")
        print(f"  Avg velocity: {sum(velocities)/len(velocities):.1f} m/s")
    
    conn.close()

def create_random_flight_map(db_path="birdy_flights.db"):
    """Find a random flight and create a map showing its path"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all flights with distance data
    cursor.execute("""
        SELECT icao24, callsign, distance_km, duration_minutes, max_altitude, 
               departure_time, arrival_time, positions
        FROM flights
        WHERE distance_km IS NOT NULL AND distance_km > 10
        ORDER BY RANDOM()
        LIMIT 1;
    """)
    
    random_flight = cursor.fetchone()
    
    if not random_flight:
        print("No flights with distance data found in database.")
        conn.close()
        return
    
    icao24, callsign, distance_km, duration_minutes, max_altitude, departure_time, arrival_time, positions_json = random_flight
    
    # Parse positions
    try:
        positions = json.loads(positions_json)
    except json.JSONDecodeError:
        print("Error parsing position data")
        conn.close()
        return
    
    # Filter positions with valid coordinates
    valid_positions = []
    for pos in positions:
        if pos.get('lat') is not None and pos.get('lon') is not None:
            valid_positions.append(pos)
    
    if len(valid_positions) < 2:
        print("Not enough valid position data for mapping")
        conn.close()
        return
    
    print(f"\n{'='*80}")
    print(f"RANDOM FLIGHT VISUALIZATION")
    print(f"{'='*80}")
    print(f"Aircraft: {icao24}")
    print(f"Callsign: {callsign}")
    print(f"Distance: {distance_km:.1f} km")
    print(f"Duration: {duration_minutes} minutes ({duration_minutes/60:.1f} hours)")
    print(f"Max Altitude: {max_altitude:.0f}m" if max_altitude else "Max Altitude: N/A")
    print(f"Departure: {departure_time}")
    print(f"Arrival: {arrival_time}")
    print(f"Position Points: {len(valid_positions)}")
    
    # Create map centered on flight path
    center_lat = sum(pos['lat'] for pos in valid_positions) / len(valid_positions)
    center_lon = sum(pos['lon'] for pos in valid_positions) / len(valid_positions)
    
    # Create the map
    flight_map = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=6,
        tiles='OpenStreetMap'
    )
    
    # Extract coordinates for the flight path
    flight_coords = [[pos['lat'], pos['lon']] for pos in valid_positions]
    
    # Add flight path as a polyline
    folium.PolyLine(
        locations=flight_coords,
        color='red',
        weight=3,
        opacity=0.8,
        popup=f"Flight {callsign} ({icao24})"
    ).add_to(flight_map)
    
    # Add markers for departure and arrival
    start_pos = valid_positions[0]
    end_pos = valid_positions[-1]
    
    # Departure marker (green)
    folium.Marker(
        location=[start_pos['lat'], start_pos['lon']],
        popup=f"Departure: {callsign}<br>Time: {start_pos.get('ts', 'N/A')}<br>Altitude: {start_pos.get('alt', 'N/A')}m",
        icon=folium.Icon(color='green', icon='play')
    ).add_to(flight_map)
    
    # Arrival marker (red)
    folium.Marker(
        location=[end_pos['lat'], end_pos['lon']],
        popup=f"Arrival: {callsign}<br>Time: {end_pos.get('ts', 'N/A')}<br>Altitude: {end_pos.get('alt', 'N/A')}m",
        icon=folium.Icon(color='red', icon='stop')
    ).add_to(flight_map)
    
    # Add altitude markers at regular intervals
    step = max(1, len(valid_positions) // 10)  # Show ~10 altitude markers
    for i in range(0, len(valid_positions), step):
        pos = valid_positions[i]
        if pos.get('alt') is not None:
            folium.CircleMarker(
                location=[pos['lat'], pos['lon']],
                radius=3,
                popup=f"Altitude: {pos['alt']:.0f}m<br>Time: {pos.get('ts', 'N/A')}",
                color='blue',
                fill=True,
                opacity=0.6
            ).add_to(flight_map)
    
    # Save the map
    map_filename = f"random_flight_{icao24}_{callsign.replace(' ', '_')}.html"
    flight_map.save(map_filename)
    
    print(f"\n✅ Flight map saved as: {map_filename}")
    print(f"Open this file in your web browser to view the interactive map")
    
    # Print some interesting statistics about the flight path
    print(f"\nFlight Path Analysis:")
    altitudes = [pos['alt'] for pos in valid_positions if pos.get('alt') is not None]
    if altitudes:
        print(f"  Min altitude: {min(altitudes):.0f}m")
        print(f"  Max altitude: {max(altitudes):.0f}m")
        print(f"  Avg altitude: {sum(altitudes)/len(altitudes):.0f}m")
    
    velocities = [pos['vel'] for pos in valid_positions if pos.get('vel') is not None]
    if velocities:
        print(f"  Min velocity: {min(velocities):.1f} m/s")
        print(f"  Max velocity: {max(velocities):.1f} m/s")
        print(f"  Avg velocity: {sum(velocities)/len(velocities):.1f} m/s")
    
    conn.close()

def create_most_datapoints_flight_map(db_path="birdy_flights.db"):
    """Find the flight with the most data points and create a map showing its path"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Find the flight with the most position data points
    cursor.execute("""
        SELECT icao24, callsign, distance_km, duration_minutes, max_altitude, 
               departure_time, arrival_time, positions,
               LENGTH(positions) - LENGTH(REPLACE(positions, '},{', '')) as datapoint_count
        FROM flights
        WHERE positions IS NOT NULL AND positions != '[]'
        ORDER BY datapoint_count DESC
        LIMIT 1;
    """)
    
    most_datapoints_flight = cursor.fetchone()
    
    if not most_datapoints_flight:
        print("No flights with position data found in database.")
        conn.close()
        return
    
    icao24, callsign, distance_km, duration_minutes, max_altitude, departure_time, arrival_time, positions_json, datapoint_count = most_datapoints_flight
    
    # Parse positions
    try:
        positions = json.loads(positions_json)
    except json.JSONDecodeError:
        print("Error parsing position data")
        conn.close()
        return
    
    # Filter positions with valid coordinates
    valid_positions = []
    for pos in positions:
        if pos.get('lat') is not None and pos.get('lon') is not None:
            valid_positions.append(pos)
    
    if len(valid_positions) < 2:
        print("Not enough valid position data for mapping")
        conn.close()
        return
    
    print(f"\n{'='*80}")
    print(f"MOST DATA POINTS FLIGHT VISUALIZATION")
    print(f"{'='*80}")
    print(f"Aircraft: {icao24}")
    print(f"Callsign: {callsign}")
    print(f"Distance: {distance_km:.1f} km" if distance_km else "Distance: N/A")
    print(f"Duration: {duration_minutes} minutes ({duration_minutes/60:.1f} hours)" if duration_minutes else "Duration: N/A")
    print(f"Max Altitude: {max_altitude:.0f}m" if max_altitude else "Max Altitude: N/A")
    print(f"Departure: {departure_time}")
    print(f"Arrival: {arrival_time}")
    print(f"Position Points: {len(valid_positions)}")
    
    # Create map centered on flight path
    center_lat = sum(pos['lat'] for pos in valid_positions) / len(valid_positions)
    center_lon = sum(pos['lon'] for pos in valid_positions) / len(valid_positions)
    
    # Create the map
    flight_map = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=6,
        tiles='OpenStreetMap'
    )
    
    # Extract coordinates for the flight path
    flight_coords = [[pos['lat'], pos['lon']] for pos in valid_positions]
    
    # Add flight path as a polyline
    folium.PolyLine(
        locations=flight_coords,
        color='purple',
        weight=2,
        opacity=0.8,
        popup=f"Flight {callsign} ({icao24}) - {len(valid_positions)} data points"
    ).add_to(flight_map)
    
    # Add markers for departure and arrival
    start_pos = valid_positions[0]
    end_pos = valid_positions[-1]
    
    # Departure marker (green)
    folium.Marker(
        location=[start_pos['lat'], start_pos['lon']],
        popup=f"Departure: {callsign}<br>Time: {start_pos.get('ts', 'N/A')}<br>Altitude: {start_pos.get('alt', 'N/A')}m",
        icon=folium.Icon(color='green', icon='play')
    ).add_to(flight_map)
    
    # Arrival marker (red)
    folium.Marker(
        location=[end_pos['lat'], end_pos['lon']],
        popup=f"Arrival: {callsign}<br>Time: {end_pos.get('ts', 'N/A')}<br>Altitude: {end_pos.get('alt', 'N/A')}m",
        icon=folium.Icon(color='red', icon='stop')
    ).add_to(flight_map)
    
    # Add more altitude markers since we have more data points
    step = max(1, len(valid_positions) // 20)  # Show ~20 altitude markers for detailed tracking
    for i in range(0, len(valid_positions), step):
        pos = valid_positions[i]
        if pos.get('alt') is not None:
            folium.CircleMarker(
                location=[pos['lat'], pos['lon']],
                radius=2,
                popup=f"Point {i+1}/{len(valid_positions)}<br>Altitude: {pos['alt']:.0f}m<br>Time: {pos.get('ts', 'N/A')}",
                color='purple',
                fill=True,
                opacity=0.7
            ).add_to(flight_map)
    
    # Save the map
    map_filename = f"most_datapoints_flight_{icao24}_{callsign.replace(' ', '_')}.html"
    flight_map.save(map_filename)
    
    print(f"\n✅ Flight map saved as: {map_filename}")
    print(f"Open this file in your web browser to view the interactive map")
    
    # Print detailed statistics about the flight path
    print(f"\nDetailed Flight Path Analysis:")
    altitudes = [pos['alt'] for pos in valid_positions if pos.get('alt') is not None]
    if altitudes:
        print(f"  Min altitude: {min(altitudes):.0f}m")
        print(f"  Max altitude: {max(altitudes):.0f}m")
        print(f"  Avg altitude: {sum(altitudes)/len(altitudes):.0f}m")
        print(f"  Altitude data points: {len(altitudes)}")
    
    velocities = [pos['vel'] for pos in valid_positions if pos.get('vel') is not None]
    if velocities:
        print(f"  Min velocity: {min(velocities):.1f} m/s")
        print(f"  Max velocity: {max(velocities):.1f} m/s")
        print(f"  Avg velocity: {sum(velocities)/len(velocities):.1f} m/s")
        print(f"  Velocity data points: {len(velocities)}")
    
    # Calculate data collection frequency
    timestamps = [pos.get('ts') for pos in valid_positions if pos.get('ts') is not None]
    if len(timestamps) > 1:
        # Convert timestamps to datetime objects for calculation
        try:
            datetime_objects = [datetime.fromisoformat(ts.replace('Z', '+00:00')) if 'T' in ts else datetime.strptime(ts, '%Y-%m-%d %H:%M:%S') for ts in timestamps[:10]]  # Sample first 10
            if len(datetime_objects) > 1:
                time_diffs = [(datetime_objects[i+1] - datetime_objects[i]).total_seconds() for i in range(len(datetime_objects)-1)]
                avg_interval = sum(time_diffs) / len(time_diffs)
                print(f"  Avg data collection interval: {avg_interval:.1f} seconds")
        except:
            print(f"  Data collection interval: Unable to calculate")
    
    conn.close()

# Usage example
#print_icao24_stats()
#print_ground_to_flight_journey()
#create_longest_flight_map()
create_random_flight_map()
#create_most_datapoints_flight_map()
