const ClassSensor = require('plcSensor.min.js');
/**
 * @typedef TypeSetWatchParam
 * @property {number} state – текущее состояние контакта («0» или «1»).
 * @property {number} time – это время в секундах, когда контакт поменял состояние.
 * @property {number} lastTime – это время в секундах, когда контакт в последний раз поменял состояние. Использование edge:'rising' или edge:'falling' – это не то же самое, что последний вызов функции.
 * @property {number} data – этот элемент добавляется, если в аргументе options была задана настройка data:pin. С его помощью можно считывать тактовые данные.
 */
/**
 * @typedef TypeConfigureParam
 * @property {number} [debounce] - "антидребезг" (см. API setWatch())
 * @property {number} [holdTime] - время удержания, на которое настроено событие 'hold'. | в секундах 
 */
/**
 * @class
 * Представляет кнопку как датчик
 */
class ClassButton extends ClassSensor {
    constructor(opts) {
        ClassSensor.call(this, opts);
        // задание debounce и holdTime либо в согласии с конфигом либо по умолчанию
        this.Configure(0, { holdTime: opts.holdTime || 1.2, debounce: opts.debounce || 50 });
        this.Value = 1;
        this._Pins[0].mode('input');
    }
    /**
     * @method
     * @param {TypeSetWatchParam} _e 
     * Обработчик прерывания на пине. Вызывает события "press", "release", "click", "hold"
     */
    OnSetWatch(_e) {
        if (_e.state == 1) {  // кнопка отпущена
            if (_e.time-_e.lastTime >= this._HoldTime)            // кнопка удерживалась дольше holdTime
                this._Channels[0].emit('hold', _e);         
            else
                this._Channels[0].emit('click', _e);          // иначе клик обыкновенный
        } 
        else {
            this._Channels[0].emit('press', _e);
        }

        this._Channels[0].Value = _e.state;
    }
    /**
     * @method 
     * @description Запускает мониторинг порта, на котором "сидит" кнопка.
     * @returns {Boolean}
     */
    Start() {
        if (this._SetWatch) return false;
        this._Channels[0].Status = 1;

        this._SetWatch = setWatch(this.OnSetWatch.bind(this), 
             this._Pins[0], 
            {
                repeat: true,
                edge: 'both',
                debounce: this._Debounce
            }
        );
        return true;
    }

    Stop() {
        clearWatch(this._SetWatch);
        this._SetWatch = null;
        this._Channels[0].Status = 0;
        return true;
    }
    /**
     * @method
     * @description Позволяет настроить контроль дребезжания в setWatch при мониторинге кнопки. 
     * Изменения вступят в силу после перезапуска опроса датчика (1. Stop() 2. Start())
     * @param {TypeConfigureParam} _opts 
     * @returns 
     */
    Configure(_chNum, _opts) {
        // Прим! holdTime игнорируется если < 0.05; holdTime в секундах
        this._HoldTime = (_opts.holdTime > 0.05) ? _opts.holdTime : this._HoldTime;
        this._Debounce = (typeof _opts.debounce > 0) ? _opts.debounce : this._Debounce;
        return true;
    }
}

exports = ClassButton;