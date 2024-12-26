const CH_FUNC_FILE = 'plcDeviceFunctions.js';
const importFunc = (_funcName, _ch) => {
    if (!_funcName) return undefined;
    try {
        let func = require(CH_FUNC_FILE)[_funcName];
        if (!func) 
            H.Logger.Service.Log({ service: _ch.ID, level: 'E', msg: `Couldn't find function ${_funcName}` });
        return func;
    } catch (e) {
        H.Logger.Service.Log({ service: _ch.ID, level: 'E', msg: `Error loading function ${_funcName}` });
        return undefined;
    }
}
/**
 * @typedef ActuatorPropsType - объект хранящий описательные характеристики актуатора
 * @property {String} id
 * @property {String} article
 * @property {any} bus - шина
 * @property {[Pin]} pins - массив пинов
 * @property {Number} [address] - адрес на шине
 * @property {String} name
 * @property {String} type
 * @property {[String]} channelNames
 */
/**
 * @class 
 * Базовый класс в стеке модуля. 
 * Собирает в себе основные данные об актуаторе: переданные шину, пины и тд. Так же сохраняет его описательную характеристику: имя, тип вх. и вых. сигналов, типы шин которые можно использовать, количество каналов и тд.
 */
class ClassBaseActuator {
    /**
     * @constructor
     * @param {ActuatorPropsType} _opts - объект который содержит все параметры, и описательные характеристики, необходимые для инициализации и обеспечения работы актуатора
     */
    constructor(_opts) {
        this._Bus          = _opts.bus;
        this._Pins         = _opts.pins;
        this._Address      = _opts.address;
        this._Id           = _opts.id;
        this._Article      = _opts.article;
        this._Name         = _opts.name;
        this._Type    = _opts.subChannels ? 'hybrid' : 'actuator';
        this._ChannelNames = _opts.channelNames;

        this.CheckProps();

        if (this._Type.toLowerCase() === 'hybrid') {
            try {
                this._SubChannels = _opts.subChannels.map(_subChId => {
                    let dev_id = _subChId.split('-')[0];
                    let chNum  = _subChId.split('-')[1];
                    return H.DeviceManager.Service.CreateDevice(dev_id)[chNum];
                });
            } catch (e) {
                H.Logger.Service.Log({ service: this._Id, level: 'E', msg: 'Error while parsing subChannels option' });
                throw e;
            }
        }
    }
    /**
     * @method
     * Метод проверяет корректность полей объекта
     */
    CheckProps() {
        //#region функции которые можно вынести в утилитарный класс
        const isString = (p) => typeof p === 'string';
        const isStringNonEmpty = (p) => typeof p === 'string' && p.length > 0;
        const isStringArray = (p) => (Array.isArray(p) && p.every(i => isString(i)));
        //#endregion

        if (!isStringNonEmpty(this._Id)) throw new Error(`Invalid id`);
        if (!isStringNonEmpty(this._Article)) throw new Error(`Invalid article`);
        if (!isStringNonEmpty(this._Name)) throw new Error(`Invalid name`);
        if (!isStringNonEmpty(this._Type)) throw new Error(`Invalid type`);
        if (!isStringArray(this._ChannelNames)) throw new Error(`Invalid channelNames`);

        if (this._Bus instanceof I2C && typeof +this._Address != 'number')  // если _Bus это I2C шина, то обязан быть передан _Address 
            throw new Error('Address of i2c device is not provided');
    }
    GetInfo() {
        return ({ 
            bus: this._Bus,
            pins: this._Pins,
            id: this._Id,
            article: this._Article,
            name: this._Name,
            type: this._Type,
            channelNames: this._ChannelNames
        });
    }
}

/**
 * @class
 * Класс, который закладывает в будущие классы актуаторов поля и методы, необходимые для унификации работы с отдельными каналами, объекты которых становится возможным выделять из "реального" объекта актуатора.
 */
