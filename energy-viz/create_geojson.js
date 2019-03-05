'use strict';

const parse = require('csv-parse/lib/sync');
const fs = require('fs');
const async = require('async');
const GeoJSON = require('geojson');
const jsonfile = require('jsonfile');

const plants = {};
const balancingAuthorities = {};
const byFuelType = {};
const byMonthFuelType = {};

for (var year = 2001; year <= 2017; year++) {
    for (let month = 0; month < 12; month++) {
        byMonthFuelType[`netgen_${year}_${month}`] = {};
    }
}


/*
From "energy source prime movers" by EIA

0: Gas
1: Coal
2: Nuclear
3: Hydro
4: Wind
5: Solar
6: Renewable Hydrocarbon
7: Other
8: Geothermal
9: Petroleum

*/

let fuelTypeMap = {
    'NG': 0,
    'SUB': 1,
    'NUC': 2,
    'WAT': 3,
    'WND': 4,
    'RC': 1,
    'LIG': 1,
    'SUN': 5,
    'WDS': 6,
    'BLQ': 6,
    'GEO': 8,
    'OG': 0,
    'MSB': 7,
    'MSN': 7,
    'WC': 1,
    'SGC': 1,
    'WH': 7,
    'DFO': 6,
    'BFG': 0,
    'PUR': 7,
    'OBG': 6,
    'ANT': 1,
    'BIT': 1,
    'DFO': 9,
    'JF': 9,
    'KER': 9,
    'PC': 9,
    'PG': 9,
    'RFO': 9,
    'SGP': 9,
    'WO': 9,
    'AB': 6,
    'MSW': 6,
    'OBS': 6,
    'OBL': 6,
    'SLW': 6,
    'WDL': 6,
    'LFG': 6,
    'MWH': 7,
    'TDF': 7,
    'OTH': 7,
    'SC': 7
}

let totalGeneration = 0;

var locationRecords = parse(fs.readFileSync('plant_locations.csv'), {columns: true});
locationRecords.forEach(function(record) {
  if (!record.plant_code || !record.balancing_authority_code || !record.latitude || !record.longitude) {
    //console.log(`Skipping plant ${record.plant_code}, ${record.balancing_authority_code}, ${record.latitude}, ${record.longitude}`);
    return;
  }
  plants[record.plant_code] = {
    plant_code: record.plant_code,
    ba_code: record.balancing_authority_code,
    latitude: record.latitude,
    longitude: record.longitude
  };
  if (!balancingAuthorities[record.balancing_authority_code]) {
    balancingAuthorities[record.balancing_authority_code] = { totalGeneration: 0 };
  }
});

for (var year = 2001; year <= 2017; year++) {
    console.log(`Parsing records for year ${year}`);
    var generationRecords = parse(fs.readFileSync(`CSV/${year}/netgen.csv`), {columns: true});
    generationRecords.forEach(function(record) {
      const plant = plants[record.plant_code]
      if (!plant) {
        // Only use plants we have in both data sets.
        // It looks like the net_gen data set has a lot of placeholder entries that aren't actually plants
        console.log(`Discarding plant ${record.plant_code} because we don't have a location for it.`);
        return;
      }

      if (!record.fuel_type) {
        console.log(`No plant fuel type for ${plant.plant_code}`);
      }
      plant.fuel_type = fuelTypeMap[record.fuel_type];
      if (typeof plant.fuel_type === 'undefined') {
          console.log(`${record.fuel_type} not recognized`);
          plant.fuel_type = 7;
      }
      plant.name = record.plant_name;
      for (let month = 0; month < 12; month++) {
        const monthIndex = `netgen_${month}`; // Input CSV is indexed by month
        const netgen_month = parseInt(record[monthIndex].replace(/,/g, ''));

        const yearMonthIndex = `netgen_${year}_${month}`; // Output GeoJSON stores generation by year/month
        plant[yearMonthIndex] = (plant[yearMonthIndex] || 0) + netgen_month ? netgen_month : 0;

        // Collect statistics
        if (netgen_month > 0) {
            plant.hasNetGen = true;
            plant.netgen = (plant.netgen || 0) + netgen_month;
            byMonthFuelType[yearMonthIndex][plant.fuel_type] = (byMonthFuelType[yearMonthIndex][plant.fuel_type] || 0) + plant[yearMonthIndex];
            balancingAuthorities[plant.ba_code].totalGeneration += netgen_month;
            byFuelType[plant.fuel_type] = (byFuelType[plant.fuel_type] || 0) + netgen_month;
            totalGeneration += netgen_month;
        }
      }
    });
}

const plantsWithNetgen = Object.values(plants).filter(plant => plant.hasNetGen);
plantsWithNetgen.sort((a, b) => b.netgen - a.netgen);

// We're splitting into two data sources. For high zoom, we'll include monthly data, along with plant names and other metadata
// For lower zooms (where plants will be clustered anyway), we cut down to just location and quarterly generation.
const quarterlyPlants = [];
for (const plant of plantsWithNetgen) {
    const copiedPlant = {
        latitude: plant.latitude,
        longitude: plant.longitude,
        fuel_type: plant.fuel_type
    };
    for (var year = 2001; year <= 2017; year++) {
        for (let month = 0; month < 12; month++) {
            const yearMonthIndex = `netgen_${year}_${month}`;
            const yearQuarterIndex = `netgen_${year}_${Math.floor(month / 3)}`;

            copiedPlant[yearQuarterIndex] = (copiedPlant[yearQuarterIndex] || 0) + (plant[yearMonthIndex] || 0);
        }
    }
    quarterlyPlants.push(copiedPlant);
}

const geojson = GeoJSON.parse(plantsWithNetgen, { Point: ['latitude', 'longitude']});
jsonfile.writeFile('plant_generation.geojson', geojson, function (err) {
    if (err) throw err;
});

const quarterlyGeojson = GeoJSON.parse(quarterlyPlants, { Point: ['latitude', 'longitude']});
jsonfile.writeFile('quarterly_generation.geojson', quarterlyGeojson, function (err) {
    if (err) throw err;
});

var fuelTypes = Object.entries(byFuelType);
fuelTypes.sort(function(a, b) {
    return b[1] - a[1];
});
var html = "<select>\n"
fuelTypes.forEach(function(fuelType) {
    html += `<option value="${fuelType[0]}">${fuelType[0]} (${fuelType[1] / 1000000})</option>\n`
});
html += "</select>\n";
console.log(html);

console.log(JSON.stringify(byMonthFuelType));

console.log(JSON.stringify(byFuelType));
console.log(totalGeneration);
