/* =========================================================
   KRISHI SAATHI - WEATHER & MARKET DATA SERVICE
========================================================= */

/*
  Weather:
  - Uses Open-Meteo when latitude/longitude are available.
  - Keeps a safe fallback so existing farmers without GPS
    coordinates continue to work.
  - No API key is required for the Open-Meteo free endpoint.

  Market:
  - Keeps the existing simulated mandi data for now.
  - We will replace this separately with real mandi data.
*/

/* =========================================================
   TYPES
========================================================= */

export type WeatherResult = {
  district: string;

  rainfallNext24h: number;
  rainfallDeviation: number;

  temperature: number;
  condition: string;
  warning: string;

  precipitationProbability: number;

  source: string;

  latitude: number | null;
  longitude: number | null;
};

export type MarketResult = {
  mandi: string;
  distance: string;
  price: number;
  trend: string;
};

/* =========================================================
   WEATHER CODE → HUMAN READABLE TEXT
========================================================= */

function weatherCodeToText(
  code: number
): string {
  if (code === 0) {
    return "Clear sky";
  }

  if (
    code === 1 ||
    code === 2 ||
    code === 3
  ) {
    return "Partly cloudy";
  }

  if (
    code === 45 ||
    code === 48
  ) {
    return "Foggy";
  }

  if (
    code === 51 ||
    code === 53 ||
    code === 55 ||
    code === 56 ||
    code === 57
  ) {
    return "Drizzle";
  }

  if (
    code === 61 ||
    code === 63 ||
    code === 65 ||
    code === 66 ||
    code === 67
  ) {
    return "Rain";
  }

  if (
    code === 71 ||
    code === 73 ||
    code === 75 ||
    code === 77
  ) {
    return "Snow";
  }

  if (
    code === 80 ||
    code === 81 ||
    code === 82
  ) {
    return "Rain showers";
  }

  if (
    code === 95 ||
    code === 96 ||
    code === 99
  ) {
    return "Thunderstorm";
  }

  return "Cloudy";
}

/* =========================================================
   WEATHER WARNING
========================================================= */

function buildWeatherWarning(
  rainfallNext24h: number,
  precipitationProbability: number,
  temperature: number,
  condition: string
): string {
  if (
    rainfallNext24h >= 50
  ) {
    return (
      "Heavy rainfall is expected. " +
      "Keep drainage channels clear, avoid unnecessary field operations, " +
      "and protect harvested produce from getting wet."
    );
  }

  if (
    rainfallNext24h >= 20 ||
    precipitationProbability >= 70
  ) {
    return (
      "Rain is likely in the next 24 hours. " +
      "Check field drainage and avoid spraying pesticides or fertilizers " +
      "just before rainfall."
    );
  }

  if (
    condition === "Thunderstorm"
  ) {
    return (
      "Thunderstorms are possible. " +
      "Avoid working in open fields during lightning and secure farm equipment."
    );
  }

  if (
    temperature >= 38
  ) {
    return (
      "High temperatures are expected. " +
      "Monitor crop moisture closely and irrigate according to crop needs."
    );
  }

  if (
    temperature >= 35
  ) {
    return (
      "Warm conditions are expected. " +
      "Check soil moisture and watch crops for heat stress."
    );
  }

  return "Weather conditions look normal for now.";
}

/* =========================================================
   REAL WEATHER
========================================================= */

/*
  Weather strategy:
  1. Use exact farmer GPS coordinates when available.
  2. If GPS is missing, geocode the district and use
     district-level live weather.
  3. Only use the demo fallback when both live methods fail.

  This means legacy farmer accounts with NULL coordinates
  can still receive live district weather.
*/

function isValidCoordinate(
  value: number | null
): value is number {
  return (
    value !== null &&
    Number.isFinite(value)
  );
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 8000
): Promise<Response> {
  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    return await fetch(
      url,
      {
        method: "GET",
        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "KrishiSaathi/1.0",
        },

        signal:
          controller.signal,
      }
    );
  } finally {
    clearTimeout(
      timeout
    );
  }
}

function toNumber(
  value: unknown,
  fallback = 0
): number {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}

/* ---------------------------------------------------------
   Open-Meteo
--------------------------------------------------------- */

