# HESA USA EPW import policy

This policy applies to the non-HVAC EPW import adapter only.

- 8,760 hourly records represent one complete normal year.
- 8,784 hourly records represent one complete leap year and must include February 29.
- The adapter certifies 8,784 records as a staging weather contract. It must not be connected to the current HESA consumer while that consumer requires exactly 8,760 records.
- Exactly one observation per hour is required.
- Standard hourly EPW records must contain all 35 fields and use one consistent minute convention, either 0 or 60.
- EnergyPlus documents minute values `0..60`; HESA accepts recognized uniform hourly conventions 0 or 60.
- The adapter retains EPW year, month, day, and hour and normalizes minute to 0. HESA already maps EPW hour labels 1-24 to intervals 0-23.
- The source minute convention remains available in import metadata. No hour is shifted, added, removed, or duplicated.

## USA/Canada HVAC boundary

The USA branch contains a USA-only activation guard in `src/services/hourlyWeatherSimulation.js`: the Humifog pump is enabled only when the corrected Humifog humidification load is positive. This intentional USA difference is not propagated automatically to `hesa-v1.1-stable` or the Canada worktree.
- Records must run continuously from January 1, hour 1 through December 31, hour 24.
- Duplicate, missing, reordered, or invalid timestamps are rejected.
- HESA does not silently remove, interpolate, duplicate, or repair hours.
- Unsupported files return an `EpwImportError` with a structured quality report.

Synthetic regression fixtures are test data only. They are not weather data for New York or any other real location.
