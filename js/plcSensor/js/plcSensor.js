const ClassDevice = require('plcDevice.min.js');
const ClassChannel = require('plcChannel.min.js').ClassChannel;
const ClassValueBuffer = require('plcChannel.min.js').ClassValueBuffer;

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
 * Класс, который закладывает в будущие классы датчиков поля и методы, необходимые для унификации хранения данных, связанных с отдельными 
 * каналами (вых. значения и коэффициенты для их обработки). Вводит реализации возможности выделения из объекта "реального" датчика объектов-каналов.
 */
class ClassSensor extends ClassDevice {
    /**
     * @constructor
     * @param {SensorPropsType} _opts
     */
    constructor(_opts) {
        ClassDevice.call(this, _opts);
        this._Channels = Array(Object.keys(this._ChannelNames).length);
        // создание каналов
        Object.keys(this._ChannelNames).forEach(_chName => {
            try {
                let chNum = this._ChannelNames[_chName];
                // объект конфигурации канала
                let ch_config = typeof _opts.channelsConfig == 'object' ? _opts.channelsConfig[_chName] : {};

                this._Channels[chNum] = new ClassChannelSensor(this, +chNum, ch_config);  // инициализируем и сохраняем объекты каналов
            } catch (e) {
                H.Logger.Service.Log({ service: this.Name || this.ID || 'Device', lvl: 'E', msg: `Error creating channel ${_chName}: ${e}` });
            }
        });
    }

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
}
/**
 * @class
 * Класс, представляющий каждый отдельно взятый канал датчика. При чем, каждый канал является "синглтоном" для своего родителя.  
 */
class ClassChannelSensor extends ClassChannel {
    /**
     * @constructor
     * @param {ClassSensor} device - ссылка на основной объект датчика
     * @param {Number} num - номер канала
     */
    constructor(device, num, _opts) {
        if (device._Channels[num] instanceof ClassChannelSensor) return device._Channels[num];    //если объект данного канала однажды уже был создан, то вернется ссылка, хранящаяся в объекте физического сенсора  
        ClassChannel.call(this, device, num, _opts);
        let opts = _opts || {};
        /** Основные поля */
        this._ChangeThreshold = opts.changeThreshold;
        /** Флаги */
        this._Bypass = Boolean(_opts.bypass);
        this._DataUpdated = false;
        this._DataWasRead = false;
        this._TimeStamp;
        /** Data refine init */
        if (this._IsNumType) {
            this._ValueBuffer = new ClassValueBuffer(this, opts.buffer);
        }
    }

    get Buffer() {
        return this._ValueBuffer;
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
     * Возвращает значение канала, хранящееся в основном объекте
     */
    get Value() { // вых значение канала
        if (!this.Status) return undefined;

        this._DataUpdated = false;
        this._Value = (this._DataWasRead || this._Bypass || !this._IsNumType)
            ? this._Value
            : this._ValueBuffer.Filter();
        this._DataWasRead = true;

        return this._Value;
    }

    /**
     * @setter
     * Добавляет значение в буфер   
     * @param {Number} _val 
     */
    set Value(_val) {
        if (this._Bypass || !this._IsNumType) {
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
        return this._Device.Start(this._ChNum, _period, _opts) ? this : false;
    }

    /**
     * @method
     * Метод предназначен для прекращения считывания значений с заданного канала. В случаях, когда значения данного канала считываются синхронно с другими, достаточно прекратить обновление данных.
     * @param {Number} _chNum - номер канала, опрос которого необходимо остановить.
     */
    Stop() {
        return this._Device.Stop(this._ChNum) ? this : false;
    }

    /**
     * @method
     * Метод предназначен для остановки опроса указанного канала и его последующего запуска с новой частотой. Возобновление должно касаться всех каналов, которые опрашивались до остановки.
     * @param {Number} _period - новый период опроса.
     */
    ChangeFreq(_period) {
        return this._Device.ChangeFreq(this._ChNum, _period);
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

exports = ClassSensor;