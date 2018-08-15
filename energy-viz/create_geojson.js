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
for (let i = 0; i < 12; i++) {
  byMonthFuelType[i] = {};
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

var generationRecords = parse(fs.readFileSync('net_gen_and_fuel.csv'), {columns: true});
generationRecords.forEach(function(record) {
  const plant = plants[record.plant_code]
  if (!plant) {
    // Only use plants we have in both data sets.
    // It looks like the net_gen data set has a lot of placeholder entries that aren't actually plants
    return;
  }
  plant.fuel_type = record.fuel_type;
  if (!plant.fuel_type) {
    console.log(`No plant fuel type for ${plant.plant_code}`);
  }
  const netgen = parseInt(record.net_gen.replace(/,/g, ''));
  plant.net_gen = netgen ? netgen : 0;
  for (let i = 0; i < 12; i++) {
    const index = "netgen_" + i;
    const netgen_month = parseInt(record[index].replace(/,/g, ''));
    plant[index] = netgen_month ? netgen_month : 0;
    byMonthFuelType[i][plant.fuel_type] = (byMonthFuelType[i][plant.fuel_type] || 0) + plant[index];
  }
  balancingAuthorities[plant.ba_code].totalGeneration += plant.net_gen;
  byFuelType[plant.fuel_type] = (byFuelType[plant.fuel_type] || 0) + plant.net_gen;
  totalGeneration += plant.net_gen;
});


const geojson = GeoJSON.parse(Object.values(plants), { Point: ['latitude', 'longitude']});
jsonfile.writeFile('plant_generation.geojson', geojson, function (err) {
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
