import dgram from 'node:dgram';
import { getSystemTime } from './utils.mjs';
/**
 * @class
 * @description Транспортный класс, предоставляющий функционал
 * записи сообщений в Graylog
 *  * Тип для передачи аргументов создания транспорта
 * @typedef  {Object} options    - тип аргумента, содержащий необходимые для передачи поля
 * @property {String} server     - IP-адрес сервера Graylog, необязательное поле (по-умолчанию localhost)
 * @property {Number} port       - порт сервера Graylog, необязательное поле (по-умолчанию 12201)
 * @property {String} source     - имя источника сообщений, необязательное поле (по-умолчанию plcDefault)
 * @property {String} facility   - идентификатор ПО/процесса, генерирующего сообщения, необязательное поле (по-умолчанию HorizonPLC)
 * @property {Number} bufferSize - максимальный размер сообщения с учём размера UDP пакета, необязательное поле (по-умолчанию 1350)
 */
class GrayLogTransport {
    /**
     * @constructor
     * @param {Object} options      - параметры сервера Graylog
     */
    constructor(options) {
        this.server = options.server || '192.168.50.251';
        this.port = options.port || 5142;
        this.source = options.hostname;
        this.facility = options.facility || 'HorizonPLC';
        this.bufferSize = options.bufferSize || 1350;
        this.msg = {
            version    : '1.1',
            host       : this.source,
            facility   : this.facility,
            service_bus    : 'appBus'
        }
        this.socket = dgram.createSocket('udp4');    // UDP сокет для отправки сообщений
        /*this.socket.on('error', (err) => {
            console.log(err);
        });
        this.socket.on('close', (event) => {
            console.log(event);
        });*/
    }
    /**
     * @method
     * @description
     * Форматирует сообщение и отправляет его на сервер Graylog 
     * @param {Object} _packet      - объект, содержащий сообщение для логирования и доп. информацию
     */
    Log(_packet) {
        Object.assign(this.msg, _packet);
        const toSend = JSON.stringify(this.msg);
        // Process._Wifi.UDPHost(this.server, this.port);
        try {
            this.socket.send(toSend, 0, toSend.length, this.port, this.server, (err, bytes) => {
                if (err || bytes > this.bufferSize) {
                   throw err;
                }
            });
        }
        catch (e) {
            console.log(`[${getSystemTime()}] ${srvc} | ERROR | ${e}. Recreating. . .`);
            this.socket = dgram.createSocket('udp4');
        }
    }
}

/**
 * @class
 * Класс предоставляет инструменты для логирования 
 */
class ClassLogger {
    /**
     * @constructor
     */
    constructor(options) {
        if (this.Instance) {
            return this.Instance;
        } else {
            ClassLogger.prototype.Instance = this;
        }
        this.name = 'ClassLogger'; //переопределяем имя типа
        this._Glog = new GrayLogTransport(options || {});
    }
    /**
     * @getter
     * Объект с уровнями логов 
     */
    get LogLevel() {
        return ({
            CRITICAL: 2,
            ERROR: 3,
            WARN: 4,
            NOTICE: 5,
            INFO: 6,
            DEBUG: 7,
        });
    }
    Capitalize(_str) {
        const str = _str.toUpperCase();
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    /**
     * @method
     * @description
     * Выводит сообщение в консоль и подготавлиеввает его к отправке в Graylog
     * @param {Number} _msg           - сообщение для логирования
     * @returns 
     */
    Log(_msg) {
        let flevel = -1;
        let fdesc = 'Unknown';
        const logdesc = ['CRITICAL', 'ERROR', 'WARNING', 'NOTICE', 'INFO', 'DEBUG'];      
        const level = logdesc.indexOf(logdesc.find((lvl) => lvl.startsWith(_msg.level.toUpperCase())));
        if (level != -1) {
            fdesc = logdesc[level];
            flevel = level+2;
        }

        this._Glog.Log({message: _msg.msg, level: flevel, level_desc: fdesc, service: _msg.service, full_message: _msg.obj || {}});
    }
}
export default ClassLogger;