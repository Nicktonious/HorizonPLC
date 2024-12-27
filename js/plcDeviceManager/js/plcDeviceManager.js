const ClassSensor   = require('plcSensor.min.js');
const ClassActuator = require('plcActuator.min.js');

const POLLING_FREQ = 5;
/**
 * @typedef ClassMsg
 * @property {[string|number]} arg
 * @property {[string|number]} value
 */

/**
 * @class
 * Реализует функционал службы для работы с измерительно-исполняющими устройствами: 
 * инициализации, адресации команд, сбора данных 
 */
class ClassDeviceManager {
    constructor() {
        if (this.Instance) {
            return this.Instance;
        } else {
            ClassDeviceManager.prototype.Instance = this;
        }

        this._Devices = [];
        // this._RegisteredBuses = {};
        // запуск циклического опроса
        Object.on('dm-sub-sensorall', (_msg) => {
            // let freq = _msg.arg[0];
            this.OnSubSensall();
            if (!this._Interval) this.StartPolling(POLLING_FREQ);
        });
        // его остановка
        Object.on('dm-stop-polling',    this.StopPolling.bind(this));
        // сбор метаданных данных о сенсорах
        Object.on('dm-deviceslist-get', this.OnDevicesListGet.bind(this));
        // перенаправление команды актуатору
        Object.on('dm-actuator-set',    this.ActuatorSet.bind(this));

        this.InitBuses();
    }

    get Devices() { return this._Devices; }

    get Sensors() { return this._Devices.filter(device => device instanceof ClassSensor); }

    get Actuators() { return this._Devices.filter(device => device instanceof ClassActuator); }
    /**
     * @getter
     * Возвращает массив всех каналов 
     */    
    get Channels() {
        let ch_list = [];
        this.Devices.forEach(_dev => {
            _dev._Channels.forEach(_ch => ch_list.push(_ch));
        });
        return ch_list;
    }
    /**
     * @getter
     * Возвращает массив каналов сенсоров
     */
    get SensorChannels() {
        let ch_list = [];
        this.Sensors
            .forEach(_dev => {
                _dev._Channels.forEach(_ch => ch_list.push(_ch));
            });
        return ch_list;
    }
    /**
     * @getter
     * Возвращает массив каналов актуаторов
     */
    get ActuatorChannels() {
        let ch_list = [];
        this.Actuators
            .forEach(_dev => {
                _dev._Channels.forEach(_ch => ch_list.push(_ch));
            });
        return ch_list;
    }
    /**
     * @typedef TypeDeviceMappingInfo
     * @property {string} address
     * @property {string} name
     */
    /**
     * @typedef TypeSubSensList
     * @property {[TypeDeviceMappingInfo]} sensor
     * @property {[TypeDeviceMappingInfo]} actuator
     */
    /**
     * @method
     * @description возвращает объект с данными, необходимыми для маппинга сенсоров и актуаторов
     * @returns {TypeSubSensList}
     */
    GetSublist() {
        return ({ 
            sensor:     this.SensorChannels.filter(_ch => _ch.Address).map(_ch => ({ name: _ch.ID, address: _ch.Address })), 
            actuator: this.ActuatorChannels.filter(_ch => _ch.Address).map(_ch => ({ name: _ch.ID, address: _ch.Address })) 
        });
    }
    /**
     * @method
     * @description Возвращает список каналов PLC согласно протоколу lhp
     */
    GetLHPDevlist() {
        let value = { sensor: [], actuator: [] };
        
        this.ActuatorChannels.forEach(_ch => {
            value.sensor.push(`${_ch.Device._Article}-${ch.ID}`);
        });
        this.SensorChannels.forEach(_ch => {
            value.actuator.push(`${_ch.Device._Article}-${ch.ID}`);
        });
        return value;
    }

