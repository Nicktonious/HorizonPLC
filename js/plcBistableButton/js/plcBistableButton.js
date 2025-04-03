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
 * @property {number} [timeout] - время спустя которое кнопка будет переходить в состояние "выкл" 
 */
const ClassSensor = require('plcSensor.min.js');
/**
 * @class
 * @description 
 */
class ClassBistableButton extends ClassSensor {
    constructor(opts) {
        ClassSensor.call(this, opts);
        this._SubChannels = this._SubChannels.filter(_ch => typeof _ch.SetValue == 'function'); 
        // необязательная настройка - значение таймаута в мс, по которому кнопка будет принимать состояние "выкл"
        // если _TimeoutDelay <= 0, то таймеры не взводятся
        this._TimeoutDelay = 0;
        // контроль дребезжания при мониторинге порта
        // задание debounce и timeout либо в согласии с конфигом либо по умолчанию
        this.Configure(0, { timeout: opts.timeout || 0, debounce: opts.debounce || 50 });   
        // состояние которое изначально примет кнопка после вызова Start(). 
        // 0: вкл, 1: выкл                                                                 
        this._DefaultState = +Boolean(opts.defaultState);  
        // установка обработчика на смену состояния  
        this._Channels[0].on('changeState', this.OnChangeState.bind(this));
        this._Pins[0].mode('input');
    }

    /**
     * @method 
     * @description Запускает мониторинг порта, на котором "сидит" кнопка.
     * @returns {Boolean}
     */
    Start() {
        if (this._SetWatch) return false;
        this._SubChannels.forEach(_led => _led.SetValue(+!this._DefaultState));  
        this._Channels[0].Value = this._DefaultState;
        this._Channels[0].Status = 1;

        this._SetWatch = setWatch(this.ChangeState.bind(this), 
        this._Pins[0], {
            repeat: true,
            edge: 'rising',
            debounce: this._Debounce
        });

        return true;
    }

    /**
     * @method
     * @description Обработчик изменения состояния кнопки. 
     * Вызывает события 'enable'/'disable', изменяет индикацию (_SubChannels)
     */
    OnChangeState() {
        // инверсия значения и приведение к числовому виду
        let stateInverted = +!this._Channels[0].Value;
        this._SubChannels.forEach(_led => _led.SetValue(+!stateInverted));
        this._Channels[0].Value = stateInverted;
        this._Channels[0].emit(stateInverted ?  'disable' : 'enable');

        if (this._Timeout) {
            // если состояние кнопки изменяется при взведенном таймауте, то он сбрасывается
            clearTimeout(this._Timeout);
            this._Timeout = null;
        }
        /**
         * Если задан корректно таймаут и кнопка приняла статус 'enabled', 
         * то взводится таймер, по которому кнопка обратит свое состояние.
         */
        if (this._TimeoutDelay && stateInverted) {
            this._Timeout = setTimeout(() => {
                this._Channels[0].emit('changeState');
            }, this._TimeoutDelay * 1000);
        }
    }

    /**
     * @method
     * @description Изменяет состояние кнопки на обратное. 
     * @param {TypeSetWatchParam} _e 
     */
    ChangeState(_e) {
        this._Channels[0].emit('changeState');  
    }

    /**
     * @method
     * @description Прекращает мониторинг кнопки
     * @returns 
     */
    Stop() {
        if (this._SetWatch) clearWatch(this._SetWatch);
        this.Value = 1;
        this._SubChannels.forEach(_led => _led.SetValue(0));
        this._SetWatch = null;
        this._Channels[0].Status = 0;
        return true;
    }
    /**
     * @method
     * @description Позволяет настроить контроль дребезжания в setWatch при мониторинге кнопки и включить авто-выкл. кнопки по таймеру 
     * Изменение debounce вступят в силу после перезапуска опроса датчика (1. Stop() 2. Start())
     * @param {} _opts 
     * @returns 
     */
    Configure(_opts) {
        this._TimeoutDelay = (typeof _opts.timeout === 'number') ? _opts.timeout : this._TimeoutDelay;
        this._Debounce     = (_opts.debounce > 0) ? _opts.debounce : this._Debounce;

        return true;
    }
    /**
     * @method
     * @description Сбрасывает Value кнопки в стандартное состояние и выключает индикацию.
     */
    Reset() {
        this.Value = this._DefaultState;
        this._SubChannels.forEach(_led => _led.SetValue(0));
    }
}

exports = ClassBistableButton;