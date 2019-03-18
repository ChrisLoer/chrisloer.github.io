## Data Generation

- Download Form EIA-923 for 2007-2017, and similar EIA-906 for 2001-2006
- Save "Page 1" as CSV, named `generation.csv` and with all lines before the column headers stripped
- Run `csv_clean.sh` to normalize headers
- Download Form EIA-860 for 2017 (I think/hope this includes closed plants so can be mapped against previous years)
- Save as CSV

:point_up: This took me about an hour to run manually, mainly constrained by the time it takes to open up each giant excel file.

At this point, you should have `[year]/netgen.csv` for 2001-2017 in a `CSV` folder, along with `plant_locations.csv` from EIA-860.

Run `node create_geojson.js` to create three large GeoJSON files (`plant_generation.geojson`, `quarterly_generation.geojson`, and `plant_labels.geojson`) with plant data for every month from 2001-2017. The script also uses <a href="https://github.com/ChrisLoer/supertiler">Supertiler</a> to turn the quarterly generation data into clustered MBTiles data sets (one per fuel-type, and one for all fuel-types).

Then upload `plant_generation.geojson`, `plant_labels.geojson`, and the 10 clustered MBTiles files to Mapbox, and copy the data source URLs into `index.html`.
