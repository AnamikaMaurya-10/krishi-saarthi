export function buildAdvisory(farmer: {
  crop: string;
  district: string;
  language: string;
}) {
  const common = [
    "Check field drainage after rainfall.",
    "Avoid unnecessary pesticide or fertilizer application before checking crop conditions.",
    "Compare at least two nearby mandi prices before selling."
  ];

  const cropAdvice: Record<string, string[]> = {
    Paddy: [
      "Keep standing water controlled and inspect for leaf discoloration.",
      "If heavy rain is expected, clear field outlets to prevent prolonged waterlogging."
    ],
    Wheat: [
      "Monitor soil moisture and avoid irrigation if the topsoil is already wet.",
      "Inspect for rust or fungal symptoms during humid periods."
    ],
    Maize: [
      "Check for stem and leaf damage after strong winds.",
      "Maintain drainage around the root zone."
    ]
  };

  const advice = [...(cropAdvice[farmer.crop] ?? ["Inspect the crop daily for visible stress."]), ...common];

  if (farmer.language === "Hindi") {
    return {
      title: "आज की खेती सलाह",
      items: [
        "बारिश के बाद खेत में पानी की निकासी जांचें।",
        "फसल की स्थिति देखे बिना अनावश्यक दवा या खाद न डालें।",
        "बेचने से पहले कम से कम दो मंडियों के भाव की तुलना करें।"
      ],
      voiceText: "आज की खेती सलाह: बारिश के बाद खेत में पानी की निकासी जांचें और मंडी भाव की तुलना करें।"
    };
  }

  if (farmer.language === "Odia") {
    return {
      title: "ଆଜିର କୃଷି ପରାମର୍ଶ",
      items: [
        "ବର୍ଷା ପରେ ଜମିରୁ ପାଣି ନିଷ୍କାସନ ଯାଞ୍ଚ କରନ୍ତୁ।",
        "ଫସଲର ଅବସ୍ଥା ଦେଖିବା ପୂର୍ବରୁ ଅନାବଶ୍ୟକ ଔଷଧ କିମ୍ବା ସାର ଦିଅନ୍ତୁ ନାହିଁ।",
        "ବିକ୍ରି ପୂର୍ବରୁ ଅତି କମରେ ଦୁଇଟି ମଣ୍ଡିର ଦର ତୁଳନା କରନ୍ତୁ।"
      ],
      voiceText: "ଆଜିର କୃଷି ପରାମର୍ଶ: ବର୍ଷା ପରେ ଜମିରୁ ପାଣି ନିଷ୍କାସନ ଯାଞ୍ଚ କରନ୍ତୁ।"
    };
  }

  return {
    title: "Today's Crop Advisory",
    items: advice,
    voiceText: advice.join(" ")
  };
}
