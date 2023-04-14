struct Output { 
    sum: u32,  //! "sum: u32,"=outputStruct 
}

@group(0) @binding(2) var<storage, read> partialScan: array<Output>;      // src partial prefix scan
@group(0) @binding(3) var<storage, read> blockSum : array<Output>;        // src block sums
@group(0) @binding(4) var<storage, read_write> prefixScan: array<Output>; // output prefix scan
@group(0) @binding(11) var<storage, read_write> debug: array<f32>;        // buffer to hold debug values

const workgroupSizeX = 4u;      //! 4=workgroupSizeX

// apply block sums to partial scan results
@compute
@workgroup_size(workgroupSizeX, 1, 1) 
fn applyScanBlocks(
    @builtin(global_invocation_id) grid: vec3<u32>,
    @builtin(workgroup_id) workGrid: vec3<u32>, 
) {
    if (workGrid.x == 0u) {
        prefixScan[grid.x] = partialScan[grid.x];
    } else {
        let a = partialScan[grid.x];
        let b = blockSum[workGrid.x - 1u];
        prefixScan[grid.x] = flatMapOp(a, b);
    }
}

fn flatMapOp(a: Output, b: Output) -> Output {
    return Output(a.sum + b.sum);  //! "return Output(a.sum + b.sum);"=flatMapOp
}