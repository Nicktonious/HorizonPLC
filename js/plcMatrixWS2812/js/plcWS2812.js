const sendData = (pin, rgb) => require("neopixel").write(pin, rgb);
/**
 * @function
 * @param {Number} n - кол-во цветов
 * @returns 
 */
const generateColor = (n) => {
    return Array(n*3).fill().map(() => Math.round(Math.random() * 255));
}

// /**
//  * @function
//  * Проверка на то что переданный аргумент может использоваться для задания цвета светодиодных пикселей
//  * @param {[Number]} color - массив формата [R, G, B] либо [R1, G1, B1, R2, G2, B2 ...]
//  * @returns {Boolean}
//  */
// const isColorValid = color => {
//     if (Array.isArray(color)) 
//         return color.filter(v => v >= 0 && v <= 255).length === color.length;
//     return false;
// } 

/**
 * 
 * @param {string} hex 
 * @returns 
 */
const hexToRgb = (hex) => {
    hex = hex.slice(1);
    let bigint = parseInt(hex, 16);
    
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    
    return new Uint8ClampedArray([r, g, b]);
}

const hexArrToColor = (arr) => {
    let rgbColor = new Uint8ClampedArray(arr.length*3);

    arr.forEach((hex, i) => {
        let ledColor = hexToRgb(hex);
        rgbColor[i*3] = ledColor[0];
        rgbColor[i*3+1] = ledColor[1];
        rgbColor[i*3+2] = ledColor[2];
    });
    return rgbColor;
}

const ClassActuator = require('plcActuator.min.js');

/**
 * @class
 * Класс актуатора, обеспечивает управление адресной Led-лентой
 */
class ClassLedStrip extends ClassActuator {
    constructor(opts) {
        ClassActuator.call(this, opts);
        this._Length = opts.length;
        if (typeof this._Length !== 'number') throw new Error(`Property length must me a number !`);
        this._Values = new Uint8ClampedArray(opts.length*3);
    }
    /**
     * @typedef {Object} OnOptions
     * @property {(Array<number|string>|string)} color - Цвет для установки. Может быть массивом `[R, G, B]` или строкой `"random_all".
     * @property {number} [ledNum] - Индекс светодиода (число) или `undefined`, чтобы включить выбранный цвет для всех светодиодов.
     * @property {Boolean} exclusive
     */
    /**
     * Метод для управления светодиодами.
     * @param {Number} _chNum - номер канала
     * @param {number} _val - Насыщенность (яркость) для установки (число от 0 до 1).
     * @param {OnOptions} _opts - Объект опций.
     */
    SetValue(_chNum, _val, _opts) {
        _val = E.clip(_val, 0, 1);
        let opts = _opts || {};
        if (_val == 0) 
            return this.Off(_chNum, _opts);

        if (opts.color === 'random') 
            opts.color = generateColor(1);                 // в color присваивается массив [R, G, B]

        if (opts.color === 'randomAll') {    
            opts.color = generateColor(this._Length);      // в color присваивается массив [R1, G1, B1, ... Rn, Gn, Bn]
            if (typeof opts.ledNum === 'number') return false;
        }

        if (typeof opts.color === 'string' && opts.color[0] === '#') {
            if (opts.color.length !== 7) return false;
            opts.color = hexToRgb(opts.color);
        }

        if (Array.isArray(opts.color) && typeof opts.color[0] === 'string') {
            
            opts.color = hexArrToColor(opts.color);
        }
        
        if (opts.exclusive) this.SetLedColor({ color: [0, 0, 0] });
        if (opts.color) this.SetLedColor(opts);

        this._Channels[_chNum].Status = 1;
        sendData(this._Pins[0], this._Values.map(c => c *_val));
        return true;
    }
    Off(_chNum, _opts) {
        let opts = _opts || {};
        if (!opts.saveState) this._Values = this._Values.fill(0);                  // если true, то _Values не будет обнуляться 
        sendData(this._Pins[0], new Uint8ClampedArray(this._Length*3).fill(0)); 
        this._Channels[_chNum].Status = 0;
        return true;
    }
    /**
     * @method
     * Задает цвет светодиодов
     * @param {OnOptions} _opts
     * @returns 
     */
    SetLedColor(_opts) {
        let color = _opts.color;
        let ledNum = _opts.ledNum;
        /*ввод выполняется в RGB формате, далее следует перевод в GBR, тк в нем работает использует neopixel 
        j нужен для итерации по массиву color, определяющему цвет сразу нескольких элементов светодиодной ленты
        j остается 0 когда color - массив типа [R, G, B]*/
        let j = 0;
        if (typeof ledNum !== 'number') for (let i = 0; i < this._Length; i++) {
            this._Values[i*3] = color[j+1];
            this._Values[i*3+1] = color[j];
            this._Values[i*3+2] = color[j+2];
            if (color.length > 3) j+=3;
        }
        else {
            //задание цвета конкретного пина
            this._Values[ledNum*3] = color[1];
            this._Values[ledNum*3+1] = color[0];
            this._Values[ledNum*3+2] = color[2];
        }
        return this._Values;
    }
}

exports = ClassLedStrip;