'use strict';

const parse = require('csv-parse/lib/sync');
const fs = require('fs');
const async = require('async');
const GeoJSON = require('geojson');
const jsonfile = require('jsonfile');
const supertiler = require('supertiler');

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
*/

const fuelNameMap = {
    0: 'Gas',
    1: 'Coal',
    2: 'Nuclear',
    3: 'Hydro',
    4: 'Wind',
    5: 'Solar',
    6: 'RenewableCarbon',
    7: 'Other',
    8: 'Geothermal',
    9: 'Petroleum',
    10: 'All'
};

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
    //ba_code: record.balancing_authority_code,
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
      let plant = plants[record.plant_code]
      if (!plant) {
        // Only use plants we have in both data sets.
        // It looks like the net_gen data set has a lot of placeholder entries that aren't actually plants
        console.log(`Discarding plant ${record.plant_code} because we don't have a location for it.`);
        return;
      }
      if (!record.fuel_type) {
        console.log(`No plant fuel type for ${plant.plant_code}`);
      }
      let recordFuel = fuelTypeMap[record.fuel_type];
      if (typeof recordFuel === 'undefined') {
          console.log(`${record.fuel_type} not recognized`);
          recordFuel = 7;
      }
      if (plant.multi_fuel) {
          // We've found records with multiple fuel types for this plant, so look up the plant by subtype
          const plantCode = `${record.plant_code}-${recordFuel}`;
          console.log(`Creating new multi_fuel plant ${plantCode}`);

          // If this type hasn't been seen before, copy from the base
          if (!plants[plantCode]) {
              plants[plantCode] = {
                plant_code: plantCode,
                //ba_code: plant.ba_code,
                latitude: plant.latitude,
                longitude: plant.longitude,
                fuel_type: recordFuel
              };
          }
          plant = plants[plantCode];
      } else if (!plant.fuel_type) {
          // First record, record the fuel type
          plant.fuel_type = recordFuel;
      } else if (plant.fuel_type !== recordFuel) {
          // First time we've found a second fuel type, split the records
          const originalPlantCode = plant.plant_code;
          const firstFuelCode = `${originalPlantCode}-${plant.fuel_type}`;
          plant.plant_code = firstFuelCode;
          // Move original to new location
          console.log(`Copying multi_fuel plant ${firstFuelCode}`);
          plants[firstFuelCode] = plant;
          // Create multi-fuel placeholder for parent
          plants[originalPlantCode] = {
            plant_code: originalPlantCode,
            //ba_code: plant.ba_code,
            latitude: plant.latitude,
            longitude: plant.longitude,
            multi_fuel: true
          };
          // Create child for new fuel type, assign it to "plant"
          const secondFuelCode = `${originalPlantCode}-${recordFuel}`;
          console.log(`Splitting multi_fuel plant ${secondFuelCode}`);
          plant = plants[secondFuelCode] = {
            plant_code: secondFuelCode,
            //ba_code: plant.ba_code,
            latitude: plant.latitude,
            longitude: plant.longitude,
            fuel_type: recordFuel
          };
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
            //balancingAuthorities[plant.ba_code].totalGeneration += netgen_month;
            byFuelType[plant.fuel_type] = (byFuelType[plant.fuel_type] || 0) + netgen_month;
            totalGeneration += netgen_month;
        }
      }
    });
}

const plantsWithNetgen = Object.values(plants).filter(plant => plant.hasNetGen && !plant.multi_fuel); // Filter out "multi_fuel" plants because there will be children for each fuel typee
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

// Splitting plant labels into a different source from plant-generation duplicates some data
// but allows us to avoid expensive label re-generation on every date change.
const plantLabels = [];
for (const plant of plantsWithNetgen) {
    plantLabels.push({
        latitude: plant.latitude,
        longitude: plant.longitude,
        fuel_type: plant.fuel_type,
        netgen: plant.netgen,
        name: plant.name
    });
}

plantsWithNetgen.forEach(plant => {
    // No longer necessary since it's been split out to plantLabels data
    delete plant.name;
    delete plant.netgen;
});

const geojson = GeoJSON.parse(plantsWithNetgen, { Point: ['latitude', 'longitude']});
jsonfile.writeFile('plant_generation.geojson', geojson, function (err) {
    if (err) throw err;
});

const quarterlyGeojson = GeoJSON.parse(quarterlyPlants, { Point: ['latitude', 'longitude']});
jsonfile.writeFile('quarterly_generation.geojson', quarterlyGeojson, function (err) {
    if (err) throw err;
    supertile();
});

const labelGeojson = GeoJSON.parse(plantLabels, { Point: ['latitude', 'longitude']});
jsonfile.writeFile('plant_labels.geojson', labelGeojson, function (err) {
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

function supertile() {
    // Use supertiler to take quarterly_generation.geojson to 10 per-fuel type mbtiles files, adapted from original command line arguments

    var quarters = []; for (var year = 2001; year <= 2017; year++) {
        for (var quarter = 0; quarter <= 3; quarter++) {
            quarters.push(`netgen_${year}_${quarter}`);
        }
    }

    for (let fuel_type = 0; fuel_type <= 10; fuel_type++) {
        var fuel_name = fuelNameMap[fuel_type];

        var mapFn = (props) => {
            if (fuel_type == 10 || props.fuel_type == fuel_type) {
                const mapped = fuel_type == 10 ? {} : { fuel_type };
                quarters.forEach((quarter) => mapped[quarter] = props[quarter]);
                return mapped;
            } else {
                return {};
            }
        };

        var reduceFn = (accumulated, props) => {
            accumulated = accumulated || {};
            if (fuel_type != 10) {
                if (props.fuel_type !== fuel_type)
                    return;
                accumulated.fuel_type = props.fuel_type;;
            }
            quarters.forEach((quarter) => {
                accumulated[quarter] = (accumulated[quarter] || 0) + (props[quarter] || 0);
            });
        };

        var filterFn = fuel_type == 10 ?
                        null :
                        (props) => props.fuel_type == fuel_type;
        supertiler({
            input: 'quarterly_generation.geojson',
            output: `${fuel_name}_clustered.mbtiles`,
            includeUnclustered: false,
            minZoom: 0,
            maxZoom: 10,
            radius: 32,
            extent: 8192,
            filter: filterFn,
            map: mapFn,
            reduce: reduceFn,
        });

    }
}
