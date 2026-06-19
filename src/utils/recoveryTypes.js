export function toRecoveryType(recovery) {
  if (!recovery) return null

  const name = recovery.nom || ''

  if (
    name.includes('Roue') ||
    name.includes('Wheel') ||
    name.includes('enthalpique') ||
    name.includes('Enthalpy Cassette')
  ) {
    return 'ENTHALPY_WHEEL'
  }

  if (name.includes('cassette sensible') || name.includes('Sensible Cassette')) {
    return 'SENSIBLE_WHEEL'
  }

  if (name.includes('Thermopompe') || name.includes('Heat Pump')) {
    return 'HEAT_PUMP'
  }

  if (name.includes('Boucle') || name.includes('Loop')) {
    return 'GLYCOL'
  }

  return 'PLATE'
}
