// Calculate a histogram from a source texture
//
// Only texture values between min and max (inclusive) are counted for the histogram
// . the min/max range is read from a buffer (calculated by a reduction shader)
// . so zero is normally not counted
//
// two buffers are written as output, 
// . one for the histogram (counts) per bucket
// . one for the sum per bucket
// 
struct Uniforms {
  blockSize: vec2<u32>, // block size to collect in each invocation
}

struct MaxOutput {
    min: f32, max: f32, //! "min: f32, max: f32,"=outputStruct 
}

@group(0) @binding(0) var srcTexture: texture_2d<f32>; // source data
@group(0) @binding(1) var<storage, read> maxBuffer: array<MaxOutput>; 
@group(0) @binding(2) var<storage, read_write> histogramOut: array<u32>; 
@group(0) @binding(3) var<uniform> u: Uniforms;
@group(0) @binding(4) var<storage, read_write> sumOut: array<f32>;
@group(0) @binding(11) var<storage, read_write> debug: array<f32>; // buffer to hold debug values

let workgroupSizeX = 4;      //! let="const" 4=workgroupSizeX
let workgroupSizeY = 4;      //! let="const" 4=workgroupSizeY
let numBuckets = 10u;      //! let="const" 10=numBuckets
let numBucketsFloat = f32(numBuckets); //! let="const"
let maxBucket = i32(numBuckets - 1u);   //! let="const"

// we accumulate bucket totals in workgroup memory and then copy the local buckets to global memory
var<workgroup> localHistogram: array<atomic<u32>, numBuckets>;
var<workgroup> localSum: array<atomic<u32>, numBuckets>;


@compute 
@workgroup_size(workgroupSizeX, workgroupSizeY, 1) 
fn histogram(
    @builtin(global_invocation_id) grid: vec3<u32>,    // coords in the global compute grid
    @builtin(local_invocation_id) workGrid: vec3<u32>, // coords inside the this workgroup
    @builtin(num_workgroups) numWorkgroups: vec3<u32>, // number of workgroups in this dispatch
    @builtin(workgroup_id) workgroupId: vec3<u32>      // workgroup id in the dispatch
) {
    let minMax = maxBuffer[arrayLength(&maxBuffer) - 1u];
    let minValue = minMax.min;
    let maxValue = minMax.max;
    let largeU32 = 1000.0 * 1000.0 * 1000.0; // near to max u32 (4 billion), with some room for overflow
    let toUIntRange:f32 = largeU32 / maxValue;    // conversion factor to convert a density value to a u32

    collectBlock(grid.xy, minValue, maxValue, toUIntRange);
    workgroupBarrier();
    if (grid.x == 0u && grid.y == 0u) {
        copyToOuput(toUIntRange);
    }
}

// collect histogram for one block into workgroup local array
fn collectBlock(grid: vec2<u32>, minValue: f32, maxValue: f32, toUIntRange: f32) {
    let srcDim = vec2<u32>(
        u32(textureDimensions(srcTexture).x),
        u32(textureDimensions(srcTexture).y)
    );
    var blockStart = vec2<u32>(grid.x * u.blockSize.x, grid.y * u.blockSize.y);

    // LATER try striding/striping, should reduce memory bank conflicts
    for (var x = 0u; x < u.blockSize.x; x++) {
        for (var y = 0u; y < u.blockSize.y; y++) {
            let spot = blockStart + vec2<u32>(x, y);
            if (spot.x < srcDim.x && spot.y < srcDim.y) {
                collectPixel(spot, minValue, maxValue, toUIntRange);
            }
        }
    }
}

// add one pixel into workgroup local histogram bucket and local sum 
fn collectPixel(spot: vec2<u32>, minValue: f32, maxValue: f32, toUintRange: f32) {
    let texel = textureLoad(srcTexture, vec2<i32>(spot), 0); 
    let p = loadOp(texel);
    if (p >= minValue) {
        let bucket = toBucket(p, minValue, maxValue);
        atomicAdd(&localHistogram[bucket], 1u);
        // p is a float in the range 0 to max 
        // we want to store it as an integer in the range 0 to 2^32-1
        // (only integer values can be stored in atomic variables)
        // so conceptually we multiply by 2^32-1 and divide by max
        // (actually, we use a number that is less than 2^32-1 to avoid overflow)
        atomicAdd(&localSum[bucket], u32(p * toUintRange));

        // if (spot.x == 1u && spot.y == 0u) {
        //     debug[0] = p;
        //     debug[1] = minValue;
        //     debug[2] = maxValue;
        //     debug[3] = f32(bucket);
        //     debug[4] = f32(numBucketsFloat);
        // }
    }
}

// return the bucket index for this value
fn toBucket(p: f32, min: f32, max: f32) -> i32 {
    var bucket: i32;
    if (p >= max) {
        bucket = maxBucket;
    } else {
        bucket = i32(floor(((p - min) / (max - min)) * numBucketsFloat));
    }
    return bucket;
}

// copy the workgroup local histogram array to the output buffer
fn copyToOuput(toUIntRange: f32) {
    for (var i = 0u; i < numBuckets; i++) {
        histogramOut[i] = atomicLoad(&localHistogram[i]);
        sumOut[i] = f32(atomicLoad(&localSum[i])) / toUIntRange;
    }
}

fn loadOp(a: vec4<f32>) -> f32 {
    return a.r; //! "return a.r;"=loadOp
}

// LATER consider multilevel reduction of histograms