const ClassSensor = require('plcSensor.min.js');
const U1 = 3.3;
const R1 = 10000; // Ом
const MULT = 32017200;
const POW = -1.5832;
/**
 * @class
 * Класс для работы с датчиком освещенности GL5528
 */
class ClassLightGL5528 extends ClassSensor {
    constructor(_opts) {
        ClassSensor.call(this, _opts);
        this._K = _opts.k || MULT;
        this._P = _opts.p || POW;
        if (this._Pins.length < 1 || 
            typeof this._K !== 'number' ||
            typeof this._P !== 'number') throw new Error('Invalid args');
        this._Pins[0].mode('analog');
    }
    Start(_chNum, _period) {
        if (this._Channels[0]) this._Channels[0].Status = 1;
        if (this._Channels[1]) this._Channels[1].Status = 1;
        let period = _period ? E.clip(_period, 20, Infinity) : 50;
        
        this._Interval = setInterval(() => {
            
            let u2 = analogRead(this._Pins[0]) * 3.3;
            
            let rensor = (u2/U1) * R1 / (1 - u2/U1); //сопротивление

            if (this._Channels[1]) this._Channels[1].Value = rensor;
            if (this._Channels[0]) this._Channels[0].Value = this._K * Math.pow(rensor, this._P);
        }, period);
        return true;
    }
    
    Stop(_chNum) {
        if (this._Channels[0]) this._Channels[0].Status = 0;
        if (this._Channels[1]) this._Channels[1].Status = 0;
        clearInterval(this._Interval);
        this._Interval = null;
        return true;
    }

    Configure(_chNum, _opts) {
        if (!_opts) return false;

        if (typeof _opts.k === 'number') {
            this._K = _opts.k;
            return true;
        } if (typeof _opts.p === 'number') {
            this._P = _opts.p;
            return true;
        }
        return false;
    }
}

exports = ClassLightGL5528;