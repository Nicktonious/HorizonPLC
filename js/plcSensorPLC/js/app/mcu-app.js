let mcu = SensorManager.CreateDevice('MCU');
mcu[0].Start(500);

let a = setInterval(() => {
    console.log(`Temperature on board is ${(mcu[0].Value).toFixed(1)} °C`);
}, 2000);