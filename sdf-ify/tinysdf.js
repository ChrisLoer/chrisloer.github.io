'use strict';

module.exports = TinySDF;
module.exports.default = TinySDF;

var INF = 1e20;

function TinySDF(width, height, buffer, radius, cutoff, fontFamily, fontWeight) {
    this.width = width;
    this.height = height;
    this.buffer = buffer === undefined ? 3 : buffer;
    this.cutoff = cutoff || 0.25;
    this.radius = radius || 8;
    this.size = width * height;

    // temporary arrays for the distance transform
    this.gridOuter = new Float64Array(this.size);
    this.gridInner = new Float64Array(this.size);
    var maxDimension = Math.max(width, height);
    this.f = new Float64Array(maxDimension);
    this.z = new Float64Array(maxDimension + 1);
    this.v = new Uint16Array(maxDimension);
}

TinySDF.prototype.draw = function (imgData) {
    var alphaChannel = new Uint8ClampedArray(this.size);

    for (var i = 0; i < this.width * this.height; i++) {
        var a = imgData.data[i * 4 + 3] / 255; // alpha value
        this.gridOuter[i] = a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
        this.gridInner[i] = a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
    }

    edt(this.gridOuter, this.width, this.height, this.f, this.v, this.z);
    edt(this.gridInner, this.width, this.height, this.f, this.v, this.z);

    for (i = 0; i < this.size; i++) {
        var d = Math.sqrt(this.gridOuter[i]) - Math.sqrt(this.gridInner[i]);
        alphaChannel[i] = Math.round(255 - 255 * (d / this.radius + this.cutoff));
    }

    return alphaChannel;
};

// 2D Euclidean squared distance transform by Felzenszwalb & Huttenlocher https://cs.brown.edu/~pff/papers/dt-final.pdf
function edt(data, width, height, f, v, z) {
    for (var x = 0; x < width; x++) edt1d(data, x, width, height, f, v, z);
    for (var y = 0; y < height; y++) edt1d(data, y * width, 1, width, f, v, z);
}

// 1D squared distance transform
function edt1d(grid, offset, stride, length, f, v, z) {
    var q, k, s, r;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;

    for (q = 0; q < length; q++) f[q] = grid[offset + q * stride];

    for (q = 1, k = 0, s = 0; q < length; q++) {
        do {
            r = v[k];
            s = (f[q] - f[r] + q * q - r * r) / (q - r) / 2;
        } while (s <= z[k] && --k > -1);

        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
    }

    for (q = 0, k = 0; q < length; q++) {
        while (z[k + 1] < q) k++;
        r = v[k];
        grid[offset + q * stride] = f[r] + (q - r) * (q - r);
    }
}
