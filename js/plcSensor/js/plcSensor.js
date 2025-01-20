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
 * @typedef SensorPropsType - объект с описательными характеристиками датчика и параметрами, необходимых для обеспечения работы датчика
 * @property {String} id
 * @property {String} article
 * @property {String} name
 * @property {String} type
 * @property {[String]} channelNames
 */

/**
 * @class 
 * Самый "старший" предок в иерархии классов датчиков. 
 * В первую очередь собирает в себе самые базовые данные о датчике: переданные шину, пины и тд. Так же сохраняет его описательную характеристику: имя, тип вх. и вых. сигналов, типы шин которые можно использовать, количество каналов и тд.
 */
class ClassBaseSensor {
    /**
     * @typedef SensorOptsType
     * @property {any} bus - шина
     * @property {[Pin]} pins - массив пинов
     * @property {Number} [address] - адрес устройства на шине
     */
    /**
     * @constructor
     * @param {SensorOptsType} _opts - объект с описательными характеристиками датчика и параметрами, необходимых для обеспечения работы датчика
     */
    constructor(_opts) { 
        this._Bus     = _opts.bus;
        this._Pins    = _opts.pins;
        this._Address = _opts.address;
        this._Id      = _opts.id;
        this._Article = _opts.article;
        this._Name    = _opts.name;
        this._Type    = _opts.subChannels ? 'hybrid' : 'sensor';
        this._ChannelNames = _opts.channelNames;

        if (_opts.precision)     this._Precision     = _opts.precision;
        if (_opts.repeatability) this._Repeatability = _opts.repeatability;

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

        if (!isStringNonEmpty(this._Id))        throw new Error(`Invalid _Id`);
        if (!isStringNonEmpty(this._Article))   throw new Error(`Invalid _Article`);
        if (!isStringNonEmpty(this._Name))      throw new Error(`Invalid _Name`);
        if (!isStringArray(this._ChannelNames)) throw new Error(`Invalid _ChannelNames`);
        
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
 * Класс, который закладывает в будущие классы датчиков поля и методы, необходимые для унификации хранения данных, связанных с отдельными 
 * каналами (вых. значения и коэффициенты для их обработки). Вводит реализации возможности выделения из объекта "реального" датчика объектов-каналов.
 */
class ClassSensor extends ClassBaseSensor {
    /**
     * @constructor
     * @param {SensorPropsType} _opts
     */
    constructor(_opts) {
        ClassBaseSensor.call(this, _opts);
        
        this._Channels = Array(this._ChannelNames.length);

        for (let i = 0; i < this._ChannelNames.length; i++) {
            let ch_name = typeof _opts.channelNames[i];
            // объект конфигурации канала
            let ch_config = typeof _opts.channelsConfig == 'object' ? _opts.channelsConfig[ch_name] : {};

            this._Channels[i] = new ClassChannelSensor(this, i, ch_config);  // инициализируем и сохраняем объекты каналов
        }
    }

    get ID() { return this._Id; }
    
    /**
     * @getter
     * Возвращает количество созданных объектов каналов датчика.
     */
    get CountChannels() {
        return this._Channels.filter(o => o instanceof ClassChannelSensor).length;
    }

    /**
     * @method
     * Возвращает объект соответствующего канала если он уже был создан. Иначе возвращает null
     * @param {Number} _num - номер канала
     * @returns {ClassChannelSensor}
     */
    GetChannel(_num) {
        const num = _num;
        if (this._Channels[num] instanceof ClassChannelSensor) return this._Channels[num];
        return null;
    }

    /**
     * @method
     * Метод предназначен для инициализации датчика путем настройки необходимых для его работы регистров.
     * @param {Object} [_opts] - параметры инициализации.
     */
    Init(_opts) { }

    /**
     * @method
     * Метод предназначен для запуска циклического опроса определенного канала датчика с заданной периодичностью в мс. Переданное значение периода сверяется с минимально допустимым значением для данного канала и, при необходимости, корректируется, так как максимальная частота опроса зависит от характеристик датчика.
     * В датчиках, где считывание значений с нескольких каналов происходит неразрывно и одновременно, ведется только один циклический опрос, а повторный вызов метода Start() для конкретного канала лишь определяет, будет ли в процессе опроса обновляться значение данного канала.
     * Для датчиков, каналы которых не могут опрашиваться одновременно, реализация разных реакций на повторный вызов метода выполняется с помощью параметра _opts.
     * 
     * @param {Number} _chNum - номер канала.
     * @param {Number} [_period] - период опроса в мс.
     * @param {Object} [_opts] - необязательный параметр, позволяющий передать дополнительные аргументы.
     * @returns {Boolean} 
     */
    Start(_chNum, _period, _opts) { }

    /**
     * @method
     * Метод предназначен для прекращения считывания значений с заданного канала. В случаях, когда значения данного канала считываются синхронно с другими, достаточно прекратить обновление данных.
     * @param {Number} _chNum - номер канала, опрос которого необходимо остановить.
     */
    Stop(_chNum) { }

    /**
     * @method
     * Метод предназначен для остановки опроса указанного канала и его последующего запуска с новой частотой. Возобновление должно касаться всех каналов, которые опрашивались до остановки.
     * @param {Number} _chNum - номер канала, частота опроса которого изменяется.
     * @param {Number} _period - новый период опроса.
     */
    ChangeFreq(_chNum, _period) { }

    /**
     * @method
     * Метод предназначен для конфигурации датчика.
     * @param {Number} _chNum - номер канала
     * @param {Object} [_opts] - объект с конфигурационными параметрами.
     */
    Configure(_chNum, _opts) { }

    /**
     * @method
     * Метод предназначен для предоставления дополнительных сведений об измерительном канале или физическом датчике.
     * @param {Number} _chNum - номер канала.
     * @param {Object} _opts - параметры запроса информации.
     */
    GetInfo(_chNum, _opts) { }

    /**
     * @method
     * Метод предназначен для выполнения перезагрузки датчика.
     * @param {Number} _chNum - номер канала.
     * @param {Object} _opts - параметры перезагрузки.  
     */
    Reset(_chNum, _opts) { }

    /**
     * @method
     * Метод предназначен для выполнения калибровки измерительного канала датчика
     * @param {Number} _chNum - номер канала.
     * @param {Object} _opts - объект с конфигурационными параметрами
     */
    Calibrate(_chNum, _opts) { }

    /**
     * @method
     * Метод предназначен для установки значения повторяемости измерений.
     * @param {Number} _chNum - номер канала.
     * @param {Number | String} _rep - значение повторяемости.
     */
    SetRepeatability(_chNum, _rep) { }

    /**
     * @method
     * Метод предназначен для установки точности измерений.
     * @param {Number} _chNum - номер канала.
     * @param {Number | String} _pres - значение точности.
     */
    SetPrecision(_chNum, _pres) { }

    /**
     * @method
     * Метод предназначен для низкоуровневой работы с датчиками.
     * @param {Number} _reg - номер регистра.
     */
    Read(_reg) { }

    /**
     * @method
     * Метод предназначен для низкоуровневой работы с датчиками.
     * @param {Number} _reg - номер регистра.
     * @param {Number} _val - значение для записи.
     */
    Write(_reg, _val) { }
}
/**
 * @class
 * Класс, представляющий каждый отдельно взятый канал датчика. При чем, каждый канал является "синглтоном" для своего родителя.  
 */
class ClassChannelSensor {
    /**
     * @constructor
     * @param {ClassSensor} sensor - ссылка на основной объект датчика
     * @param {Number} num - номер канала
     */
    constructor(sensor, num, _opts) {
        if (sensor._Channels[num] instanceof ClassChannelSensor) return sensor._Channels[num];    //если объект данного канала однажды уже был создан, то вернется ссылка, хранящаяся в объекте физического сенсора  
        let opts = _opts || {};
        this._Sensor = sensor;      //ссылка на объект физического датчика
        /** Основные поля */
        this._ValueBuffer = {
            _depth : 1,
            _rawVal : undefined,
            _arr : [],
        
            push: function(_val) {
                this._rawVal = _val;
                while (this._arr.length >= this._depth) {
                    this._arr.shift();
                }
                this._arr.push(_val);
            }
        };
        this._Value = 0;
        this._Status = 0;
        this._ChangeThreshold = opts.changeThreshold;
        this._ChNum = num;             //номер канала (начиная с 0)
        /** Флаги */
        this._Bypass = Boolean(_opts.bypass);
        this._DataUpdated = false;
        this._DataWasRead = false;
        this._TimeStamp;
        /** Data refine init */
        this._Transform   = new ClassTransform(opts.transform);
        this._Suppression = new ClassSuppression(opts.suppression);
        this._Filter = new ClassFilter(opts.filter);
        this._Alarms = null;
        if (opts.zones) this.EnableAlarms(opts.zones);
        this.BufferSize = opts.filter ? (opts.filter.bufferSize || 1) : 1;
        /** mqtt топик ******/
        this.Address = opts.mqtt ? opts.mqtt.address : `/Horizon/${Process._BoardName}-${this.Name}`;
        /** ******/
    }

    get Alarms()      { return this._Alarms; }

    get Suppression() { return this._Suppression; }

    get Transform()   { return this._Transform; }

    get Filter()   { return this._Filter; }

    /**
     * @getter
     * Возвращает уникальный идентификатор канала
     */
    get ID() { return `${this._Sensor.ID}-${this._ChNum}`; }

    /**
     * @getter
     * Возвращает имя канала
     */
    get Name() {
        return this._Sensor._ChannelNames[this._ChNum];
    }

    get Device() {
        return this._Sensor;
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
     * @getter
     * Задает значение флага _Bypass, позволяющего обновлять и считывать значения канала в обход функций мат.обработки
     */
    set Bypass(_bp) {
        this._Bypass = Boolean(_bp);
    }

    /**
     * @getter
     * Возвращает значение канала, хранящееся в основном объекте
     */
    get Value() { // вых значение канала
        if (!this.Status) return undefined;

        this._DataUpdated = false;
        if (this._DataWasRead || this._Bypass) return this._Value;

        this._Value = this._Filter.FilterArray(this._ValueBuffer._arr);
        this._DataWasRead = true;

        return this._Value;
    }

    /**
     * @setter
     * Добавляет значение в буфер   
     * @param {Number} _val 
     */
    set Value(_val) {
        if (this._Bypass) {
            // запись в обход мат обработки
            this._Value = _val;
        } else {
            let val = this._Suppression.SuppressValue(_val);
            val = this._Transform.TransformValue(val);
            this._ValueBuffer.push(val);

            this._DataUpdated = true;
            this._DataWasRead = false;

            if (this._Alarms) this._Alarms.CheckZone(this.Value);
            this._TimeStamp = getTime();
        }
    }

    /**
     * @setter
     * Сеттер который устанавливает вместимость кольцевого буфера
     * @param {Number} _cap 
    */
    set BufferSize(_cap) {
        if (_cap > 1)
            this._ValueBuffer._depth = _cap;
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
     * Очищает буфер. Фактически сбрасывает текущее значение канала. 
     */
    ClearBuffer() {
        while (this._ValueBuffer._arr.length > 0) this._ValueBuffer._arr.pop();
    }

    /**
     * @method
     * Метод предназначен для запуска циклического опроса определенного канала датчика с заданной периодичностью в мс. Переданное значение периода сверяется с минимально допустимым значением для данного канала и, при необходимости, корректируется, так как максимальная частота опроса зависит от характеристик датчика.
     * В датчиках, где считывание значений с нескольких каналов происходит неразрывно и одновременно, ведется только один циклический опрос, а повторный вызов метода Start() для конкретного канала лишь определяет, будет ли в процессе опроса обновляться значение данного канала.
     * Для датчиков, каналы которых не могут опрашиваться одновременно, реализация разных реакций на повторный вызов метода выполняется с помощью параметра _opts.
     * 
     * @param {Number} [_period] - период опроса в мс.
     * @param {Object} [_opts] - необязательный параметр, позволяющий передать дополнительные аргументы.
     * @returns {Boolean} 
     */
    Start(_period, _opts) {
        return this._Sensor.Start(this._ChNum, _period, _opts) ? this : false;
    }

    /**
     * @method
     * Метод предназначен для прекращения считывания значений с заданного канала. В случаях, когда значения данного канала считываются синхронно с другими, достаточно прекратить обновление данных.
     * @param {Number} _chNum - номер канала, опрос которого необходимо остановить.
     */
    Stop() { 
        return this._Sensor.Stop(this._ChNum) ? this : false; 
    }

    /**
     * @method
     * Метод предназначен для остановки опроса указанного канала и его последующего запуска с новой частотой. Возобновление должно касаться всех каналов, которые опрашивались до остановки.
     * @param {Number} _period - новый период опроса.
     */
    ChangeFreq(_period) { 
        return this._Sensor.ChangeFreq(this._ChNum, _period); 
    }

    /**
     * @method
     * Метод предназначен для конфигурации датчика.
     * @param {Object} [_opts] - объект с конфигурационными параметрами.
     */
    Configure(_opts) {
        return this._Sensor.Configure(this._ChNum, _opts) ? this : false;
    }

    /**
     * @method
     * Метод предназначен для предоставления дополнительных сведений об измерительном канале или физическом датчике.
     * @param {Object} _opts - параметры запроса информации.
     */
    GetInfo(_opts) { 
        return this._Sensor.GetInfo(this._ChNum, _opts); 
    }

    /**
     * @method
     * Метод предназначен для выполнения перезагрузки датчика.
     * @param {Object} _opts - параметры перезагрузки.  
     */
    Reset(_opts) { 
        return this._Sensor.Reset(this._ChNum, _opts); 
    }

    /**
     * @method
     * Метод предназначен для выполнения калибровки измерительного канала датчика
     * @param {Object} _opts - объект с конфигурационными параметрами
     */
    Calibrate(_opts) {
        return this._Sensor.Calibrate(this._ChNum, _opts);
    }

    /**
     * @method
     * Метод предназначен для установки значения повторяемости измерений.
     * @param {Number | String} _rep - значение повторяемости.
     */
    SetRepeatability(_rep) { 
        return this._Sensor.SetRepeatability(this._ChNum, _rep); 
    }

    /**
     * @method
     * Метод предназначен для установки точности измерений.
     * @param {Number | String} _pres - значение точности.
     */
    SetPrecision(_pres) { 
        return this._Sensor.SetPrecision(this._ChNum, _pres); 
    }
}
/**
 * @class
 * Класс реализует функционал для работы с функциями-фильтрами
 */
class ClassFilter {
    constructor(_ch, _opts) {
        let opts = _opts || {};
        this._Channel = _ch;
        this._FilterFunc = importFunc(opts.filterFunc, _ch) || ((arr) => arr[arr.length-1]);
    }
    /**
     * @method
     * Вызывает функцию-фильтр от переданного массива
     * @param {[Number]} arr 
     * @returns 
     */
    FilterArray(arr) {
        return this._FilterFunc(arr);
    }

    /**
     * @method
     * Устанавливает функцию-фильтр
     * @param {Function} _func 
     * @returns 
     */
    SetFunc(_func) {
        if (!_func) {        //если _func не определен, то устанавливается функция-фильтр по-умолчанию
            this._FilterFunc = (arr) => arr[arr.length-1];
            return true;
        }
        if (typeof _func !== 'function') throw new Error('Not a function');
        this._FilterFunc = _func;
        return true;
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
        this._TransformFunc= _func;
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

const indexes = { redLow: 0, yelLow: 1, green: 2, yelHigh: 3, redHigh: 4 };

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
     * @param {ClassChannelSensor} _channel 
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
        this._Callbacks = new Array(5).fill((ch, z) => {});
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

        if (_opts.yellow) {
            this._Zones[indexes.yelLow]  = _opts.yellow.low;
            this._Zones[indexes.yelHigh] = _opts.yellow.high;
            this.SetCallback(indexes.yelLow,  _opts.yellow.cbLow);     
            this.SetCallback(indexes.yelHigh, _opts.yellow.cbHigh);
        }
        if (_opts.red) {
            this._Zones[indexes.redLow]  = _opts.red.low;
            this._Zones[indexes.redHigh] = _opts.red.high;
            this.SetCallback(indexes.redLow,  _opts.red.cbLow);
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
        let yellow = opts.yellow;
        let red = opts.red;

        if (yellow) {
            if (yellow.low >= yellow.high ||                            //если нижняя граница выше верхней
                yellow.cbLow  && typeof yellow.cbLow !== 'function' ||   //коллбэк передан но не является функцией
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
                red.cbLow  && typeof red.cbLow !== 'function' ||         //коллбэк передан но не является функцией
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
        let prevZone = this._CurrZone;
        this._CurrZone = val < this._Zones[indexes.redLow]  ? 'redLow'
                       : val > this._Zones[indexes.redHigh] ? 'redHigh'
                       : val < this._Zones[indexes.yelLow]  ? 'yelLow'
                       : val > this._Zones[indexes.yelHigh] ? 'yelHigh'
                       : 'green';

        if (prevZone !== this._CurrZone) {
            this._Channel.emit(this._CurrZone, prevZone);
            this._Callbacks[indexes[this._CurrZone]](this._Channel, prevZone);
        }
    }
}
exports = ClassSensor;