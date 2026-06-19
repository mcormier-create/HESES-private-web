export function createHvacReportModel(inputs, metrics) {
  return {
    generatedAt: new Date().toISOString(),
    project: 'HVAC Enersol Report',
    inputs,
    summary: {
      humidificationLoad: metrics.correctedHumidificationLoad,
      steamEnergyKW: metrics.steamEnergyKW,
      adiabaticEnergyKW: metrics.adiabaticEnergyKW,
      annualSteamCost: metrics.annualSteamCost,
      annualAdiabaticCost: metrics.annualAdiabaticCost,
      savings: metrics.savings,
      eliminatedGES: metrics.eliminatedGES,
    },
  }
}
