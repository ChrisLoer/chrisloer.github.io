#! usr/bin/env python

from sys import argv
from os.path import exists
import simplejson as json

script, in_file, out_file = argv

data = json.load(open(in_file))

geojson = {
    "type": "FeatureCollection",
    "features": [
    {
        "type": "Feature",
        "geometry" : {
            "type": "Polygon",
              "coordinates": [
                [
                  [d["lng"], d["lat"]] for d in feature
                ]
                ]
            }
     } for feature in data]
}


output = open(out_file, 'w')
json.dump(geojson, output)

print geojson
