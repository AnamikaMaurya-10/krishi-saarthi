export interface RiskInput {
  rainfallDeviation: number;
  priceChange: number;
  loanDays: number;
}

export function calculateRisk(input: RiskInput) {
  const rainfallRisk = Math.min(100, Math.max(0, Math.abs(Math.min(0, input.rainfallDeviation)) * 2.2));
  const priceRisk = Math.min(100, Math.max(0, Math.abs(Math.min(0, input.priceChange)) * 3.5));
  const loanRisk =
    input.loanDays <= 7 ? 100 :
    input.loanDays <= 15 ? 85 :
    input.loanDays <= 30 ? 65 :
    input.loanDays <= 60 ? 35 : 10;

  const score = Math.round(rainfallRisk * 0.4 + priceRisk * 0.35 + loanRisk * 0.25);
  const level = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";

  return {
    score,
    level,
    factors: {
      rainfall: Math.round(rainfallRisk),
      market: Math.round(priceRisk),
      loan: loanRisk
    }
  };
}
