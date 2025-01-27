import { execAsync, GLib, GObject, interval, property, readFileAsync, register, writeFileAsync } from "astal";
import { weather as config } from "../../config";

export interface WeatherCondition {
    text: string;
    icon: string;
    code: number;
}

interface _WeatherState {
    temp_c: number;
    temp_f: number;
    is_day: number;
    condition: WeatherCondition;
    wind_mph: number;
    wind_kph: number;
    wind_degree: number;
    wind_dir: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
    pressure_mb: number;
    pressure_in: number;
    precip_mm: number;
    precip_in: number;
    humidity: number;
    cloud: number;
    feelslike_c: number;
    feelslike_f: number;
    windchill_c: number;
    windchill_f: number;
    heatindex_c: number;
    heatindex_f: number;
    dewpoint_c: number;
    dewpoint_f: number;
    vis_km: number;
    vis_miles: number;
    uv: number;
    gust_mph: number;
    gust_kph: number;
}

export interface WeatherCurrent extends _WeatherState {
    last_updated_epoch: number;
    last_updated: string;
}

export interface WeatherHour extends _WeatherState {
    time_epoch: number;
    time: string;
}

export interface WeatherDay {
    date: string;
    date_epoch: number;
    day: {
        maxtemp_c: number;
        maxtemp_f: number;
        mintemp_c: number;
        mintemp_f: number;
        avgtemp_c: number;
        avgtemp_f: number;
        maxwind_mph: number;
        maxwind_kph: number;
        totalprecip_mm: number;
        totalprecip_in: number;
        totalsnow_cm: number;
        avgvis_km: number;
        avgvis_miles: number;
        avghumidity: number;
        daily_will_it_rain: number;
        daily_chance_of_rain: number;
        daily_will_it_snow: number;
        daily_chance_of_snow: number;
        condition: WeatherCondition;
        uv: number;
    };
    astro: {
        sunrise: string;
        sunset: string;
        moonrise: string;
        moonset: string;
        moon_phase: string;
        moon_illumination: string;
        is_moon_up: number;
        is_sun_up: number;
    };
    hour: WeatherHour[];
}

export interface WeatherLocation {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    tz_id: string;
    localtime_epoch: number;
    localtime: string;
}

export interface WeatherData {
    current: WeatherCurrent;
    forecast: { forecastday: WeatherDay[] };
    location: WeatherLocation;
}

const DEFAULT_STATE: _WeatherState = {
    temp_c: 0,
    temp_f: 0,
    is_day: 0,
    condition: { text: "", icon: "", code: 0 },
    wind_mph: 0,
    wind_kph: 0,
    wind_degree: 0,
    wind_dir: "N",
    pressure_mb: 0,
    pressure_in: 0,
    precip_mm: 0,
    precip_in: 0,
    humidity: 0,
    cloud: 0,
    feelslike_c: 0,
    feelslike_f: 0,
    windchill_c: 0,
    windchill_f: 0,
    heatindex_c: 0,
    heatindex_f: 0,
    dewpoint_c: 0,
    dewpoint_f: 0,
    vis_km: 0,
    vis_miles: 0,
    uv: 0,
    gust_mph: 0,
    gust_kph: 0,
};

const DEFAULT: WeatherData = {
    current: {
        last_updated_epoch: 0,
        last_updated: "",
        ...DEFAULT_STATE,
    },
    forecast: {
        forecastday: [
            {
                date: "",
                date_epoch: 0,
                day: {
                    maxtemp_c: 0,
                    maxtemp_f: 0,
                    mintemp_c: 0,
                    mintemp_f: 0,
                    avgtemp_c: 0,
                    avgtemp_f: 0,
                    maxwind_mph: 0,
                    maxwind_kph: 0,
                    totalprecip_mm: 0,
                    totalprecip_in: 0,
                    totalsnow_cm: 0,
                    avgvis_km: 0,
                    avgvis_miles: 0,
                    avghumidity: 0,
                    daily_will_it_rain: 0,
                    daily_chance_of_rain: 0,
                    daily_will_it_snow: 0,
                    daily_chance_of_snow: 0,
                    condition: { text: "", icon: "", code: 0 },
                    uv: 0,
                },
                astro: {
                    sunrise: "",
                    sunset: "",
                    moonrise: "",
                    moonset: "",
                    moon_phase: "",
                    moon_illumination: "",
                    is_moon_up: 0,
                    is_sun_up: 0,
                },
                hour: Array.from({ length: 24 }, () => ({
                    time_epoch: 0,
                    time: "",
                    ...DEFAULT_STATE,
                })),
            },
        ],
    },
    location: {
        name: "",
        region: "",
        country: "",
        lat: 0,
        lon: 0,
        tz_id: "",
        localtime_epoch: 0,
        localtime: "",
    },
};

