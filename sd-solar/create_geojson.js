'use strict';

const parse = require('csv-parse/lib/sync');
const fs = require('fs');
const async = require('async');
const GeoJSON = require('geojson');
const jsonfile = require('jsonfile');

const allRecords = {};
const installerMap = { 'small installers': 0 };
let allInstallations = 0;

const renames = {
    'russell clapton': 'vivint solar',
    'miranda gibbons': 'sunrun solar',
    'amanda strout': 'vivint solar',
    'solar vivint': 'vivint solar',
    'jesse ober': 'asi hastings',
    'sunrun installation services': 'sunrun solar',
    'lynne landers': 'baker electric',
    'krista stemmerman': 'bennion deville homes',
    'daniel blessing': 'solarcity',
    'theresa johnson': 'baker electric',
    'khoi nguyen': 'verengo solar',
    'debbie teter': 'baker electric',
    'solar city': 'solarcity',
    'erica  tanner': 'baker electric'
}

fs.readdir('.', function(err, files) {
    async.each(files, function(file, callback) {
            if(/\.csv$/.test(file)) {
                console.log('Processing ' + file);
                fs.readFile(file, (err, data) => {
                    if (err) {
                        callback(err);
                    }
                    var records = parse(data, {columns: true});
                    records.forEach(function(record) {
                        var lastDate;
                        var status;
                        if (/Pending/.test(record.status)) {
                            lastDate = record.application_date;
                            status = "Pending"
                        } else if (/Issued/.test(record.status)) {
                            lastDate = record.issue_date;
                            status = "Pending";
                        } else if (/Cancel/.test(record.status)) {
                            lastDate = record.complete_cancel_date;
                            status = "Cancelled";
                        } else if (/Completed/.test(record.status)) {
                            lastDate = record.complete_cancel_date;
                            status = "Completed";
                        } else {
                            return; // malformed.
                        }

                        lastDate = new Date(lastDate);
                        var layerID = "permits-" + lastDate.getYear() + "-" + lastDate.getMonth();
                        var installer = record.permit_holder.trim().toLowerCase();
                        installer = renames[installer] || installer;
                        
                        installerMap[installer] = (installerMap[installer] || 0) + 1;
                        allInstallations += 1;

                        (allRecords[layerID] || (allRecords[layerID] = [])).push({
                            last_date: lastDate.getTime() / 1000,
                            status: status,
                            latitude: record.latitude,
                            longitude: record.longitude,
                            installer: installer
                        });
                    });
                    callback();
                });
            } else {
                callback();
            }
        }, function(err) {
            if (err) {
                console.log('Error: ' + err);
            } else {
                for (const layerID in allRecords) {
                    for (const record of allRecords[layerID]) {
                        if (installerMap[record.installer] < 5) {
                            installerMap['small installers'] += installerMap[record.installer];
                            record.installer = "small installers";
                        }
                    }
                    const geojson = GeoJSON.parse(allRecords[layerID], { Point: ['latitude', 'longitude']});
                    jsonfile.writeFile(layerID + '.geojson', geojson, function (err) {
                        if (err) throw err;
                    });
                }
                var installers = Object.entries(installerMap);
                installers.sort(function(a, b) {
                    return b[1] - a[1];
                });
                var html = "<select>\n"
                installers.forEach(function(installer) {
                    if (installer[1] > 100) {
                        html += `<option value="${installer[0]}">${installer[0]} (${installer[1]})</option>\n`
                    }
                });
                html += "</select>\n";
                console.log(html);
                console.log(allInstallations);
            }
        }
    );
});
