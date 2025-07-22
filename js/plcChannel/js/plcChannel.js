const importFunc = (_funcName, _ch) => {
    const CH_FUNC_FILE = 'plcDeviceFunctions.min.js';
    if (!_funcName) return undefined;
    try {
        let func = require(CH_FUNC_FILE)[_funcName];
        if (!func)
            H.Logger.Service.Log({ service: _ch.Name, level: 'E', msg: `Couldn't find function ${_funcName}` });
        return func;
    } catch (e) {
        H.Logger.Service.Log({ service: _ch.Name, level: 'E', msg: `Error loading function ${_funcName}` });
        return undefined;
    }
}

/**
 * @class
 * Класс, представляющий каждый отдельно взятый канал датчика. При чем, каждый канал является "синглтоном" для своего родителя.  
 */
class ClassChannel {
    /**
     * @constructor
     * @param {ClassSensor} _device - ссылка на основной объект датчика
     * @param {Number} num - номер канала
     */
    constructor(_device, num, _opts) {
        let opts = _opts || {};
        this._Device = _device;      //ссылка на объект физического устройства
        /** Основные поля */
        this._Value = 0;
        this._Status = 0;
        this._ChangeThreshold = opts.changeThreshold;
        this._ChNum = num;             //номер канала (начиная с 0)
        /** Флаги */
        this._Bypass = Boolean(_opts.bypass);
        /** Data refine init */
        this._IsNumType = typeof opts.valueType != 'string' || !opts.valueType.startsWith('str');

        if (this._IsNumType) {
            this._Transform = new ClassTransform(this, opts.transform);
            this._Suppression = new ClassSuppression(this, opts.suppression);
        }
        if (opts.zones)
            this.EnableAlarms(opts.zones);

        /** mqtt топик ******/
        if (H.MQTT) {
            this.Address = opts.mqtt ? opts.mqtt.address : `/Horizon/${Process._BoardName}/${this.Name}`;
        }
    }

    get Alarms() { return this._Alarms; }

    get Suppression() { return this._Suppression; }

    get Transform() { return this._Transform; }

    /**
    * @getter
    * Задает значение флага _Bypass, позволяющего обновлять и считывать значения канала в обход функций мат.обработки
    * @returns {boolean}
    */
    set Bypass(_bp) {
        this._Bypass = Boolean(_bp);
    }

    /**
     * @getter
     * Возвращает уникальный идентификатор канала
     */
    get ID() { return `${this._Device.ID}-${this._ChNum}`; }

    /**
     * @getter
     * Возвращает имя канала
     */
    get Name() {
        return Object.keys(this._Device._ChannelNames).find(_chName => this._Device._ChannelNames[_chName] == this._ChNum);
    }

    get Device() {
        return this._Device;
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
    }

    /**
     * @getter
     * Возвращает установленный для канала порог изменения - процент, на который должно измениться Value чтобы SM считал его новым.
     */
    get ChangeThreshold() {
        return this._ChangeThreshold || 0;
    }

    set ChangeThreshold(_percent) {
        if (_percent >= 0 && _percent <= 100) {
            this._ChangeThreshold = _percent;
            return true;
        }
        return false;
    }

    /**
     * @method
     * Инициализирует ClassAlarms в полях объекта.  
     */
    EnableAlarms(_opts) {
        this._Alarms = new ClassAlarms(this, _opts);
    }

    /**
     * @method
     * Метод предназначен для конфигурации датчика.
     * @param {Object} [_opts] - объект с конфигурационными параметрами.
     */
    Configure(_opts) {
        return this._Device.Configure(this._ChNum, _opts) ? this : false;
    }

    /**
     * @method
     * Метод предназначен для предоставления дополнительных сведений об измерительном канале или физическом датчике.
     * @param {Object} _opts - параметры запроса информации.
     */
    GetInfo(_opts) {
        return this._Device.GetInfo(this._ChNum, _opts);
    }

    /**
     * @method
     * Метод предназначен для выполнения перезагрузки датчика.
     * @param {Object} _opts - параметры перезагрузки.  
     */
    Reset(_opts) {
        return this._Device.Reset(this._ChNum, _opts);
    }

    /**
     * @method
     * Метод предназначен для выполнения калибровки измерительного канала датчика
     * @param {Object} _opts - объект с конфигурационными параметрами
     */
    Calibrate(_opts) {
        return this._Device.Calibrate(this._ChNum, _opts);
    }

