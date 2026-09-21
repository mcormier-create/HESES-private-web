# Chicago Weather Certification

## Selected station

Chicago/O'Hare was selected as the first Chicago station because the U.S. DOE Building Energy Codes Program / PNNL Prototype Building Models explicitly publishes it as the 5A Chicago TMY3 climate location.

- Station: Chicago Ohare Intl Ap
- NOAA/WMO station ID: 725300
- Latitude: 41.98
- Longitude: -87.92
- Elevation: 201 m
- Timezone: UTC-6
- Dataset: NREL TMY3
- Period: 1973-2005 (Generally)
- ASHRAE climate zone: 5A
- Moisture regime: Moist (Cool Humid)
- ASHRAE edition: ANSI/ASHRAE Standard 169-2021
- EPW source: U.S. DOE Building Energy Codes Program / PNNL Prototype Building Models
- Source URL: https://www.energycodes.gov/sites/default/files/2022-09/USA_IL_Chicago-OHare.Intl_.AP_.725300_TMY3.epw
- Local file: public/weather/usa-il-chicago-ohare-725300-tmy3.epw
- SHA-256: c7d4efcf93ba316a1d874352e743df5cf137ba5c0e3459eb2dc4b5442d5b7f5c

## Candidate comparison

- Chicago/O'Hare, 725300: selected. DOE/PNNL TMY3 5A representative Chicago location; airport location northwest of the Chicago central business district and explicitly used by the DOE prototype weather set.
- Chicago Midway, 725340: relevant urban Chicago airport alternative; not selected because the DOE/PNNL prototype TMY3 set used for this baseline identifies O'Hare as its Chicago 5A representative location.
- DuPage, 725305: regional suburban airport alternative; not selected because it is not the DOE/PNNL prototype Chicago 5A location used for this baseline.

The candidate alternatives remain documented for future comparison. No alternative file was downloaded or connected.

## EPW validation

The selected source file passes `epwImportService` validation:

- 8,760 source records
- 8,760 normalized HESA records
- Uniform source minute convention: 0
- Normalized HESA minute: 0
- 35 hourly fields per record
- No sentinels or empty required values
- No duplicate timestamps
- No continuity errors
- Normal-year calendar

## USA-only HVAC boundary

Chicago reuses the validated USA hourly architecture and the USA-only Humifog activation guard in `src/services/hourlyWeatherSimulation.js`. The guard is not propagated to `hesa-v1.1-stable` or the Canada worktree.
