const ClassSensor = require('plcSensor.min.js');
// all port modes ['output', 'analog', 'input', 'input_pullup', 'input_pulldown', 'opendrain', 'af_output', 'af_opendrain', 'auto'];
const INPUT_PIN_MODES = ['analog', 'input', 'input_pullup', 'input_pulldown', 'auto'];
/**
 * @class
 * Определяет основной функционал порта-сенсора и представляет каждый переданный порт в виде измерительного канала.
 * Не используется в прикладных целях.
 */
class ClassPortSensor extends ClassSensor {
    constructor(opts) {
        ClassSensor.call(this, opts);
        this._TypeInSignals = opts.typeInSignals;
        // Кол-во портов (_Pins) обязано быть равно _QuantityChannel
        if (this._ChannelNames.length !== this._Pins.length)
            throw new Error('QuantityChannel must be equal to pins count');
        // Тип сигнала определяет команду чтения с порта
        if (!Array.isArray(this._TypeInSignals) || this._TypeInSignals.length !== this._ChannelNames.length)
            throw new Error('_TypeInSignals must be an array length of _ChannelNames');
        // Порты конфигурируются либо согласно конфигу либо в зависимости от _TypeInSignal
        if (opts.pinModes) {
            // Установка режимов согласно конфигу
            this._Pins.forEach((_pin, i) => {
                this.Configure(i, { mode: opts.pinModes[i] });
            });
        } else {
            // Конфигурация по умолчанию
            this._Pins.forEach((_pin, i) => {
                _pin.mode(
                    (this._TypeInSignals[i] == 'analog') ? 'analog' : 'output'
                );
            });
        }
    }
    /**
     * @method
     * @description Запускает периодическое чтение с указанных портов
     * @param {number} _chNum 
     * @param {number} _period 
     * @param {object} _opts 
     */
    Start(_chNum, _period, _opts) {
        this._Channels[_chNum].Status = 1;
        
        this._Interval = setInterval(() => {
            this._Channels.forEach((ch, i) => {
                if (ch.Status) ch.Value = this.Read(this._Pins[i]);
            });
        }, _period);
        return true;
    }
    /**
     * @method
     * @description Прекращает опрос указанного канала (порта) 
     * @param {number} _chNum 
     * @returns 
     */
    Stop(_chNum) {
        if (typeof this._Channels[_chNum].Status === 0) return false;

        this._Channels[_chNum].Status = 0;
        
        if (!this._Channels.map(ch => ch.Status).find(s => s !== 0)) {
            clearInterval(this._Interval);
        }
        return true;
    }
    /**
     * @method
     * @description Выполняет чтение с порта
     * @param {Pin} port 
     * @returns {number}
     */
    Read(port) {
        let i = this._Pins.indexOf(port);
        if (this._TypeInSignals[i] == 'analog')
            return analogRead(port);
        return digitalRead(port);
    }
    /**
     * @typedef PinOpts
     * @property {string} mode
     */
    /**
     * Пример 
     * { mode: 'analog' }
     */
    /**
     * @method
     * @description Устанавливает режим порта/портов
     * @param {[PinOpts]} _opts 
     */
    Configure(_chNum, _opts) {
        if (!INPUT_PIN_MODES.includes(_opts.mode))
            return false;
        this._Pins[_chNum].mode(_opts.mode); 
        return true;
    }
    /**
     * @method
     * @description Возвращает объект с информацией о порте
     * @param {number} _chNum 
     * @returns 
     */
    GetInfo(_chNum) {
        return Object.assign({ mode: this._Pins[_chNum].getMode() }, this._Pins[_chNum].getInfo());
    }
}

exports = ClassPortSensor; 