document.addEventListener('DOMContentLoaded', () => {
    const locationInput = document.getElementById('location-input');
    const searchButton = document.getElementById('search-button');
    const useLocationButton = document.getElementById('use-location-button');
    const currentWeatherContainer = document.getElementById('current-weather-data');
    const forecastContainer = document.getElementById('forecast-data');

    const WEATHER_API_URL = '/weather'; // Relative URL for the backend weather endpoint
    const GEOCODING_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';

    // Polling variables
    const POLLING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    let pollingTimerId = null;
    // lastLocationQuery will store an object: { latitude, longitude, locationName }
    let lastLocationQuery = null; 

    const displayError = (element, message) => {
        element.innerHTML = `<p class="error-message" style="color: red;">${message}</p>`;
    };

    // Updated to accept an optional locationName
    const displayCurrentWeather = (data, locationName = "Weather Data") => {
        currentWeatherContainer.innerHTML = ''; 
        if (!data || !data.time) { // Open-Meteo current data has a 'time' field
            displayError(currentWeatherContainer, 'Could not retrieve current weather data or data is incomplete.');
            return;
        }
        // Open-Meteo uses WMO codes, and description is already provided by our backend
        const iconCode = data.weather_code; // Assuming backend provides a representative icon code or we map it
        const weatherDescription = data.weather_description;
        // For Open-Meteo, icons need separate mapping if we want them. For now, text.
        // const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`; // This is OpenWeatherMap specific

        const lastUpdatedTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const weatherHTML = `
            <h3>${locationName}</h3>
            <!-- <img src="${iconUrl}" alt="${weatherDescription}" class="weather-icon"> TODO: Implement icon mapping for WMO codes if desired -->
            <p>Weather: ${weatherDescription} (Code: ${iconCode})</p>
            <p>Temperature: ${data.temperature}°C (Feels like: ${data.apparent_temperature}°C)</p>
            <p>Humidity: ${data.relative_humidity}%</p>
            <p>Wind: ${data.wind_speed} m/s</p> 
            <p><small>Last updated: ${lastUpdatedTimestamp}</small></p>
            <p><small>Time of data: ${new Date(data.time).toLocaleString()}</small></p>
        `;
        currentWeatherContainer.innerHTML = weatherHTML;
    };

    const displayForecast = (dataList) => {
        forecastContainer.innerHTML = ''; 
        if (!dataList || dataList.length === 0) {
            displayError(forecastContainer, 'Could not retrieve forecast data.');
            return;
        }

        dataList.forEach(item => {
            const date = new Date(item.time); // Open-Meteo provides ISO8601 time
            // const iconCode = item.weather_code; // Similar to current weather, icon mapping needed for WMO
            const weatherDescription = item.weather_description;

            const forecastItemHTML = `
                <div class="forecast-item">
                    <h4>${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${date.toLocaleDateString([], {weekday: 'short'})})</h4>
                    <!-- <img src="ICON_URL_HERE" alt="${weatherDescription}" class="weather-icon"> TODO: Icon mapping -->
                    <p>${weatherDescription}</p>
                    <p>Temp: ${item.temperature}°C (Feels like: ${item.apparent_temperature}°C)</p>
                    <p>Humidity: ${item.relative_humidity}%</p>
                    <p>Wind: ${item.wind_speed} m/s</p>
                </div>
            `;
            forecastContainer.innerHTML += forecastItemHTML;
        });
    };
    
    const pollWeather = () => {
        if (lastLocationQuery && typeof lastLocationQuery === 'object' && lastLocationQuery.latitude && lastLocationQuery.longitude) {
            console.log(`Polling for weather update: ${lastLocationQuery.locationName || 'coordinates'} at ${new Date().toLocaleTimeString()}`);
            fetchWeatherData(lastLocationQuery.latitude, lastLocationQuery.longitude, lastLocationQuery.locationName, true);
        } else {
            console.log("Polling stopped: lastLocationQuery is not set or invalid.");
            clearTimeout(pollingTimerId); // Ensure timer is cleared if query is invalid
        }
    };

    // Updated to accept latitude, longitude, optional locationName, and isPoll flag
    const fetchWeatherData = async (latitude, longitude, locationName = "Selected Location", isPoll = false) => {
        if (!isPoll) {
            currentWeatherContainer.innerHTML = `<p>Loading weather for ${locationName}...</p>`;
            forecastContainer.innerHTML = '<p>Loading forecast...</p>';
        } else {
            console.log(`Background fetching weather for ${locationName}`);
        }
        
        const locationQuery = `latitude=${latitude}&longitude=${longitude}`;
        const url = `${WEATHER_API_URL}?${locationQuery}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                let errorMessage = `Error fetching weather data: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) { /* Ignore if error response is not JSON */ }
                
                if (!isPoll) {
                    displayError(currentWeatherContainer, `Current weather: ${errorMessage}`);
                    displayError(forecastContainer, `Forecast: ${errorMessage}`);
                } else {
                    console.error(`Polling error for ${locationName}: ${errorMessage}`);
                }
                clearTimeout(pollingTimerId); 
                return;
            }
            const data = await response.json();

            if (data.error) {
                if (!isPoll) {
                    displayError(currentWeatherContainer, `Current weather: ${data.error}`);
                    displayError(forecastContainer, `Forecast: ${data.error}`);
                } else {
                    console.error(`Polling error for ${locationName}: ${data.error}`);
                }
                clearTimeout(pollingTimerId);
                return;
            }
            
            if (data.current_weather && data.forecast) {
                // Pass locationName to display functions
                displayCurrentWeather(data.current_weather, locationName); 
                displayForecast(data.forecast);

                lastLocationQuery = { latitude, longitude, locationName }; // Store for polling
                clearTimeout(pollingTimerId); 
                pollingTimerId = setTimeout(pollWeather, POLLING_INTERVAL_MS);
                console.log(`Next poll scheduled for ${locationName} in ${POLLING_INTERVAL_MS / 1000 / 60} minutes.`);
            } else {
                if (!isPoll) {
                    displayError(currentWeatherContainer, 'Received incomplete weather data from server.');
                    displayError(forecastContainer, 'Received incomplete weather data from server.');
                } else {
                    console.error(`Polling error for ${locationName}: Incomplete data from server.`);
                }
                clearTimeout(pollingTimerId);
            }
        } catch (error) {
            console.error('Fetch weather error:', error);
            if (!isPoll) {
                displayError(currentWeatherContainer, `Failed to fetch current weather. ${error.message}`);
                displayError(forecastContainer, `Failed to fetch forecast. ${error.message}`);
            } else {
                console.error(`Polling fetch weather error for ${locationName}: ${error.message}`);
            }
            clearTimeout(pollingTimerId);
        }
    };

    const geocodeCityAndFetchWeather = async (cityName) => {
        currentWeatherContainer.innerHTML = `<p>Finding ${cityName}...</p>`;
        forecastContainer.innerHTML = ''; // Clear previous forecast
        
        const geocodeUrl = `${GEOCODING_API_URL}?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;

        try {
            const response = await fetch(geocodeUrl);
            if (!response.ok) {
                displayError(currentWeatherContainer, `Error finding city: ${response.statusText}`);
                return;
            }
            const data = await response.json();
            if (!data.results || data.results.length === 0) {
                displayError(currentWeatherContainer, `City "${cityName}" not found. Please try another name.`);
                return;
            }
            const firstResult = data.results[0];
            const latitude = firstResult.latitude;
            const longitude = firstResult.longitude;
            // Construct a display name, e.g., "Berlin, Germany"
            let displayName = firstResult.name;
            if (firstResult.admin1) displayName += `, ${firstResult.admin1}`;
            if (firstResult.country_code) displayName += `, ${firstResult.country_code}`;
            
            fetchWeatherData(latitude, longitude, displayName);
        } catch (error) {
            console.error('Geocoding error:', error);
            displayError(currentWeatherContainer, `Failed to find city. ${error.message}`);
        }
    };

    const handleSearch = () => {
        const city = locationInput.value.trim();
        if (city) {
            geocodeCityAndFetchWeather(city);
        } else {
            displayError(currentWeatherContainer, 'Please enter a city name.');
            forecastContainer.innerHTML = '';
            clearTimeout(pollingTimerId); 
            lastLocationQuery = null; 
        }
    };

    const handleUseMyLocation = () => {
        if (navigator.geolocation) {
            currentWeatherContainer.innerHTML = '<p>Fetching your location...</p>';
            forecastContainer.innerHTML = '';
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    fetchWeatherData(lat, lon, "Your Current Location");
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    let message = 'Could not get your location. ';
                    switch(error.code) {
                        case error.PERMISSION_DENIED: message += "User denied the request for Geolocation."; break;
                        case error.POSITION_UNAVAILABLE: message += "Location information is unavailable."; break;
                        case error.TIMEOUT: message += "The request to get user location timed out."; break;
                        default: message += "An unknown error occurred."; break;
                    }
                    displayError(currentWeatherContainer, message);
                    forecastContainer.innerHTML = '';
                    clearTimeout(pollingTimerId); 
                    lastLocationQuery = null; 
                }
            );
        } else {
            displayError(currentWeatherContainer, 'Geolocation is not supported by your browser.');
            forecastContainer.innerHTML = '';
            clearTimeout(pollingTimerId); 
            lastLocationQuery = null; 
        }
    };

    searchButton.addEventListener('click', handleSearch);
    locationInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });
    useLocationButton.addEventListener('click', handleUseMyLocation);

    // Initial load with Berlin's coordinates
    const berlinLat = 52.52;
    const berlinLon = 13.41;
    const berlinName = "Berlin, Germany";
    fetchWeatherData(berlinLat, berlinLon, berlinName);
});