    /**
     * @method
     * Метод предназначен для установки значения повторяемости измерений.
     * @param {Number | String} _rep - значение повторяемости.
     */
    SetRepeatability(_rep) {
        return this._Device.SetRepeatability(this._ChNum, _rep);
    }

    /**
     * @method
     * Метод предназначен для установки точности измерений.
     * @param {Number | String} _pres - значение точности.
     */
    SetPrecision(_pres) {
        return this._Device.SetPrecision(this._ChNum, _pres);
    }
}

/**
 * @class ClassValueBuffer
 * Буфер значений канала
 */
class ClassValueBuffer {
    constructor(_ch, _opts) {
        let opts = _opts || {};
        opts.size = (typeof opts.size == 'number' && opts.size > 0) ? opts.size : 1;
        this._depth = opts.size;
        this._rawVal = undefined;
        this._arr = [];
        let filterFunc = importFunc(opts.filterName, _ch)
        this.SetFilterFunc(filterFunc);
    }

    /**
     * @setter
     * Сеттер который устанавливает вместимость кольцевого буфера
     * @param {Number} _cap 
    */
    set Size(_cap) {
        if (_cap > 1)
            this._depth = _cap;
    }

    /**
     * @method 
     * Очищает буфер. Фактически сбрасывает текущее значение канала. 
     */
    Clear() {
        while (this._arr.length > 0) this._ValueBuffer._arr.pop();
    }

    /**
     * @method
     * Вызывает функцию-фильтр от переданного массива
     * @returns {number}
     */
    Filter() {
        return this._FilterFunc(this._arr);
    }

    /**
     * @method
     * Устанавливает функцию-фильтр
     * @param {Function} _func 
     * @returns 
     */
    SetFilterFunc(_func) {
        if (!_func) {        //если _func не определен, то устанавливается функция-фильтр по-умолчанию
            this._FilterFunc = (arr) => arr[arr.length - 1];
            return true;
        }
        if (typeof _func !== 'function') throw new Error('Not a function');
        this._FilterFunc = _func;
        return true;
    }

    push(_val) {
        this._rawVal = _val;
        while (this._arr.length >= this._depth) {
            this._arr.shift();
        }
        this._arr.push(_val);
    }
}

/**
 * @class
 * Класс реализует функционал для обработки числовых значений по задаваемым ограничителям (лимитам) и функцией
 */
