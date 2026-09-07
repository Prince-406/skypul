import type {
  GeocodingResult,
  WeatherData,
  HourlyForecastPoint,
  DailyForecastDay,
} from '@/types/weather';

const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1';
const WEATHER_BASE = 'https://api.open-meteo.com/v1';

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  if (!query || query.length < 2) return [];

  const url = `${GEOCODING_BASE}/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  if (!data.results || !Array.isArray(data.results)) return [];

  return data.results.map((r: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    country_code: string;
    admin1?: string;
    timezone: string;
    population?: number;
  }) => ({
    id: r.id,
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country,
    country_code: r.country_code,
    admin1: r.admin1,
    timezone: r.timezone,
    population: r.population,
  }));
}

export async function getWeatherData(location: GeocodingResult): Promise<WeatherData> {
  const { latitude, longitude, timezone } = location;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: timezone ?? 'auto',
    forecast_days: '7',
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'wind_speed_10m',
      'wind_direction_10m',
      'precipitation',
      'uv_index',
      'visibility',
      'surface_pressure',
      'weather_code',
      'is_day',
      'cloud_cover',
      'dew_point_2m',
    ].join(','),
    hourly: [
      'temperature_2m',
      'apparent_temperature',
      'precipitation',
      'precipitation_probability',
      'weather_code',
      'wind_speed_10m',
      'relative_humidity_2m',
      'uv_index',
      'visibility',
      'is_day',
    ].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'weather_code',
      'sunrise',
      'sunset',
      'uv_index_max',
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
    ].join(','),
  });

  const url = `${WEATHER_BASE}/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch weather data');

  const d = await res.json();

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Map hourly data
  const hourlyData: HourlyForecastPoint[] = (d.hourly?.time ?? []).map((time: string, i: number) => ({
    time,
    temperature: Math.round(d.hourly.temperature_2m[i] ?? 0),
    feelsLike: Math.round(d.hourly.apparent_temperature[i] ?? 0),
    precipitation: d.hourly.precipitation[i] ?? 0,
    precipitationProbability: d.hourly.precipitation_probability[i] ?? 0,
    weatherCode: d.hourly.weather_code[i] ?? 0,
    windSpeed: d.hourly.wind_speed_10m[i] ?? 0,
    humidity: d.hourly.relative_humidity_2m[i] ?? 0,
    uvIndex: d.hourly.uv_index[i] ?? 0,
    visibility: (d.hourly.visibility[i] ?? 0) / 1000, // convert m to km
    isDay: d.hourly.is_day[i] ?? 1,
  }));

  // Map daily data
  const dailyData: DailyForecastDay[] = (d.daily?.time ?? []).map((date: string, i: number) => ({
    date,
    tempMax: d.daily.temperature_2m_max[i] ?? 0,
    tempMin: d.daily.temperature_2m_min[i] ?? 0,
    precipitationSum: d.daily.precipitation_sum[i] ?? 0,
    precipitationProbability: d.daily.precipitation_probability_max[i] ?? 0,
    weatherCode: d.daily.weather_code[i] ?? 0,
    sunrise: d.daily.sunrise[i] ?? `${date}T06:00:00`,
    sunset: d.daily.sunset[i] ?? `${date}T18:00:00`,
    uvIndexMax: d.daily.uv_index_max[i] ?? 0,
    windSpeedMax: d.daily.wind_speed_10m_max[i] ?? 0,
    windGusts: d.daily.wind_gusts_10m_max[i] ?? 0,
  }));

  const todayDaily = dailyData[0];
  const sunriseStr = todayDaily?.sunrise ?? `${todayStr}T06:00:00`;
  const sunsetStr = todayDaily?.sunset ?? `${todayStr}T18:00:00`;

  const sunriseDate = new Date(sunriseStr);
  const sunsetDate = new Date(sunsetStr);
  const daylightDuration = Math.round((sunsetDate.getTime() - sunriseDate.getTime()) / 60000);

  const weather: WeatherData = {
    location,
    current: {
      temperature: Math.round(d.current?.temperature_2m ?? 0),
      feelsLike: Math.round(d.current?.apparent_temperature ?? 0),
      humidity: d.current?.relative_humidity_2m ?? 0,
      windSpeed: d.current?.wind_speed_10m ?? 0,
      windDirection: d.current?.wind_direction_10m ?? 0,
      precipitation: d.current?.precipitation ?? 0,
      uvIndex: d.current?.uv_index ?? 0,
      visibility: (d.current?.visibility ?? 0) / 1000,
      pressure: d.current?.surface_pressure ?? 1013,
      weatherCode: d.current?.weather_code ?? 0,
      isDay: (d.current?.is_day ?? 1) === 1,
      cloudCover: d.current?.cloud_cover ?? 0,
      dewPoint: Math.round(d.current?.dew_point_2m ?? 0),
    },
    hourly: hourlyData,
    daily: dailyData,
    sunInfo: {
      sunrise: sunriseStr,
      sunset: sunsetStr,
      currentTime: now.toISOString(),
      daylightDuration,
    },
    lastUpdated: now.toISOString(),
  };

  return weather;
}

export async function getReverseGeocode(lat: number, lon: number): Promise<GeocodingResult | null> {
  // Use Open-Meteo geocoding to find nearest city by searching with coordinates
  // Open-Meteo doesn't have a reverse geocoding endpoint, so we use a nearby search approach
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });
    if (!res.ok) throw new Error('Reverse geocode failed');
    const data = await res.json();

    const cityName =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.county ||
      'Current Location';

    // Now search for the city to get proper geocoding result with timezone
    const geoResults = await searchLocations(cityName);
    if (geoResults.length > 0) {
      // Find closest result by distance
      const closest = geoResults.reduce((prev, curr) => {
        const prevDist = Math.abs(prev.latitude - lat) + Math.abs(prev.longitude - lon);
        const currDist = Math.abs(curr.latitude - lat) + Math.abs(curr.longitude - lon);
        return currDist < prevDist ? curr : prev;
      });
      return closest;
    }

    return {
      id: 999999,
      name: cityName,
      latitude: lat,
      longitude: lon,
      country: data.address?.country ?? 'Unknown',
      country_code: data.address?.country_code?.toUpperCase() ?? 'XX',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      admin1: data.address?.state,
    };
  } catch {
    return {
      id: 999999,
      name: 'Current Location',
      latitude: lat,
      longitude: lon,
      country: 'Auto-detected',
      country_code: 'XX',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      admin1: 'Local',
    };
  }
}