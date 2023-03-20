struct Input { 
    sum: f32,  //! "sum: f32,"=inputStruct 
}

struct Output { 
    sum: f32,  //! "sum: f32,"=outputStruct 
}

@group(0) @binding(1) var<storage, read> src: array<Input>; 
@group(0) @binding(2) var<storage, read_write> out: array<Output>;  
@group(0) @binding(11) var<storage, read_write> debug: array<f32>; // buffer to hold debug values


let workgroupThreads= 4; //! let="const" 4=workgroupThreads

var <workgroup> work:array<Output, workgroupThreads>; 

// 
// reduce a buffer of values to a single value, returned as the last element of the out array
// 
// each dispatch does two reductions:
//    . each invocation reduces from a src buffer to the workgroup buffer
//    . one invocation per workgroup reduces from the workgroup buffer to the out buffer
// the driver issues multiple dispatches until the output is 1 element long
//    (subsequent passes uses the output of the previous pass as the src)
// the same output buffer can be used as input and output in subsequent passes
//    . start and end indices in the uniforms indicate input and output positions in the buffer
// 

@compute
@workgroup_size(workgroupThreads, 1, 1) 
fn reduceFromBuffer(
    @builtin(global_invocation_id) grid: vec3<u32>,    // coords in the global compute grid
    @builtin(local_invocation_id) workGrid: vec3<u32>, // coords inside the this workgroup
    @builtin(num_workgroups) numWorkgroups: vec3<u32>, // number of workgroups in this dispatch
    @builtin(workgroup_id) workgroupId: vec3<u32>     // workgroup id in the dispatch
) {
    reduceBufferToWork(grid.xy, workGrid.xy);
    workgroupBarrier();
    if (workGrid.x == 0u && workGrid.y == 0u) {
        let workIndex = workgroupId.x + workgroupId.y * numWorkgroups.x;
        reduceWorkgroupToOut(grid.xy, workIndex);
    }
}

fn reduceBufferToWork(grid: vec2<u32>, workGrid: vec2<u32>) {
    var values = fetchSrcBuffer(grid.x * 4u); //! 4=blockArea
    var v = reduceBlock(values);
    work[workGrid.x] = v;
}

// LATER benchmark striping/striding should reduce memory bank conflict
fn fetchSrcBuffer(start: u32) -> array<Output, 4> {  //! 4=blockArea
    let end = arrayLength(&src);
    var a = array<Output,4>(); //! 4=blockArea
    for (var i = 0u; i < 4u; i = i + 1u) { //! 4=blockArea
        var idx = i + start;
        if (idx < end) {
            a[i] = inputOp(src[idx]);
        } else {
            a[i] = identityOp();
        }
    }

    return a;
}

fn reduceWorkgroupToOut(grid: vec2<u32>, workIndex: u32) {
    var v = work[0];
    for (var i = 1u; i < 4u; i = i + 1u) { //! 4=workgroupThreads
        v = flatMapOp(v, work[i]);
    }
    out[workIndex] = v;
}

fn reduceBlock(a: array<Output, 4>) -> Output { //! 4=blockArea
    var v = a[0];
    for (var i = 1u; i < 4u; i = i + 1u) { //! 4=blockArea
        v = flatMapOp(v, a[i]);
    }
    return v;
}

fn flatMapOp(a: Output, b: Output) -> Output {
    return Output(a.sum + b.sum);  //! "return Output(a.sum + b.sum);"=flatMapOp
}

fn inputOp(a: Input) -> Output {
    return Output(a.sum);  //! "return Output(a.sum);"=inputOp
}

fn identityOp() -> Output {
    return Output(0.0); //! "return Output(0.0);"=identityOp
}