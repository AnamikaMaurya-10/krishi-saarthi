export function getWeather(district: string) {
  const map: Record<string, any> = {
    Sundargarh: {
      district,
      temperature: 28,
      rainfallNext24h: 34,
      rainfallDeviation: -34,
      condition: "Cloudy",
      warning: "Heavy rainfall possible in the next 24–48 hours."
    },
    Bargarh: {
      district,
      temperature: 29,
      rainfallNext24h: 18,
      rainfallDeviation: -12,
      condition: "Partly cloudy",
      warning: "Moderate rain possible. Monitor soil moisture."
    }
  };
  return map[district] ?? {
    district,
    temperature: 30,
    rainfallNext24h: 22,
    rainfallDeviation: -10,
    condition: "Partly cloudy",
    warning: "Monitor rainfall and field moisture."
  };
}

export function getMarket(crop: string) {
  const base: Record<string, number> = { Paddy: 2260, Wheat: 2480, Maize: 2180, Cotton: 6900 };
  const current = base[crop] ?? 2200;
  return [
    { mandi: "Bargarh Mandi", price: current, distance: "38 km", trend: "+4.2%" },
    { mandi: "Sambalpur Mandi", price: current - 85, distance: "72 km", trend: "-1.8%" },
    { mandi: "Sundargarh Mandi", price: current - 130, distance: "54 km", trend: "-3.1%" }
  ];
}
