# enhanced_collector.py
import requests
import pandas as pd
from datetime import datetime
import time

def fetch_adsb_data():
    """Basic ADS-B data collection without derived fields"""
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
        df = pd.DataFrame(flights)
        filename = f"flights_{collection_timestamp.strftime('%Y%m%d_%H%M%S')}.csv"
        df.to_csv(filename, index=False)
        print(f"Saved {len(flights)} flights to {filename}")
    else:
        print("No flights found")

if __name__ == "__main__":
    fetch_adsb_data()