const STATUS_ICONS: Record<string, string> = {
    warning: "󰼯",
    sunny: "󰖙",
    clear: "󰖔",
    partly_cloudy: "󰖕",
    partly_cloudy_night: "󰼱",
    cloudy: "󰖐",
    overcast: "󰖕",
    mist: "󰖑",
    patchy_rain_nearby: "󰼳",
    patchy_rain_possible: "󰼳",
    patchy_snow_possible: "󰼴",
    patchy_sleet_possible: "󰙿",
    patchy_freezing_drizzle_possible: "󰙿",
    thundery_outbreaks_possible: "󰙾",
    blowing_snow: "󰼶",
    blizzard: "󰼶",
    fog: "󰖑",
    freezing_fog: "󰖑",
    patchy_light_drizzle: "󰼳",
    light_drizzle: "󰼳",
    freezing_drizzle: "󰙿",
    heavy_freezing_drizzle: "󰙿",
    patchy_light_rain: "󰼳",
    light_rain: "󰼳",
    moderate_rain_at_times: "󰖗",
    moderate_rain: "󰼳",
    heavy_rain_at_times: "󰖖",
    heavy_rain: "󰖖",
    light_freezing_rain: "󰙿",
    moderate_or_heavy_freezing_rain: "󰙿",
    light_sleet: "󰙿",
    moderate_or_heavy_sleet: "󰙿",
    patchy_light_snow: "󰼴",
    light_snow: "󰼴",
    patchy_moderate_snow: "󰼴",
    moderate_snow: "󰼶",
    patchy_heavy_snow: "󰼶",
    heavy_snow: "󰼶",
    ice_pellets: "󰖒",
    light_rain_shower: "󰖖",
    moderate_or_heavy_rain_shower: "󰖖",
    torrential_rain_shower: "󰖖",
    light_sleet_showers: "󰼵",
    moderate_or_heavy_sleet_showers: "󰼵",
    light_snow_showers: "󰼵",
    moderate_or_heavy_snow_showers: "󰼵",
    light_showers_of_ice_pellets: "󰖒",
    moderate_or_heavy_showers_of_ice_pellets: "󰖒",
    patchy_light_rain_with_thunder: "󰙾",
    moderate_or_heavy_rain_with_thunder: "󰙾",
    moderate_or_heavy_rain_in_area_with_thunder: "󰙾",
    patchy_light_snow_with_thunder: "󰼶",
    moderate_or_heavy_snow_with_thunder: "󰼶",
};

@register({ GTypeName: "Weather" })
export default class Weather extends GObject.Object {
    static instance: Weather;
    static get_default() {
        if (!this.instance) this.instance = new Weather();

        return this.instance;
    }

    readonly #cache: string = `${CACHE}/weather.json`;

    #key: string = "";
    #data: WeatherData = DEFAULT;

    @property(Object)
    get raw() {
        return this.#data;
    }

    @property(Object)
    get current() {
        return this.#data.current;
    }

    @property(Object)
    get forecast() {
        return this.#data.forecast.forecastday[0].hour;
    }

    @property(Object)
    get location() {
        return this.#data.location;
    }

    @property(String)
    get condition() {
        return this.#data.current.condition.text;
    }

    @property(String)
    get temperature() {
        return this.getTemp(this.#data.current);
    }

    @property(String)
    get wind() {
        return `${Math.round(this.#data.current[`wind_${config.imperial ? "m" : "k"}ph`])} ${
            config.imperial ? "m" : "k"
        }ph`;
    }

    @property(String)
    get rainChance() {
        return this.#data.forecast.forecastday[0].day.daily_chance_of_rain + "%";
    }

    @property(String)
    get icon() {
        return this.getIcon(this.#data.current.condition.text);
    }

    @property(String)
    get tempIcon() {
        return this.getTempIcon(this.#data.current.temp_c);
    }

    @property(String)
    get tempColour() {
        return this.getTempDesc(this.#data.current.temp_c);
    }

    getIcon(status: string) {
        let query = status.trim().toLowerCase().replaceAll(" ", "_");
        if (!this.#data.current.is_day && query + "_night" in STATUS_ICONS) query += "_night";
        return STATUS_ICONS[query] ?? STATUS_ICONS.warning;
    }

    getTemp(data: _WeatherState) {
        return `${Math.round(data[`temp_${config.imperial ? "f" : "c"}`])}°${config.imperial ? "F" : "C"}`;
    }

    getTempIcon(temp: number) {
        if (temp >= 40) return "";
        if (temp >= 30) return "";
        if (temp >= 20) return "";
        if (temp >= 10) return "";
        return "";
    }

    getTempDesc(temp: number) {
        if (temp >= 40) return "burning";
        if (temp >= 30) return "hot";
        if (temp >= 20) return "normal";
        if (temp >= 10) return "cold";
        return "freezing";
    }

    #notify() {
        this.notify("raw");
        this.notify("current");
        this.notify("forecast");
        this.notify("location");
        this.notify("condition");
        this.notify("temperature");
        this.notify("wind");
        this.notify("rain-chance");
        this.notify("icon");
        this.notify("temp-icon");
        this.notify("temp-colour");
    }

    async getWeather() {
        const location = config.location || JSON.parse(await execAsync("curl ipinfo.io")).city;
        return JSON.parse(
            await execAsync([
                "curl",
                `https://api.weatherapi.com/v1/forecast.json?key=${this.#key}&q=${location}&days=1&aqi=no&alerts=no`,
            ])
        );
    }

    async updateWeather() {
        if (GLib.file_test(this.#cache, GLib.FileTest.EXISTS)) {
            const cache = await readFileAsync(this.#cache);
            const cache_data: WeatherData = JSON.parse(cache);
            if (cache_data.location.localtime_epoch * 1000 + config.interval > Date.now()) {
                if (JSON.stringify(this.#data) !== cache) {
                    this.#data = cache_data;
                    this.#notify();
                }
                return;
            }
        }

        try {
            const data = await this.getWeather();
            this.#data = data;
            writeFileAsync(this.#cache, JSON.stringify(data)).catch(console.error); // Catch here so it doesn't propagate
        } catch (e) {
            console.error("Error getting weather:", e);
            this.#data = DEFAULT;
        }
        this.#notify();
    }

    constructor() {
        super();

        readFileAsync(config.key)
            .then(k => {
                this.#key = k;
                this.updateWeather().catch(console.error);
                interval(config.interval, () => this.updateWeather().catch(console.error));
            })
            .catch(console.error);
    }
}