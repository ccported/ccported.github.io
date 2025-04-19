// Weather codes mapping to emoji icons
const weatherIcons = {
    0: '☀️',    // Clear sky
    1: '🌤️',    // Mainly clear
    2: '⛅️',    // Partly cloudy
    3: '☁️',    // Overcast
    45: '🌫️',   // Foggy
    48: '🌫️',   // Depositing rime fog
    51: '🌧️',   // Light drizzle
    53: '🌧️',   // Moderate drizzle
    55: '🌧️',   // Dense drizzle
    61: '🌧️',   // Slight rain
    63: '🌧️',   // Moderate rain
    65: '🌧️',   // Heavy rain
    71: '🌨️',   // Slight snow
    73: '🌨️',   // Moderate snow
    75: '🌨️',   // Heavy snow
    77: '🌨️',   // Snow grains
    80: '🌧️',   // Slight rain showers
    81: '🌧️',   // Moderate rain showers
    82: '🌧️',   // Violent rain showers
    85: '🌨️',   // Slight snow showers
    86: '🌨️',   // Heavy snow showers
    95: '⛈️',   // Thunderstorm
    96: '⛈️',   // Thunderstorm with slight hail
    99: '⛈️',   // Thunderstorm with heavy hail
};

// Function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

// Function to get weather data
async function getWeatherData() {
    try {
        // Get user's location (default to New York if geolocation fails)
        let latitude = 40.7128;
        let longitude = -74.0060;

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;
        } catch (error) {
            console.log('Using default location (New York)');
        }
        window.pos = window.pos || {};
        window.pos.lat = latitude;
        window.pos.long = longitude;
        // Fetch weather data from Open-Meteo API
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${latitude}&longitude=${longitude}&` +
            `current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code&` +
            `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&` +
            `timezone=auto`
        );

        if (!response.ok) {
            throw new Error('Weather data fetch failed');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        throw error;
    }
}

// Function to update the UI with weather data
function updateUI(data) {
    // Update current weather
    const currentContainer = document.getElementById('current');
    currentContainer.innerHTML = `
                <h2>Current Weather for ${data.city || "Unknown"}</h2>
                <div class="temperature">${Math.round(data.current.temperature_2m)}${data.current_units.temperature_2m}</div>
                <div class="weather-icon">${weatherIcons[data.current.weather_code] || '❓'}</div>
                <div class="conditions">
                    Feels like: ${Math.round(data.current.apparent_temperature)}${data.current_units.apparent_temperature}<br>
                    Humidity: ${data.current.relative_humidity_2m}${data.current_units.relative_humidity_2m}<br>
                    Precipitation: ${data.current.precipitation}${data.current_units.precipitation}
                </div>
            `;

    // Update forecast
    const forecastContainer = document.getElementById('forecast');
    forecastContainer.innerHTML = data.daily.time.map((date, index) => `
                <div class="forecast-day">
                    <div class="date">${formatDate(date)}</div>
                    <div class="weather-icon">${weatherIcons[data.daily.weather_code[index]] || '❓'}</div>
                    <div class="conditions">
                        High: ${Math.round(data.daily.temperature_2m_max[index])}${data.daily_units.temperature_2m_max}<br>
                        Low: ${Math.round(data.daily.temperature_2m_min[index])}${data.daily_units.temperature_2m_min}<br>
                        Rain: ${data.daily.precipitation_sum[index]}${data.daily_units.precipitation_sum}
                    </div>
                </div>
            `).join('');
}

// Function to handle errors
function showError(message) {
    const container = document.querySelector('.container');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    container.insertBefore(errorDiv, container.firstChild);
}
async function getCity() {
    console.log(window.pos)
    const res = await fetch("https://geocode.maps.co/reverse?lat=" + window.pos.lat + "&lon=" + window.pos.long + "&api_key=678db629dd6e7593595140xwfa9064c");
    const json = await res.json();
    return json.address.town;
}
// Initialize the weather dashboard
async function initWeather() {
    try {
        const wdata = await getWeatherData();
        const city = await getCity();
        const data = { ...wdata, city };
        updateUI(data);
    } catch (error) {
        showError('Failed to load weather data. Please try again later.');
    }
}

// Start the application
initWeather();