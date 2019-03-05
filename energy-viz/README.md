## Data Generation

Download Form EIA-923 for 2007-2017, and similar EIA-906 for 2001-2006
Save "Page 1" as CSV, named "generation.csv" and with all lines before the column headers stripped
Run "csv_clean.sh" to normalize headers
Download Form EIA-860 for 2017 (I think/hope this includes closed plants so can be mapped against previous years)
Save as CSV

:point_up: This took me about an hour to run manually, mainly constrained by the time it takes to open up each giant excel file.

At this point, you should have [year]/netgen.csv for 2001-2017 in a "CSV" folder, along with "plant_locations.csv" from EIA-860.

Run "create_geojson.js" to create a single (large) GeoJSON file ("plant_generation.geojson") with plant data for every month from 2001-2017.

Create clustered tileset with tippecanoe:

`tippecanoe -zg -o us_electricity_generation.mbtiles -r1 --cluster-distance=4 --accumulate-attribute=netgen_[year]_[month]:sum plant_generation.geojson`

Make all the accumulation arguments with:
```
var quarters = []; for (var year = 2001; year <= 2017; year++) {
    for (var quarter = 0; quarter <= 3; quarter++) {
        quarters.push(`netgen_${year}_${quarter}`);
    }
}

var fuel_type = 9;
var fuel_name = "petroleum";

var mapFn = `(props) => (props.fuel_type == ${fuel_type} ? {fuel_type: props.fuel_type,`;
mapFn += quarters.map((quarter) => `${quarter}: props.${quarter}`).join(", ");
mapFn += "} : {})";

var reduceFn = "(accumulated, props) => {";
reduceFn += `accumulated = accumulated || {}; if (props.fuel_type !== ${fuel_type}) return; accumulated.fuel_type = props.fuel_type;`;
reduceFn += quarters.map((quarter) => `accumulated.${quarter} = (accumulated.${quarter} || 0) + (props.${quarter} || 0)`).join('; ');
reduceFn += "}";

var filterFn = `(props) => props.fuel_type == ${fuel_type}`;

console.log(`node supertiler.js -i quarterly_generation.geojson -o ${fuel_name}_clustered.mbtiles --includeUnclustered false --minZoom 0 --maxZoom 10 --radius 32 --extent 8192 --filter "${filterFn}" --map "${mapFn}" --reduce "${reduceFn}"`);
```