class ClassActuator extends ClassBaseActuator {
    /**
     * @constructor
     * @param {ActuatorPropsType} _opts
     */
    constructor(_opts) {
        ClassBaseActuator.call(this, _opts);

        this._Channels = Array(this._ChannelNames.length);

        for (let i = 0; i < this._ChannelNames.length; i++) {
            let ch_name = _opts.channelNames[i];
            // объект конфигурации канала
            let ch_config = typeof _opts.channelsConfig == 'object' ? _opts.channelsConfig[ch_name] : {};
            this._Channels[i] = new ClassChannelActuator(this, i, ch_config);
        }
    }

    get ID() { return this._Id; }

    /**
     * @getter
     * Возвращает количество инстанцированных объектов каналов актуатора.
     */
    get CountChannels() {
        return this._Channels.filter(o => o instanceof ClassChannelActuator).length;
    }

    /**
     * @method
     * Возвращает объект соответствующего канала если он уже был инстанцирован. Иначе возвращает null
     * @param {Number} _num - номер канала
     * @returns {ClassChannelActuator}
     */
    GetChannel(_num) {
        return this._Channels[_num];
    }

    /**
     * @method
     * Обязывает инициализировать стандартные таски модуля
     */
    InitTasks() { }

    /**
     * @method
     * Метод, обязывающий вернуть объект, хранящий информацию об актуаторе
     * @returns {Object}
     */
    GetInfo(_chNum, _opts) { }

    /**
     * @method
     * Обязывает выполнить инициализацию актуатора, применив необходимые для его работы настройки
     * @param {Object} [_opts] 
     */
    Init(_opts) { }

    /**
     * @method
     * @description Обязывает изменить состояние указанного канала актуатора.
     * @param {Number} _chNum - номер канала 
     * @param {Number} _val - значение состояния актуатора. Автоматически проходит через сервисные функции мат.обработки. 
     * @param {object} _opts - дополнительные параметры 
     */
    SetValue(_chNum, _val, _opts) { }

    /**
     * @method
     * Обязывает подать питание на актуатор. 
     * 
     * @returns {Boolean} 
     */
    SetValue(_chNum, _opts) { }

    /**
     * @method
     * Обязывает выключить актуатор. 
     * @param {Number} _chNum - номер канала, работу которого необходимо прекратить
     */
    Off(_chNum, _opts) { }

    /**
     * @method
     * Обязывает выполнить дополнительную конфигурацию актуатора - настройки, которые в общем случае необходимы для работы актуатора, но могут переопределяться в процессе работы, и потому вынесены из метода Init() 
     * @param {Object} [_opts] - объект с конфигурационными параметрами
     */
    Configure(_chNum, _opts) { }

    /**
     * @method
     * Обязывает выполнить перезагрузку актуатора
     */
    Reset(_chNum) { }

    /**
     * @method
     * Обеспечивает чтение с регистра
     * @param {Number} _reg 
     */
    Read(_reg) { }

    /**
     * @method
     * Обеспечивает запись в регистр
     * @param {Number} _reg 
     * @param {Number} _val 
     */
    Write(_reg, _val) { }
}

/**
 * @class
 * Класс, представляющий каждый отдельно взятый канал актуатора. При чем, каждый канал является "синглтоном" для своего родителя.  
 */
class ClassChannelActuator {
    /**
     * @constructor
     * @param {ClassActuator} actuator - ссылка на основной объект актуатора
     * @param {Number} num - номер канала
     */
    constructor(actuator, num, _opts) {
        if (actuator._Channels[num] instanceof ClassChannelActuator) return actuator._Channels[num];    //если объект данного канала однажды уже был иницииализирован, то вернется ссылка, хранящаяся в объекте физического сенсора  
        let opts = _opts || {};
        this._Tasks = {};
        this._ActiveTask = null;

        this._ThisActuator = actuator;      // ссылка на объект физического актуатора
        this._ChNum = num;              // номер канала (начиная с 0)

        this._Transform   = new ClassTransform(this, opts.transform);
        this._Suppression = new ClassSuppression(this, opts.suppression);
        this._Status = 0;

        this.Address = opts.address;
    }
    get Device() { return this._ThisActuator; }

