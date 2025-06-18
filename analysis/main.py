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

# Usage example
print_icao24_stats()
