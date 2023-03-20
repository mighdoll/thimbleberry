// apply a histogram equalization scaling to normalized rgb values

// scale rgb colors according to bucketed lengths
// each source texture texel contains a unit length rgb vector and a length (in the alpha channel)

// the histogram equalization is in two buffers:
// . a buffer containing the min and max length values from the source texture
// . a histogram cumulative distribution function buffer

// the fragment shader finds the closest bucket in the histogram CDF 
//   and scales each unit length rgb values according the histogram CDF value
// 


// output from the reduction to find the range of the source data
struct MinMaxOutput {
    min: f32, max: f32, 
}

struct VertexOutput {
  @builtin(position) spot: vec4<f32>,
}

@group(0) @binding(2) var srcTexture: texture_2d<f32>;   // unit length rgb vectors and length in alpha channel
@group(0) @binding(5) var<storage, read> maxBuffer: array<MinMaxOutput>;  // min,max of length values
@group(0) @binding(6) var<storage, read> histogramCDF: array<u32>;  // histogram cumulative distribution function of lengths
@group(0) @binding(11) var<storage, read_write> debug: array<f32>; // buffer to hold debug values

let numBuckets = 256u;      //! let="const" 256=numBuckets
let numBucketsFloat = f32(numBuckets); //! let="const"
let maxBucket = i32(numBuckets - 1u);   //! let="const"
let bucketSize = 1.0 / numBucketsFloat;  //! let="const"
let bucketHalfSize = bucketSize / 2.0;  //! let="const"
let sqrt3 = sqrt(3.0); //! let="const"

@vertex
fn vertMain(
    @builtin(vertex_index) VertexIndex: u32,
    @location(0) xy: vec2<f32>
) -> VertexOutput {
    var result: VertexOutput;
    result.spot = vec4<f32>(xy, 1.0, 1.0);      // position range [-1, 1]
    return result;
}

@fragment
fn fragMain(
    @builtin(position) spot: vec4<f32>,
) -> @location(0) vec4<f32> {
    let minMax = maxBuffer[arrayLength(&maxBuffer) - 1u];

    // LATER here we load one texel. Later we will load a 2x2 block of interpolated texels.
    let texel = textureLoad(srcTexture, vec2<i32>(spot.xy), 0);
    let origLength = loadOp(texel);
    let equalizedLength = histogramEq(origLength, minMax.min, minMax.max);
    let color = texel.rgb * equalizedLength * sqrt3;
    return vec4<f32>(color, 1.0); // LATER use alpha from original texture
}

// return a histogram equalized value in the range [0,1]
fn histogramEq(value: f32, minValue: f32, maxValue: f32) -> f32 {
    var colorDex: i32;
    if value <= minValue {
        return 0.0;
    } else if value >= maxValue {
        return 1.0;
    } else {
        return equalizedLength(value, minValue, maxValue);
    }
}

// return a histogram equalized value in the range [0,1]
fn equalizedLength(p: f32, minValue: f32, maxValue: f32) -> f32 {
    // find cdf of this bucket, and offset from center of bucket
    let n = (p - minValue) / (maxValue - minValue); // normalized value in [0, 1]
    let bucket = i32(floor(n * numBucketsFloat));
    let bucketCenter = f32(bucket) * bucketSize + bucketHalfSize;
    let cdf = f32(histogramCDF[bucket]);
    let dCenter = n - bucketCenter;

    // mix cdf by mixing with neighboring buckets cdf
    var mixedCdf: f32; 
    if dCenter <= 0.0 {
        let prevBucket = max(bucket - 1, 0);
        let prevCdf = f32(histogramCDF[prevBucket]);
        let mixValue = 1.0 - dCenter;
        mixedCdf = mix(prevCdf, cdf, mixValue);
    } else {
        let nextBucket = min(bucket + 1, i32(numBuckets));
        let nextCdf = f32(histogramCDF[nextBucket]);
        let mixValue = dCenter;
        mixedCdf = mix(cdf, nextCdf, mixValue);
    }

    // normalize cdf value to [0,1] 
    let totalCount = f32(histogramCDF[maxBucket]);
    let normalized = mixedCdf / totalCount;
    return normalized;
}

fn loadOp(t: vec4<f32>) -> f32 {
    return t.a;
}
