const ClassDevice = require('plcDevice.min.js');
const ClassChannel = require('plcChannel.min.js').ClassChannel;
/**
 * @class
 * Класс, который закладывает в будущие классы актуаторов поля и методы, необходимые для унификации работы с отдельными каналами, объекты которых становится возможным выделять из "реального" объекта актуатора.
 */
class ClassActuator extends ClassDevice {
    /**
     * @constructor
     * @param {ActuatorPropsType} _opts
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

                this._Channels[chNum] = new ClassChannelActuator(this, +chNum, ch_config);  // инициализируем и сохраняем объекты каналов
            } catch (e) {
                H.Logger.Service.Log({ service: this.Name || this.ID || 'Device', lvl: 'E', msg: `Error creating channel ${_chName}: ${e}` });
            }
        });
    }

    /**
     * @method
     * Обязывает инициализировать стандартные таски модуля
     */
    InitTasks() { }

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
     * Обязывает выключить актуатор. 
     * @param {Number} _chNum - номер канала, работу которого необходимо прекратить
     */
    Off(_chNum, _opts) { }
}

/**
 * @class
 * Класс, представляющий каждый отдельно взятый канал актуатора. При чем, каждый канал является "синглтоном" для своего родителя.  
 */
class ClassChannelActuator extends ClassChannel {
    /**
     * @constructor
     * @param {ClassActuator} device - ссылка на основной объект актуатора
     * @param {Number} num - номер канала
     */
    constructor(device, num, _opts) {
        if (device._Channels[num] instanceof ClassChannelActuator) return device._Channels[num];    //если объект данного канала однажды уже был иницииализирован, то вернется ссылка, хранящаяся в объекте физического сенсора  
        ClassChannel.call(this, device, num, _opts);
        this._Tasks = {};
        this._ActiveTask = null;
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
        return this._Device.InitTasks(this._ChNum);
    }
    /**
     * @method
     * Метод обязывает изменить состояние актуатора
     * @param {number} _val
     * @param {object} [_opts]
     * @returns {Boolean} 
     */
    SetValue(_val, _opts) {
        let val = _val;
        if (this._IsNumType) {
            val = this._Suppression.SuppressValue(val);
            val = this._Transform.TransformValue(val);
        }

        return this._Device.SetValue(this._ChNum, val, _opts) ? this : false
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
        return this._Device.GetInfo(this._ChNum, _opts);
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

exports = ClassActuator;