async function fetchOpenMeteo(
  latitude: number,
  longitude: number
) {
  const params =
    new URLSearchParams({
      latitude:
        String(latitude),

      longitude:
        String(longitude),

      current:
        "temperature_2m,precipitation,weather_code,wind_speed_10m",

      hourly:
        "precipitation_probability,precipitation,rain,relative_humidity_2m,soil_moisture_0_to_7cm",

      daily:
        "precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min",

      forecast_days:
        "2",

      timezone:
        "auto",
    });

  const url =
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  const response =
    await fetchWithTimeout(
      url
    );

  if (!response.ok) {
    throw new Error(
      `Open-Meteo returned HTTP ${response.status}`
    );
  }

  const data =
    (await response.json()) as any;

  if (
    !data?.current ||
    !data?.hourly
  ) {
    throw new Error(
      "Open-Meteo returned an incomplete weather response"
    );
  }

  const hourlyPrecipitation =
    Array.isArray(
      data.hourly.precipitation
    )
      ? data.hourly.precipitation
      : [];

  const hourlyProbability =
    Array.isArray(
      data.hourly
        .precipitation_probability
    )
      ? data.hourly
          .precipitation_probability
      : [];

  /*
    Sum the first 24 forecast hours.

    The explicit parameter types are important because
    TypeScript can otherwise infer these reducer arguments
    too loosely depending on compiler settings.
  */

  const rainfallNext24h =
    Number(
      hourlyPrecipitation
        .slice(0, 24)
        .reduce(
          (
            total: number,
            value: unknown
          ) =>
            total +
            toNumber(value),
          0
        )
        .toFixed(1)
    );

  const probabilityValues =
    hourlyProbability
      .slice(0, 24)
      .map(
        (
          value: unknown
        ) =>
          toNumber(value)
      );

  const precipitationProbability =
    probabilityValues.length >
    0
      ? Math.round(
          Math.max(
            ...probabilityValues
          )
        )
      : Math.round(
          toNumber(
            data.daily
              ?.precipitation_probability_max?.[0]
          )
        );

  const temperature =
    Number(
      data.current
        ?.temperature_2m
    );

  const weatherCode =
    Number(
      data.current
        ?.weather_code
    );

  if (
    !Number.isFinite(
      temperature
    ) ||
    !Number.isFinite(
      weatherCode
    )
  ) {
    throw new Error(
      "Open-Meteo returned invalid weather values"
    );
  }

  return {
    rainfallNext24h,

    precipitationProbability,

    temperature,

    weatherCode,
  };
}

/* ---------------------------------------------------------
   Nominatim district geocoding
--------------------------------------------------------- */

async function geocodeDistrict(
  district: string
) {
  const cleanDistrict =
    String(
      district || ""
    ).trim();

  if (!cleanDistrict) {
    return null;
  }

  /*
    Try the district name first. If that does not resolve,
    try an India-qualified query.
  */

  const queries = [
    `${cleanDistrict}, India`,
    `${cleanDistrict}, Uttar Pradesh, India`,
    `${cleanDistrict}, Odisha, India`,
  ];

  for (
    const query of queries
  ) {
    try {
      const params =
        new URLSearchParams({
          format:
            "jsonv2",

          q: query,

          limit: "5",

          addressdetails:
            "1",

          "accept-language":
            "en",
        });

      const url =
        `https://nominatim.openstreetmap.org/search?${params.toString()}`;

      const response =
        await fetchWithTimeout(
          url
        );

      if (!response.ok) {
        console.warn(
          `[weather] district geocoder HTTP ${response.status} for "${query}"`
        );

        continue;
      }

      const results =
        (await response.json()) as any[];

      if (
        !Array.isArray(
          results
        ) ||
        results.length ===
          0
      ) {
        continue;
      }

      /*
        Prefer a result whose district/state text actually
        contains the requested district. This reduces the
        chance of taking a similarly named place.
      */

      const normalizedRequested =
        cleanDistrict
          .toLowerCase()
          .replace(
            /[^a-z0-9]/g,
            ""
          );

      const scored =
        results
          .map(
            (
              item: any
            ) => {
              const address =
                item?.address ||
                {};

              const districtName =
                String(
                  address.state_district ||
                    address.district ||
                    address.county ||
                    ""
                )
                  .toLowerCase()
                  .replace(
                    /[^a-z0-9]/g,
                    ""
                  );

              const displayName =
                String(
                  item?.display_name ||
                    ""
                )
                  .toLowerCase()
                  .replace(
                    /[^a-z0-9]/g,
                    ""
                  );

              let score =
                0;

              if (
                districtName ===
                normalizedRequested
              ) {
                score +=
                  10;
              }

              if (
                districtName.includes(
                  normalizedRequested
                ) ||
                normalizedRequested.includes(
                  districtName
                )
              ) {
                score +=
                  5;
              }

              if (
                displayName.includes(
                  normalizedRequested
                )
              ) {
                score +=
                  2;
              }

              return {
                item,
                score,
              };
            }
          )
          .sort(
            (
              a,
              b
            ) =>
              b.score -
              a.score
          );

      const best =
        scored[0]?.item;

      if (!best) {
        continue;
      }

      const latitude =
        Number(
          best.lat
        );

      const longitude =
        Number(
          best.lon
        );

      if (
        !Number.isFinite(
          latitude
        ) ||
        !Number.isFinite(
          longitude
        )
      ) {
        continue;
      }

      return {
        latitude,
        longitude,

        displayName:
          best.display_name ??
          null,
      };
    } catch (
      error
    ) {
      console.error(
        `[weather] district geocoding failed for "${query}":`,
        error
      );
    }
  }

  return null;
}

