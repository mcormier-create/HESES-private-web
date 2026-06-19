export const systemImages = {
  basic: '/system-images/100-air-exterieur-humifog.png',
  fallback: '/system-images/fallback-hvac.png',
  humifog: '/system-images/humifog.png',
  heatingCoilHumifog: '/system-images/serpentin-chauffage-humifog.png',
  thermalWheel: '/system-images/roue-thermique-humifog.png',
  thermalWheelHumifog: '/system-images/roue-thermique-humifog.png',
  thermalWheelHeatingHumifog: '/system-images/roue-thermique-humifog.png',
  thermalWheelHumifogHeatPump: '/system-images/roue-thermique-humifog.png',
  crossflow: '/system-images/debit-croise-humifog.png',
  crossflowHumifog: '/system-images/debit-croise-humifog.png',
  crossflowHeating: '/system-images/debit-croise-humifog.png',
  crossflowHeatPump: '/system-images/debit-croise-humifog.png',
  crossflowHumifogHeatPump: '/system-images/debit-croise-humifog.png',
  cassette: '/system-images/cassette-humifog.png?v=20260615-cassette',
  cassetteSensible: '/system-images/cassette-humifog.png?v=20260615-cassette',
  cassetteEnthalpy: '/system-images/cassette-humifog.png?v=20260615-cassette',
  cassetteHumifog: '/system-images/cassette-humifog.png?v=20260615-cassette',
  glycolLoop: '/system-images/boucle-glycolee-humifog.png',
  glycolLoopHumifog: '/system-images/boucle-glycolee-humifog.png',
  freeCooling: '/system-images/free-cooling-humifog.png?v=20260618-free-cooling-mixing-schematic',
  freeCoolingHumifog: '/system-images/free-cooling-humifog.png?v=20260618-free-cooling-mixing-schematic',
  freeCoolingHumifogHeating: '/system-images/free-cooling-humifog.png?v=20260618-free-cooling-mixing-schematic',
}

export const thermalWheelSystemTypeImages = {
  roue_thermique: systemImages.thermalWheel,
  roue_thermique_humifog: systemImages.thermalWheelHumifog,
  roue_thermique_chauffage_humifog: systemImages.thermalWheelHeatingHumifog,
  roue_thermique_humifog_thermopompe: systemImages.thermalWheelHumifogHeatPump,
}

export const crossflowSystemTypeImages = {
  debit_croise: systemImages.crossflow,
  debit_croise_humifog: systemImages.crossflowHumifog,
  debit_croise_chauffage: systemImages.crossflowHeating,
  debit_croise_thermopompe: systemImages.crossflowHeatPump,
  debit_croise_humifog_thermopompe: systemImages.crossflowHumifogHeatPump,
}

export const cassetteSystemTypeImages = {
  cassette: systemImages.cassette,
  cassette_sensible: systemImages.cassetteSensible,
  cassette_enthalpique: systemImages.cassetteEnthalpy,
  cassette_humifog: systemImages.cassetteHumifog,
  cassette_chauffage_humifog: systemImages.cassetteHumifog,
  cassette_humifog_thermopompe: systemImages.cassetteHumifog,
}

export const glycolLoopSystemTypeImages = {
  boucle_glycolee: systemImages.glycolLoop,
  boucle_glycolee_humifog: systemImages.glycolLoopHumifog,
  boucle_glycolee_chauffage_humifog: systemImages.glycolLoopHumifog,
  glycol_loop: systemImages.glycolLoop,
  run_around_coil: systemImages.glycolLoop,
}

export const freeCoolingSystemTypeImages = {
  free_cooling: systemImages.freeCooling,
  free_cooling_humifog: systemImages.freeCoolingHumifog,
  free_cooling_chauffage: systemImages.freeCoolingHumifogHeating,
  free_cooling_humifog_chauffage: systemImages.freeCoolingHumifogHeating,
}

export const systemSchematics = {
  outsideAirBasic: {
    id: 'outsideAirBasic',
    imageSrc: systemImages.basic,
    modeLabel: '100 % air extérieur',
    recoveryLabel: 'Aucune récupération',
    recoveryPointLabel: 'Après filtration',
    sequence: ['Air extérieur', 'Filtres', 'Chauffage', 'Humifog', 'Ventilateur', 'Air alimentation'],
  },
  thermalWheelHumifog: {
    id: 'thermalWheelHumifog',
    imageSrc: systemImages.thermalWheel,
    modeLabel: 'CTA avec retour/extraction',
    recoveryLabel: 'Roue thermique',
    recoveryPointLabel: 'Après roue thermique',
    sequence: ['Air extérieur', 'Air retour', 'Roue thermique', 'Chauffage', 'Humifog', 'Ventilateur'],
  },
  crossflowHumifog: {
    id: 'crossflowHumifog',
    imageSrc: systemImages.crossflow,
    modeLabel: 'CTA avec retour/extraction',
    recoveryLabel: 'Échangeur à débit croisé',
    recoveryPointLabel: 'Après échangeur à débit croisé',
    sequence: ['Air extérieur', 'Air rejeté', 'Échangeur à débit croisé', 'Chauffage', 'Humifog', 'Ventilateur'],
  },
  cassetteHumifog: {
    id: 'cassetteHumifog',
    imageSrc: systemImages.cassette,
    modeLabel: 'CTA avec retour/extraction',
    recoveryLabel: 'Échangeur à cassettes',
    recoveryPointLabel: 'Après échangeur à cassettes',
    sequence: ['Air extérieur', 'Air rejeté', 'Échangeur à cassettes', 'Chauffage', 'Humifog', 'Ventilateur'],
  },
  glycolLoopHumifog: {
    id: 'glycolLoopHumifog',
    imageSrc: systemImages.glycolLoop,
    modeLabel: 'CTA avec retour/extraction',
    recoveryLabel: 'Boucle glycolée',
    recoveryPointLabel: 'Après boucle glycolée',
    sequence: ['Air extérieur', 'Air rejeté', 'Boucle glycolée', 'Chauffage', 'Humifog', 'Ventilateur'],
  },
  freeCoolingHumifog: {
    id: 'freeCoolingHumifog',
    imageSrc: systemImages.freeCooling,
    modeLabel: 'Free Cooling + retour air',
    recoveryLabel: 'Aucune récupération thermique',
    recoveryPointLabel: 'Après mélange',
    sequence: ['Air extérieur modulé', 'Air retour modulé', 'Mélange', 'Humifog', 'Réchauffage', 'Air alimentation'],
  },
}

export const schematicReplacementOrder = [
  systemSchematics.outsideAirBasic,
  systemSchematics.thermalWheelHumifog,
  systemSchematics.crossflowHumifog,
  systemSchematics.cassetteHumifog,
  systemSchematics.glycolLoopHumifog,
  systemSchematics.freeCoolingHumifog,
]

export function resolveSystemSchematicId({ recoveryGroup, isFreeCoolingMode }) {
  if (isFreeCoolingMode) return 'freeCoolingHumifog'

  return {
    WHEEL: 'thermalWheelHumifog',
    CROSSFLOW: 'crossflowHumifog',
    CASSETTE: 'cassetteHumifog',
    GLYCOL: 'glycolLoopHumifog',
    BASIC: 'outsideAirBasic',
    NONE: 'outsideAirBasic',
  }[recoveryGroup] || 'outsideAirBasic'
}

export function getSystemSchematic(schematicId) {
  return systemSchematics[schematicId] || systemSchematics.outsideAirBasic
}