    /**
     * @method
     * @description Выполняет инициализацию всех шин, указанных в конфиге к текущей программе.
     */
    InitBuses() {
        let config = Process.GetBusesConfig();

        for (let busName of Object.keys(config)) {
            try {
                let opts = config[busName];
                // Приведение строкового представления пинов к получению их объектов                                   
                for (let option of Object.keys(opts)) {
                    if (option !== 'bitrate') opts[option] = this.GetPinByStr(opts[option]);
                }
                let busObj;
                if (busName.startsWith('I2C')) busObj = H.I2Cbus.Service.AddBus(opts);
                if (busName.startsWith('SPI')) busObj = H.SPIbus.Service.AddBus(opts);
                if (busName.startsWith('UART')) busObj = H.UARTbus.Service.AddBus(opts);

            } catch (e) {
                H.Logger.Log({ service: 'dm', level: 'E',  msg: `Failed to init bus ${busname}` });
            }
        }
    }  
    /**
     * @method
     * @description Добавляет устройство в реестр
     * @param {Object} device 
     */
    AddDevice(device) {
        if ((!this.GetDevice(device.ID)) && device.ID) {
            this._Devices.push(device);
        }
    }
    /**
     * @method
     * @param {string} id 
     * @description Возвращает устройство с соответствующим id
     * @returns 
     */
    GetDevice(id) {
        return this._Devices.find(dev => dev.ID === id);
    }
    /**
     * @method
     * @description Возвращает канал устройства по его id
     * @param {string} chId 
     */
    GetChannel(chId) {
        for (let i = 0; i < this.Devices.length; i++) {
            let ch = this.Devices[i]._Channels.find(_ch => _ch.ID === chId);
            if (ch) return ch;
        }
    }
    /**
     * @method
     * Запускает периодичное считывание данных с сенсоров. 
     * Данные, которые не обновились с момента последнего обхода, пропускаются
     * @param {Number} _freq - частота опроса 
     */
    StartPolling(_freq) {
        const freq = _freq || 5;
        if (typeof freq !== 'number' || freq <= 0) return false;
        
        const valIsEqual = (a, b, x) => {
            return Math.abs(a - b) <= Math.abs(a) * (x / 100);
        };
        let data_cache = {}; // кэширование собранных данных

        this._Interval = setInterval(() => {

            this.Sensors.forEach(_sens => {
                // перебор каналов
                _sens._Channels
                .filter(ch => ch.Status)
                .forEach(ch => {
                    if (!valIsEqual(ch.Value, data_cache[ch.ID], ch.ChangeThreshold)) {
                        let data_package = {
                            com: 'all-data-raw-get',
                            arg: [ch.ID],
                            value: [ch.Value]
                        }
                        data_cache[ch.ID] = ch.Value;
                        this.SendData(data_package);
                    }
                });
            });

            // if (Object.keys(data_package).length) this.Send(data_package);
            // console.log('DEBUG>>iteration is done');

        }, 1 / freq * 1000);
        return true;

    }
    /**
     * @method
     * Прекращает периодический опрос датчиков
     */
    StopPolling() {
        if (this._Interval) clearInterval(this._Interval);
        this._Interval = null;
    }
    /**
     * @method
     * Собирает и возвращает информацию о датчиках
     * @param {[String]} idArr - массив id
     */
    OnDevicesListGet(_msg) {
        let msg = {
            com: 'dm-deviceslist-set',
            value: [this.GetLHPDevlist()]
        }
        // Object.emit(msg.com, msg);
        this.SendWS(msg);
    }

