# New York pilot weather certification

## Selected weather station

HESA USA uses John F. Kennedy International Airport as the certified but not connected New York pilot station.

The selection is based on the U.S. Department of Energy Building Energy Codes Program and Pacific Northwest National Laboratory prototype-building weather set. DOE/PNNL explicitly uses New York/John F. Kennedy International Airport as the representative EnergyPlus TMY3 location for ASHRAE climate zone 4A.

## Candidate comparison

- John F. Kennedy International Airport, station 744860: selected because DOE/PNNL uses this station as the New York representative for building-energy prototype simulations. Its coastal Queens location can be more marine-moderated than Manhattan or the Bronx.
- Central Park Observatory / Belvedere Castle, station 725053: geographically and climatically relevant to Manhattan, but its park setting does not fully represent dense street-canyon conditions.
- LaGuardia Airport, station 725030: closer to central New York City and a credible airport station, but it is not the DOE/PNNL 4A prototype location.
- Newark Liberty International Airport, station 725020: a relevant metropolitan alternative for west-side and New Jersey projects, but it is outside New York City.

## Weather provenance

- Dataset: NREL TMY3.
- Embedded period statement: 1973-2005 (Generally).
- Source: U.S. DOE Building Energy Codes Program / PNNL Prototype Building Models.
- Source URL: https://www.energycodes.gov/sites/default/files/2023-10/USA_NY_New.York-John.F.Kennedy.Intl_.AP_.744860_TMY3.epw
- Repository file: `public/weather/usa-ny-new-york-jfk-744860-tmy3.epw`.
- SHA-256: `821f2f1a2d5f462955b41597df0bf247f981b7c61d9032f4696eed68cd892537`.

The EPW is stored for certification only. It is not connected to HESA weather selection or annual energy calculations.

## Climate-zone provenance

- Climate zone: 4A.
- Moisture regime: A, Moist / Mixed Humid.
- Standard: ANSI/ASHRAE Standard 169-2021.
- ASHRAE source: https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021
- DOE/PNNL corroboration: https://www.energycodes.gov/prototype-building-models

Weather-file provenance and ASHRAE climate-zone provenance remain separate in the station manifest.