    get Suppression() { return this._Suppression; }

    get Transform()   { return this._Transform; }

    /**
     * @getter
     * Возвращает уникальный идентификатор канала
     */
    get ID() { 
        return `${this._ThisActuator.ID}-${this._ChNum}`; 
    }

    /**
     * @getter
     * Возвращает имя канала
     */
    get Name() {
        return this._ThisActuator._ChannelNames[this._ChNum];
    }
    /**
     * @getter
     * Возвращает статус измерительного канала: 0 - не опрашивается, 1 - опрашивается, 2 - в переходном процессе
     */
    get Status() {
        return this._Status;
    }

    set Status(_s) {
        if (typeof _s == 'number') this._Status = _s;
        return this._Status;
    }

    /**
     * @method
     * Возвращает активный в данный момент таск либо null
     * @returns {ClassTask}
     */
    get ActiveTask() {
        for (let key in this._Tasks) {
            if (this._Tasks[key]._IsActive) return this._Tasks[key];
        }
        return null;
    }
    
    /**
     * @method
     * Устанавливает базовые таски актутора
     */
    InitTasks() {
        return this._ThisActuator.InitTasks(this._ChNum);
    }
    /**
     * @method
     * Метод обязывает изменить состояние актуатора
     * @param {number} _val
     * @param {object} [_opts]
     * @returns {Boolean} 
     */
    SetValue(_val, _opts) {
        let val = this._Suppression.SuppressValue(_val);
        val = this._Transform.TransformValue(val);

        return this._ThisActuator.SetValue(this._ChNum, val, _opts) ? this : false
    }

    /**
     * @method
     * Выполняет перезагрузку актуатора
     */
    Reset(_opts) {
        return this._ThisActuator.Reset(this._ChNum, _opts);
    }

    /**
     * @method
     * Метод предназначен для выполнения конфигурации актуатора
     * @param {Object} _opts - объект с конфигурационными параметрами
     */
    Configure(_opts) {
        return this._ThisActuator.Configure(this._ChNum, _opts) ? this : false;
    }

    /**
     * @method
     * Добавляет новый таск и создает геттер на него 
     * @param {string} _name - имя таска
     * @param {Function} func - функция-таск
     */
    AddTask(_name, _func) {
        if (typeof _name !== 'string' || typeof _func !== 'function') throw new Error('Invalid arg');

        this._Tasks[_name] = new ClassTask(this, _func);
        return this;
    }

    /**
     * @method
     * Удаляет таск из коллекции по его имени
     * @param {String} _name 
     * @returns {Boolean} 
     */
    RemoveTask(_name) {
        return delete this._Tasks[_name];
    }

    /**
     * @method
     * Запускает таск по его имени с передачей аргументов.
     * @param {String} _name - идентификатор таска
     * @param {...any} _args - аргументы, которые передаются в таск.
     * Примечание! аргументы передаются в метод напрямую (НЕ как массив)  
     * @returns {Boolean}
     */
    RunTask(_name, _arg1, _arg2) {
        if (!this._Tasks[_name]) return false;
        let args = [].slice.call(arguments, 1);
        return this._Tasks[_name].Invoke(args);
    }

    /**
     * @method
     * Устанавливает текущий активный таск как выполненный.
     * @param {Number} _code 
     */
    ResolveTask(_code) {
        this.ActiveTask.Resolve(_code || 0);
    }

    /**
     * @method
     * Прерывает выполнение текущего таска. 
     * 
     * Примечание: не рекомендуется к использованию при штатной работе, так как не влияет на работу актуатора, а только изменяет состояние системных флагов
     * @returns {Boolean}
     */
    CancelTask() {
        if (!this.ActiveTask) return false;

        this.ActiveTask.Resolve();
        return true;
    }

    /**
     * @method
     * Метод предназначен для предоставления дополнительных сведений об измерительном канале или физическом датчике.
     * @param {Object} _opts - параметры запроса информации.
     */
    GetInfo(_opts) {
        return this._ThisActuator.GetInfo(this._ChNum, _opts);
    }
}