/* ---------------------------------------------------------
   Public weather service
--------------------------------------------------------- */

export async function getWeather(
  district: string,
  latitude?: number | null,
  longitude?: number | null
): Promise<WeatherResult> {
  const safeLatitude =
    latitude !== undefined &&
    latitude !== null &&
    Number.isFinite(
      Number(latitude)
    )
      ? Number(latitude)
      : null;

  const safeLongitude =
    longitude !== undefined &&
    longitude !== null &&
    Number.isFinite(
      Number(longitude)
    )
      ? Number(longitude)
      : null;

  /*
    LEVEL 1
    Exact farmer GPS coordinates.
  */

  if (
    isValidCoordinate(
      safeLatitude
    ) &&
    isValidCoordinate(
      safeLongitude
    )
  ) {
    try {
      console.log(
        `[weather] requesting Open-Meteo for ${safeLatitude}, ${safeLongitude}`
      );

      const live =
        await fetchOpenMeteo(
          safeLatitude,
          safeLongitude
        );

      const condition =
        weatherCodeToText(
          live.weatherCode
        );

      const warning =
        buildWeatherWarning(
          live.rainfallNext24h,
          live.precipitationProbability,
          live.temperature,
          condition
        );

      console.log(
        `[weather] success: ${live.temperature}°C, ${live.rainfallNext24h} mm, ${condition}`
      );

      return {
        district:
          district ||
          "Unknown district",

        rainfallNext24h:
          live.rainfallNext24h,

        /*
          Compatibility field for the existing risk engine.
          This is forecast rainfall amount, not a historical
          climate anomaly.
        */
        rainfallDeviation:
          live.rainfallNext24h,

        temperature:
          live.temperature,

        condition,

        warning,

        precipitationProbability:
          live.precipitationProbability,

        source:
          "open-meteo",

        latitude:
          safeLatitude,

        longitude:
          safeLongitude,
      };
    } catch (
      error
    ) {
      console.error(
        `[weather] coordinate request failed for ${safeLatitude}, ${safeLongitude}:`,
        error
      );
    }
  }

  /*
    LEVEL 2
    District fallback for legacy farmer records whose
    coordinates are NULL.
  */

  const cleanDistrict =
    String(
      district || ""
    ).trim();

  if (
    cleanDistrict
  ) {
    try {
      const place =
        await geocodeDistrict(
          cleanDistrict
        );

      if (
        place
      ) {
        console.log(
          `[weather] using district fallback coordinates for ${cleanDistrict}: ${place.latitude}, ${place.longitude}`
        );

        const live =
          await fetchOpenMeteo(
            place.latitude,
            place.longitude
          );

        const condition =
          weatherCodeToText(
            live.weatherCode
          );

        const warning =
          buildWeatherWarning(
            live.rainfallNext24h,
            live.precipitationProbability,
            live.temperature,
            condition
          );

        console.log(
          `[weather] district fallback success: ${live.temperature}°C, ${live.rainfallNext24h} mm, ${condition}`
        );

        return {
          district:
            cleanDistrict,

          rainfallNext24h:
            live.rainfallNext24h,

          rainfallDeviation:
            live.rainfallNext24h,

          temperature:
            live.temperature,

          condition,

          warning,

          precipitationProbability:
            live.precipitationProbability,

          source:
            "open-meteo-district",

          latitude:
            place.latitude,

          longitude:
            place.longitude,
        };
      }
    } catch (
      error
    ) {
      console.error(
        `[weather] district weather fallback failed for ${cleanDistrict}:`,
        error
      );
    }
  }

  /*
    LEVEL 3
    Safe fallback. We only reach this if live coordinates
    and district geocoding both fail.
  */

  console.log(
    `[weather] no live weather available for ${district}; using fallback`
  );

  return {
    district:
      district ||
      "Unknown district",

    rainfallNext24h:
      0,

    rainfallDeviation:
      0,

    temperature:
      30,

    condition:
      "Live weather unavailable",

    warning:
      "Live weather could not be loaded for this location. " +
      "Please check your location details and try again.",

    precipitationProbability:
      0,

    source:
      "fallback",

    latitude:
      safeLatitude,

    longitude:
      safeLongitude,
  };
}

