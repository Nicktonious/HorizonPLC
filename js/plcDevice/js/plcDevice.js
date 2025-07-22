/**
 * @class 
 * Самый "старший" предок в иерархии классов датчиков. 
 * В первую очередь собирает в себе самые базовые данные о датчике: переданные шину, пины и тд. Так же сохраняет его описательную характеристику: имя, тип вх. и вых. сигналов, типы шин которые можно использовать, количество каналов и тд.
 */
class ClassBaseDevice {
    /**
     * @typedef DeviceOptsType
     * @property {any} bus - шина
     * @property {[Pin]} pins - массив пинов
     * @property {Number} [address] - адрес устройства на шине
     */
    /**
     * @constructor
     * @param {DeviceOptsType} _opts - объект с описательными характеристиками датчика и параметрами, необходимых для обеспечения работы датчика
     */
    constructor(_opts) {
        this._Bus = _opts.bus;
        this._Pins = _opts.pins;
        this._Address = _opts.address;
        this._Id = _opts.id;
        this._Article = _opts.article;
        this._Name = _opts.name;
        this._Type = _opts.subChannels ? 'hybrid' : _opts.type;
        // если  массив вида ["chName0, "chName1"], то он преобразуется к { chName0: 0, chName1: 1 } 
        this._ChannelNames = Array.isArray(_opts.channelNames)
            ? _opts.channelNames.reduce((acc, item, index) => { acc[item] = index; return acc; }, {})
            : this._ChannelNames;

        this.CheckProps();

        if (this._Type.toLowerCase() === 'hybrid') {
            try {
                this._SubChannels = _opts.subChannels.map(_subChId => {
                    let dev_id = _subChId.split('-')[0];
                    let chNum = _subChId.split('-')[1];
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
        const isStringNonEmpty = (p) => typeof p === 'string' && p.length > 0;
        const isChNamesObj = (p) => (typeof p === 'object' && Object.keys(p).every(i => isStringNonEmpty(i) && Object.values(p).every(i => typeof i === 'number')));
        //#endregion

        if (!isStringNonEmpty(this._Id)) throw new Error(`Invalid _Id`);
        if (!isStringNonEmpty(this._Article)) throw new Error(`Invalid _Article`);
        if (!isStringNonEmpty(this._Name)) throw new Error(`Invalid _Name`);
        if (!isChNamesObj(this._ChannelNames)) throw new Error(`Invalid _ChannelNames`);

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
class ClassDevice extends ClassBaseDevice {
    /**
     * @constructor
     * @param {ActuatorPropsType} _opts
     */
    constructor(_opts) {
        ClassBaseDevice.call(this, _opts);
    }

    get ID() { return this._Id; }

    /**
     * @getter
     * Возвращает количество инстанцированных объектов каналов актуатора.
     */
    get CountChannels() {
        return this._Channels.filter(o => typeof o == 'object').length;
    }

    /**
     * @method
     * Возвращает объект соответствующего канала если он уже был инстанцирован. Иначе возвращает null
     * @param {Number} _num - номер канала
     * @returns {ClassChannel}
     */
    GetChannel(_num) {
        return this._Channels[_num];
    }

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
exports = ClassDevice;