/**
 * @class
 * Представляет собой таск актуатора - обертку над прикладной функцией
 */
class ClassTask {
    /**
     * @constructor
     * @param {ClassChannelActuator} _channel - объект канала актуатора
     * @param {Function} _func - функция, реализующая прикладную
     */
    constructor(_channel, _func) {                          //сохранение объекта таска в поле _Tasks по имени
        this.name = 'ClassTask';
        this._Channel = _channel;
        this._IsActive = false;

        this._Func = _func.bind(this._Channel);
    }
    /**
     * @method
     * Запускает выполнение таска
     */
    Invoke(args) {
        let promisified = new Promise((res, rej) => {       //над переданной функцией инициализируется промис-обертка, колбэки resolve()/reject() которого должны быть вызваны при завершении выполнения таска

            this.resolve = res;
            this.reject = rej;

            if (this._Channel.ActiveTask) return this.Reject(-1);      //если уже запущен хотя бы один таск, вызов очередного отклоняется с кодом -1

            this._IsActive = true;

            return this._Func.apply(this._Channel, args);                   //вызов функции, выполняемой в контексте объекта-канала
        });
        return promisified;
    }
    /**
     * @method
     * Закрывает промис-обертку вызовом его колбэка resolve() с передачей числового кода (по умолчанию 0)
     * @param {Number} _code - код завершения
     */
    Resolve(_code) {
        this._IsActive = false;
        return this.resolve(_code || 0);
    }
    /**
     * @method
     * Закрывает промис-обертку вызовом его колбэка reject() с передачей числового кода (по умолчанию 0)
     * @param {Number} _code - код завершения
     */
    Reject(_code) {
        this._IsActive = false;
        return this.reject(_code || -1);
    }
}


/**
 * @class
 * Класс реализует функционал для обработки числовых значений по задаваемым ограничителям (лимитам) и функцией
 */
class ClassTransform {
    constructor(_ch, _opts) {
        let opts = _opts || {};
        this._Channel = _ch;
        this._TransformFunc = importFunc(opts.transformFunc, _ch) || ((x) => x);
    }
    /**
     * @method
     * Задает функцию, которая будет трансформировать вх.значения.
     * @param {Function} _func 
     * @returns 
     */
    SetFunc(_func) {
        if (!_func) {
            this._TransformFunc = null;
            return true;
        }
        if (typeof _func !== 'function') return false;
        this._TransformFunc = _func;
        return this._Channel;
    }
    /**
     * @method
     * Устанавливает коэффициенты k и b трансформирующей линейной функции 
     * @param {Number} _k 
     * @param {Number} _b 
     */
    SetLinearFunc(_k, _b) {
        if (typeof _k !== 'number' || typeof _b !== 'number') throw new Error('k and b must be values');
        this._TransformFunc = (x) => _k * x + _b;
        return this._Channel;
    }
    /**
     * @method
     * Возвращает значение, преобразованное линейной функцией
     * @param {Number} val 
     * @returns 
     */
    TransformValue(val) {
        return this._TransformFunc(val);
    }
}
/**
 * @class
 * Класс реализует функционал супрессии вх. данных
 */
class ClassSuppression {
    constructor(_ch) {
        this._Channel = _ch;
        this._Low;
        this._High;
        this.SetLim(-Infinity, Infinity);
    }
    /**
     * @method
     * Метод устанавливает границы супрессорной функции
     * @param {Number} _limLow 
     * @param {Number} _limHigh 
     */
    SetLim(_limLow, _limHigh) {
        if (typeof _limLow !== 'number' || typeof _limHigh !== 'number') throw new Error('Not a number');

        if (_limLow >= _limHigh) throw new Error('limLow value should be less than limHigh');
        this._Low = _limLow;
        this._High = _limHigh;
        return this._Channel;
    }
    /**
     * @method
     * Метод возвращает значение, прошедшее через супрессорную функцию
     * @param {Number} _val 
     * @returns {Number}
     */
    SuppressValue(_val) {
        return E.clip(_val, this._Low, this._High);
    }
}


exports = ClassActuator;