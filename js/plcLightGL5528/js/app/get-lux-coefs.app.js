const average = (arr) => {
    return arr.reduce((x, y) => x+y, 0)/arr.length;
};
const getGamma = (r0, l0, r1, l1) => Math.log(r1 / r0) / Math.log(l1 / l0);
const getLux = (r0, l0, r1, gamma) => l0 * Math.pow(r1/r0, 1/gamma);

let R0 = 1700;
let L0 = 100;

let R1= 4500;
let L1 = 20;

// vl6180
let vl_channels = H.DeviceManager.Service.CreateDevice('00');
let light1 = vl_channels[0];
light1.Start();

// gl5528
let gl = H.DeviceManager.Service.CreateDevice('15');
let light2 = gl[0];
let resistance = gl[1];
light2.Start(40);
resistance.Filter.SetFunc(average);
resistance.BufferSize = 5;

let gamma;  
let light;
let k;          // mult value
let p = 0;      // pow value
let c = 0;
let x;
let interval = setInterval(() => {
    gamma = getGamma(R0, L0, resistance.Value, light1.Value);
    k = L0 / Math.pow(R0, 1/gamma);
    p = 1 / gamma;
    light = getLux(R0, L0, resistance.Value, gamma);
    console.log(`Resistance is ${(resistance.Value).toFixed(0)} Ohm`);
    console.log(`gamma = ${gamma}\nk = ${k}\np = ${p}`);
    console.log(`VL6180 light value is ${(light1.Value).toFixed(1)} Lux`);
    console.log(`GL5528 Light value is ${(light2.Value).toFixed(1)} Lux`);
    console.log('********************************')
}, 2000);
    
//gamma = getGamma(R0, R0, L1, L0);

//k = L0 / Math.pow(R0, 1/gamma);
//p = 1 / gamma;

/*
let interval = setInterval(() => {
    console.log(`VL6180 light value is ${(light1.Value).toFixed(1)} Lux`);
    console.log(`GL5528 Light value is ${(light2.Value).toFixed(1)} Lux`);
    console.log(`Resistance is ${(resistance.Value).toFixed(0)} Ohm`);
}, 1000);
*/