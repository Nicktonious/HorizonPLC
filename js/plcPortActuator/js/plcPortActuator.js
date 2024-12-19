const ClassActuator = require('plcActuator.min.js');
// all port modes ['output', 'analog', 'input', 'input_pullup', 'input_pulldown', 'opendrain', 'af_output', 'af_opendrain', 'auto'];
const OUTPUT_PIN_MODES = ['output', 'analog', 'opendrain', 'af_output', 'af_opendrain', 'auto'];

/**
 * @class
 * Определяет основной функционал порта-актуатора и представляет каждый переданный порт в виде исполнительного канала.
 * Не используется в прикладных целях.
 */
class ClassPortActuator extends ClassActuator {
    constructor(opts) {
        ClassActuator.call(this, opts);
        this._TypeOutSignals = opts.typeInSignals;

        if (this._ChannelNames.length !== this._Pins.length)
            throw new Error('QuantityChannel must be equal to pins count');
        // Тип сигнала определяет команду записи в порт
        if (!Array.isArray(this._TypeOutSignals) || this._TypeOutSignals.length !== this._ChannelNames.length)
            throw new Error('_TypeOutSignals must be an array length of _ChannelNames.length');
        
        if (opts.pinModes) {
            // Установка режимов согласно конфигу
            this._Pins.forEach((_pin, i) => {
                this.Configure(i, { mode: opts.pinModes[i] });
            });
        } else {
            // Конфигурация по умолчанию
            this._Pins.forEach((_pin, i) => { _pin.mode('output'); });
        }
    }
    /**
     * @method
     * @description Подает сигнал на порт
     * @param {number} _chNum 
     * @param {number} _val 
     * @param {object} _opts 
     * @returns 
     */
    SetValue(_chNum, _val, _opts) {
        let val = E.clip(_val, 0, 1);

        this.Write(this._Pins[_chNum], val, _opts);
        this._Channels[_chNum].Status = (_val == 0) ? 0 : 1;
        return this;
    }
    /**
     * @method
     * @description Выполняет запись сигнала на порт
     * @param {Pin} _pin 
     * @param {number} _val 
     * @param {object} _opts 
     */
    Write(_pin, _val, _opts) {
        if (this._TypeOutSignals[this._Pins.indexOf(_pin)] == 'pwm') {
            analogWrite(_pin, _val, _opts);   
        }
        else digitalWrite(_pin, _val);
    }
    /**
     * @method
     * @description Конфигурирует режим порта
     * @param {number} _chNum 
     * @param {object} _opts 
     * @returns 
     */
    Configure(_chNum, _opts) {
        if (!OUTPUT_PIN_MODES.includes(_opts.mode))
            return false;
        this._Pins[_chNum].mode(_opts.mode); 
        return this;
    }
    /**
     * @method
     * @description Возвращает объект с информацией о порте
     * @param {number} _chNum 
     * @returns 
     */
    GetInfo(_chNum) {
        return Object.assign(this._Pins[_chNum].getInfo(), { mode: this._Pins[_chNum].getMode() }); 
    }
}

exports = ClassPortActuator;