    OnSubSensall(_msg) {
        let source = _msg.metadata ? _msg.metadata.source ? _msg.metadata.source : undefined : undefined;
        if (!source) return;
        let msg = {
            com: `${source}-sub-sensorall`,
            value: [this.GetSublist()]
        }
        Object.emit(msg.com, msg);
    }
    /**
     * @method
     * @public
     * @description Отправляет сообщение на WSS
     * @param {*} _msg 
     */
    SendWS(_msg) {
        Object.emit('proxyws-send', _msg);
    }
    /**
     * @method
     * @description Выполняет рассылку данных, собранных с сенсоров
     * @param {Object} dataPackage - объект типа { channel_id: channel_value }
     */
    SendData(_msg) {
        Object.emit('all-data-raw-get', _msg);
    }
    /**
     * @method
     * @public
     * @description Устанавливает значение актуатора
     * @param {*} _msg 
     */
    ActuatorSet(_msg) {
        const id = _msg.arg[0];
        const val = +_msg.value[0];
        let act_ch = this.GetChannel(id);
        if (act_ch && typeof act_ch.SetValue === 'function') 
            act_ch.SetValue(val);
    }
    /**
     * @method 
     * @description Вызывает команду актуатора
     * @param {Array} arg - массив типа [id, method/task_name, ...restArgs]
     */
    ExecuteCom(arg) {
        let id = arg.shift();
        let methodName = arg.shift();

        let device = this.GetChannel(id);
        if (!device) return false; 
        if (typeof device[methodName] === 'function') {
            device[methodName].apply(device, arg);
            return true;
        }
        return false;
    }
    /**
     * @method
     * @description Проверяет ID сенсора/актуатора и возвращает булевое значение, указывающее можно ли этот ID использовать.
     * @param {string} _id 
     */
    IsIDAvailable(_id) {
        return !Boolean(this.Devices.find(device => device.ID === _id));
    }
    /**
     * @method
     * @description Проверяет не заняты ли переданные пины
     * @param {[Pin]} _pins - массив пинов
     * @returns 
     */
    ArePinsAvailable(_pins) {
        for (let i = 0; i < _pins.length; i++) {
            if (this.Devices.find(device => device._Pins.includes(_pins[i]))) return false;
        };
        return true;
    }
    /**
     * @method
     * @description Инициализирует датчик
     * @param {Object}  opts Объект, хранящий неопределенное множество аргументов для инициализации датчика
     * 
     * @returns {Object} Объект датчика
     */
    CreateDevice(id, opts) {
        // opts = opts || { moduleNum: 0 };
        if (typeof id !== 'string') {
            console.log(`ERROR>> id argument must to be a string`);
            return undefined;
        }

        let dev = this.Devices.find(d => d.ID === id);
        if (dev) return dev._Channels;

        let sensorConfig = opts || Process.GetDeviceConfig(id);

        if (!sensorConfig) {
            H.Logger.Service.Log({ service: 'dm', level: 'E', msg: `Failed to get ${id} config` });
            return undefined;
        }
        let module;
        try {
            module = require(sensorConfig.modules[0]);
        } catch (e) {
            H.Logger.Service.Log({ service: 'dm', level: 'E', 
                msg: `Cannot load ${sensorConfig.modules[0]}` });
            return undefined;
        }
        
        if (sensorConfig.bus) sensorConfig.bus = this.GetBusByID(sensorConfig.bus);
        
        sensorConfig.pins = sensorConfig.pins || [];
        sensorConfig.pins = sensorConfig.pins.map(strPin => this.GetPinByStr(strPin));
        sensorConfig.id = id;

        if (!this.ArePinsAvailable(sensorConfig.pins)) {
            H.Logger.Service.Log({ service: 'DM', level: 'E', msg: `Pins [${opts.pins.join(', ')}] are already used` });
            return undefined;
        }
        try {
            let device = new module(sensorConfig, sensorConfig);
            this.AddDevice(device);
            return device._Channels;
        } catch (e) {
            H.Logger.Service.Log({ service: 'DM', level: 'E', msg: `Error creating ${id}: ${e}` });
        }
    }
    /**
     * @method
     * @description Возвращает объект пина по его имени
     * @param {String} strPin 
     * @returns 
     */
    GetPinByStr(strPin) {
        let p;
        try {
            p = eval(strPin);
        } catch (e) { }
        if (p instanceof Pin) return p;

        throw new Error(`ERROR>> Pin ${p} doesn't exist`);
    }
    /**
     * @method
     * @description Возвращает объект шины по ее ID
     * @param {string} _bus - ID шины
     * @returns 
     */
    GetBusByID(_bus) {
        let bus;
        if (_bus.startsWith('I2C')) {
            bus = H.I2Cbus.Service._I2Cbus[_bus].IDbus;
        } else if (bus.startsWith('SPI')) {
            _bus = H.SPIbus.Service._SPIbus[_bus].IDbus;
        } else if (bus.startsWith('UART')) {
            _bus = H.UARTbus.Service._UARTbus[_bus].IDbus;
        }
        return bus;
    }
}

exports = ClassDeviceManager;