/* =========================================================
   MARKET DATA
========================================================= */

export function getMarket(
  crop: string
): MarketResult[] {
  const normalizedCrop =
    String(
      crop || ""
    ).trim();

  /*
    Keep the existing simulated market
    structure for now.

    We will replace this function later
    with real AGMARKNET / OGD data.
  */

  const marketDatabase: Record<
    string,
    MarketResult[]
  > = {
    Paddy: [
      {
        mandi: "Sundargarh Mandi",
        distance: "18 km",
        price: 2850,
        trend: "+4.2%",
      },

      {
        mandi: "Rajgangpur Mandi",
        distance: "34 km",
        price: 2780,
        trend: "+2.1%",
      },

      {
        mandi: "Rourkela Mandi",
        distance: "52 km",
        price: 2920,
        trend: "+5.0%",
      },
    ],

    Wheat: [
      {
        mandi: "Sundargarh Mandi",
        distance: "18 km",
        price: 2450,
        trend: "+1.8%",
      },

      {
        mandi: "Rourkela Mandi",
        distance: "52 km",
        price: 2520,
        trend: "+3.1%",
      },

      {
        mandi: "Rajgangpur Mandi",
        distance: "34 km",
        price: 2480,
        trend: "-0.6%",
      },
    ],

    Maize: [
      {
        mandi: "Sundargarh Mandi",
        distance: "18 km",
        price: 2100,
        trend: "+2.4%",
      },

      {
        mandi: "Rajgangpur Mandi",
        distance: "34 km",
        price: 2160,
        trend: "+4.1%",
      },

      {
        mandi: "Rourkela Mandi",
        distance: "52 km",
        price: 2200,
        trend: "+3.7%",
      },
    ],

    Cotton: [
      {
        mandi: "Rajgangpur Mandi",
        distance: "34 km",
        price: 6900,
        trend: "+1.4%",
      },

      {
        mandi: "Rourkela Mandi",
        distance: "52 km",
        price: 7050,
        trend: "+2.8%",
      },

      {
        mandi: "Sundargarh Mandi",
        distance: "18 km",
        price: 6820,
        trend: "-0.9%",
      },
    ],

    Vegetables: [
      {
        mandi: "Sundargarh Mandi",
        distance: "18 km",
        price: 3200,
        trend: "+5.4%",
      },

      {
        mandi: "Rourkela Mandi",
        distance: "52 km",
        price: 3450,
        trend: "+7.1%",
      },

      {
        mandi: "Rajgangpur Mandi",
        distance: "34 km",
        price: 3300,
        trend: "+3.2%",
      },
    ],

    Pulses: [
      {
        mandi: "Sundargarh Mandi",
        distance: "18 km",
        price: 6200,
        trend: "+2.5%",
      },

      {
        mandi: "Rourkela Mandi",
        distance: "52 km",
        price: 6350,
        trend: "+3.3%",
      },

      {
        mandi: "Rajgangpur Mandi",
        distance: "34 km",
        price: 6100,
        trend: "+1.2%",
      },
    ],

    Groundnut: [
      {
        mandi: "Sundargarh Mandi",
        distance: "18 km",
        price: 5900,
        trend: "+2.7%",
      },

      {
        mandi: "Rourkela Mandi",
        distance: "52 km",
        price: 6050,
        trend: "+3.5%",
      },

      {
        mandi: "Rajgangpur Mandi",
        distance: "34 km",
        price: 5820,
        trend: "-0.4%",
      },
    ],

    Sugarcane: [
      {
        mandi: "Sundargarh Mandi",
        distance: "18 km",
        price: 3500,
        trend: "+1.1%",
      },

      {
        mandi: "Rourkela Mandi",
        distance: "52 km",
        price: 3600,
        trend: "+2.0%",
      },

      {
        mandi: "Rajgangpur Mandi",
        distance: "34 km",
        price: 3550,
        trend: "+0.7%",
      },
    ],
  };

  return (
    marketDatabase[
      normalizedCrop
    ] || [
      {
        mandi:
          "Sundargarh Mandi",
        distance: "18 km",
        price: 2500,
        trend: "+1.0%",
      },

      {
        mandi:
          "Rourkela Mandi",
        distance: "52 km",
        price: 2550,
        trend: "+1.5%",
      },

      {
        mandi:
          "Rajgangpur Mandi",
        distance: "34 km",
        price: 2450,
        trend: "-0.5%",
      },
    ]
  );
}