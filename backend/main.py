from flask import Flask, request, jsonify
import openmeteo_requests
import requests_cache
from retry_requests import retry
import pandas as pd

app = Flask(__name__)

# Setup the Open-Meteo API client with cache and retry
cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

# WMO Weather interpretation codes
WMO_WEATHER_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    56: "Light freezing drizzle", 57: "Dense freezing drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Light freezing rain", 67: "Heavy freezing rain",
    71: "Slight snow fall", 73: "Moderate snow fall", 75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm: Slight or moderate",
    96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
    # Add more codes as needed from Open-Meteo documentation
}

def get_weather_description(code):
    return WMO_WEATHER_CODES.get(int(code), f"Unknown weather code ({code})")

@app.route('/weather', methods=['GET'])
def get_weather_data():
    try:
        latitude = float(request.args.get('latitude'))
        longitude = float(request.args.get('longitude'))
    except (TypeError, ValueError): # Handles missing or non-float parameters
        return jsonify({"error": "Missing or invalid 'latitude' and 'longitude' query parameters. Both must be numbers."}), 400

    # Open-Meteo API parameters
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": ["temperature_2m", "relative_humidity_2m", "weather_code", "wind_speed_10m", "apparent_temperature"],
        "hourly": ["temperature_2m", "relative_humidity_2m", "weather_code", "wind_speed_10m", "apparent_temperature"],
        "timezone": "auto",
        "forecast_days": 1 
    }
    
    url = "https://api.open-meteo.com/v1/forecast"

    try:
        responses = openmeteo.weather_api(url, params=params)
        response = responses[0] # Process first location (we only request one)

        # Current weather data
        current = response.Current()
        current_weather = {
            "time": pd.to_datetime(current.Time(), unit="s", utc=True).isoformat(),
            "temperature": current.Variables(0).Value(),            # temperature_2m
            "relative_humidity": current.Variables(1).Value(),      # relative_humidity_2m
            "weather_code": int(current.Variables(2).Value()),
            "weather_description": get_weather_description(current.Variables(2).Value()),
            "wind_speed": current.Variables(3).Value(),             # wind_speed_10m
            "apparent_temperature": current.Variables(4).Value()    # apparent_temperature
        }

        # Hourly forecast data
        hourly = response.Hourly()
        hourly_data = {
            "time": pd.to_datetime(hourly.Variables(0).ValuesAsNumpy(), unit="s", utc=True).tolist(), # All times for hourly vars are the same
            "temperature_2m": hourly.Variables(0).ValuesAsNumpy().tolist(),
            "relative_humidity_2m": hourly.Variables(1).ValuesAsNumpy().tolist(),
            "weather_code": hourly.Variables(2).ValuesAsNumpy().tolist(),
            "wind_speed_10m": hourly.Variables(3).ValuesAsNumpy().tolist(),
            "apparent_temperature": hourly.Variables(4).ValuesAsNumpy().tolist()
        }
        
        forecast_list = []
        # The number of hourly data points is determined by the length of the time array
        num_hours = len(hourly_data["time"]) if hourly_data["time"] else 0
        
        for i in range(min(num_hours, 24)): # Ensure we don't exceed available data or 24 hours
            forecast_list.append({
                "time": hourly_data["time"][i].isoformat(),
                "temperature": round(hourly_data["temperature_2m"][i], 2),
                "relative_humidity": round(hourly_data["relative_humidity_2m"][i], 2),
                "weather_code": int(hourly_data["weather_code"][i]),
                "weather_description": get_weather_description(hourly_data["weather_code"][i]),
                "wind_speed": round(hourly_data["wind_speed_10m"][i], 2),
                "apparent_temperature": round(hourly_data["apparent_temperature"][i], 2)
            })

        return jsonify({
            "current_weather": current_weather,
            "forecast": forecast_list
        }), 200

    except openmeteo_requests.ApiError as e:
        return jsonify({"error": f"Open-Meteo API Error: {e.message}"}), 500
    except Exception as e:
        # Log the exception for debugging
        app.logger.error(f"An unexpected error occurred: {e}", exc_info=True)
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    # For local testing. When deployed as a Cloud Function, Gunicorn or similar serves the app.
    # The Cloud Function environment will set the PORT environment variable.
    port = int(os.environ.get('PORT', 8080)) if 'os' in globals() else 8080 # Check if os was imported
    app.run(debug=True, host='0.0.0.0', port=port)
