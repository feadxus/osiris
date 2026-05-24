# Market Research GIS Sources

OSIRIS now includes a metadata-first market research source catalog. It is a curated index of APIs and dataset families that can support CPG, pharma, finance, policymaking, and live-risk GIS workflows.

The catalog intentionally separates source metadata from live connectors. Many authoritative market datasets are annual, quarterly, monthly, or release-calendar based. The live layers are mainly weather, hazards, market prices, filings, news/events, alerts, and some commercial mobility or place APIs.

## UI Surface

- Open the desktop `MARKET SOURCES` panel under `MARKETS & INTEL`.
- On mobile, open the `MARKETS` drawer to see the same source catalog.
- Toggle `DATA LAYERS / MARKET RESEARCH / Market Sources` to show or hide source markers on the map.
- Use `LOCATE` in the catalog panel to fly the map to the source/provider marker.
- Use `DOCS` or map popups to open official API documentation.

## Map Semantics

The map markers represent provider or program locations, not the underlying observation geography. For example, the marker for IPUMS points to the University of Minnesota, while the indexed datasets cover U.S. geographies. Every catalog record carries this caveat explicitly.

## Source Families

- GIS backbone: IPUMS NHGIS, Census APIs, TIGERweb, OpenStreetMap Overpass, Overture Maps, Data.gov, Socrata, ArcGIS REST, Census Geocoder.
- CPG and retail: Foursquare, Placer.ai, SafeGraph, USDA FoodData Central, NASS Quick Stats, CBP/ZBP, LEHD/LODES, BLS, UN Comtrade.
- Pharma and health: openFDA, ClinicalTrials.gov, CDC PLACES, CMS Data, NPPES NPI Registry, HealthData.gov, RxNorm, FDA recalls.
- Finance, macro, and real estate: SEC EDGAR, FRED, GeoFRED, BEA, CFPB HMDA, USAspending, EIA, OpenFIGI, Polygon.io, FHFA HPI.
- Policy and regulation: Congress.gov, Federal Register, Regulations.gov, FEC, OpenStates, SAM.gov, GovInfo, state/local open data portals.
- Live risk: GDELT, NWS, USGS Earthquakes, NASA FIRMS, OpenAQ, AirNow, ReliefWeb, ACLED, OpenFEMA, GDACS.

## Verification

Run:

```bash
npm run verify:market-sources
```

The command validates catalog records, checks the route and static UI wiring, starts a local Next dev server, verifies `/api/market-sources`, and drives a headless Chrome session to click the catalog filters and map layer toggle.