class ClassTransform {
    constructor(_ch, _opts) {
        this._Channel = _ch;
        let opts = _opts || {};
        if (opts.k && opts.b) {
            this.SetLinearFunc(opts.k, opts.b);
        } else {
            this._TransformFunc = importFunc(opts.transformFunc, _ch) || ((x) => x);
        }
    }
    /**
     * @method
     * Задает функцию, которая будет трансформировать вх.значения.
     * @param {Function} _func 
     * @returns 
     */
    SetFunc(_func) {
        if (!_func) {
            this._TransformFunc = (x) => x;
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
    constructor(_ch, _opts) {
        this._Channel = _ch;
        this._Low = -Infinity;
        this._High = Infinity;
        if (_opts)
            this.SetLim(_opts.low, _opts.high);
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

/**
 * @typedef ZonesOpts - Объект, задающий все либо несколько зон измерения а также их оповещения
 * @property {ZoneOpts} red - красная зона
 * @property {ZoneOpts} yellow - желтая зона
 * @property {GreenZoneOpts} green - зеленая зона
*/
/**
 * @typedef ZoneOpts - Объект, описывающий красную и желтую зоны измерения
 * @property {Number} limLow - нижняя граница
 * @property {Number} limHigh - верхняя граница
 * @property {Function} cbLow - аларм нижней зоны
 * @property {Function} cbHigh - аларм верхней зоны
*/
/**
 * @typedef GreenZoneOpts - Объект, описывающий зеленую зону измерения
 * @property {Function} cb
*/
/**
 * @class
 * Реализует функционал для работы с зонами и алармами 
 * Хранит в себе заданные границы алармов и соответствующие им колбэки.
 * Границы желтой и красной зон определяются вручную, а диапазон зеленой зоны фактически подстраивается под желтую (или красную если желтая не определена).
 * 
 */
class ClassAlarms {
    /**
     * @constructor
     * @param {ClassChannel} _channel 
     */
    constructor(_channel, _opts) {
        let opts = _opts || {};
        this._Channel = _channel;   // ссылка на объект сенсора
        this.SetDefault();
        this.SetZones(opts)
    }
    /**
     * @method
     * Устанавливает значения полей класса по-умолчанию
     */
    SetDefault() {
        this._Zones = [];
        this._Callbacks = new Array(5).fill((ch, z) => { });
        this._CurrZone = 'green';
        return this._Channel;
    }
    /**
     * @method
     * Устанавливает новый колбэк если он верно передан.
     * Метод не предназначен для вызова пользователем.
     * @param {Number} _ind 
     * @param {Function} _cb 
     * @returns 
     */
    SetCallback(_ind, _cb) {
        if (typeof _cb === 'function') {
            this._Callbacks[_ind] = _cb;
            return true;
        }
        return false;
    }
    /**
     * @method
     * Метод, который задает зоны измерения и их функции-обработчики
     * @param {ZonesOpts} _opts 
     */
    SetZones(_opts) {
        if (!_opts) return false;

        if (!this.CheckOpts(_opts)) return false;
        const indexes = { redLow: 0, yelLow: 1, green: 2, yelHigh: 3, redHigh: 4 };

        if (_opts.yellow) {
            this._Zones[indexes.yelLow] = _opts.yellow.low;
            this._Zones[indexes.yelHigh] = _opts.yellow.high;
            this.SetCallback(indexes.yelLow, _opts.yellow.cbLow);
            this.SetCallback(indexes.yelHigh, _opts.yellow.cbHigh);
        }
        if (_opts.red) {
            this._Zones[indexes.redLow] = _opts.red.low;
            this._Zones[indexes.redHigh] = _opts.red.high;
            this.SetCallback(indexes.redLow, _opts.red.cbLow);
            this.SetCallback(indexes.redHigh, _opts.red.cbHigh);
        }
        if (_opts.green) {
            this.SetCallback(indexes.green, _opts.green.cb);
        }
        return this._Channel;
    }
    /**
     * @method
     * Проверяет корректность переданных настроек зон измерения и алармов
     * @param {ZonesOpts} opts 
     * @returns 
     */
    CheckOpts(opts) {
        const indexes = { redLow: 0, yelLow: 1, green: 2, yelHigh: 3, redHigh: 4 };
        let yellow = opts.yellow;
        let red = opts.red;

        if (yellow) {
            if (yellow.low >= yellow.high ||                            //если нижняя граница выше верхней
                yellow.cbLow && typeof yellow.cbLow !== 'function' ||   //коллбэк передан но не является функцией
                yellow.cbHigh && typeof yellow.cbHigh !== 'function') return false;

            if (opts.red) {                         //если переданы настройки красной зоны, сравниваем с ними
                if (yellow.low < red.low || yellow.high > red.high)
                    return false;
            }                                       //иначе сравниваем с текущими значениями
            else if (yellow.low < this._Zones[indexes.redLow] || yellow.high > this._Zones[indexes.redHigh])
                return false;
        }
        if (red) {
            if (red.low >= red.high ||                                  //если нижняя граница выше верхней
                red.cbLow && typeof red.cbLow !== 'function' ||         //коллбэк передан но не является функцией
                red.cbHigh && typeof red.cbHigh !== 'function') return false;

            if (!yellow) {                          //если не переданы настройки желтой зоны, сравниваем с текущими
                if (opts.red.low > this._Zones[indexes.yelLow] || opts.red.high < this._Zones[indexes.yelHigh])
                    return false;
            }
        }
        return true;
    }
    /**
     * @method
     * Метод обновляет значение текущей зоны измерения по переданному значению и, если зона сменилась, вызывает её колбэк
     * @param {Number} val 
     */
    CheckZone(val) {
        const indexes = { redLow: 0, yelLow: 1, green: 2, yelHigh: 3, redHigh: 4 };
        let prevZone = this._CurrZone;
        this._CurrZone = val < this._Zones[indexes.redLow] ? 'redLow'
            : val > this._Zones[indexes.redHigh] ? 'redHigh'
                : val < this._Zones[indexes.yelLow] ? 'yelLow'
                    : val > this._Zones[indexes.yelHigh] ? 'yelHigh'
                        : 'green';

        if (prevZone !== this._CurrZone) {
            this._Channel.emit(this._CurrZone, prevZone);
            this._Callbacks[indexes[this._CurrZone]](this._Channel, prevZone);
        }
    }
}

exports = { ClassChannel, ClassValueBuffer, ClassTransform, ClassSuppression, ClassAlarms };