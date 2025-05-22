const SOF = '<< <';
const EOF = '>> >';
const SON = '<<$<';
const EON = '>>$>';

const EVENT_CH_CONSOLE = 'repl-set-cons';
const COM_TIMEOUT =  15000;//1200000; // 20min
const isSocket = _o => typeof _o == 'object' && _o.hasOwnProperty('conn') && typeof _o.end == 'function';
/**
 * @typedef TypeBusOpts
 * @property {string} index
 * @property {number} baudrate
 */
/**
 * @typedef TypeOpts
 * @property {number} port
 * @property {TypeBusOpts} bus 
 */
/**
 * @class
 * Класс предоставляет возможность удаленного подключения к консоли по TCP-соединению.
 */
class ClassRouteREPL {
    /**
     * @constructor
     * @param {TypeOpts} _opts 
     */
    constructor(_opts) {
        _opts = _opts || {};
        this._DfltConsole = eval(E.getConsole()); // eval позволяет хранить инициализированный объект UART шины. Это необходимо для работы с его функционалом из класса Route   
        this._IsOn = false;
        this._Name = 'RouteREPL';
        this._Port = _opts.port || 23;
        this._Sending = false;
        // авто запуск роутинга после полного старта фреймворка
        Object.on('complete', () => {
            // если была передана UART-шина, нужно сохранить ссылку на нее и выполнить setup()
            if (_opts.bus) try {
                this._Bus = H.UARTbus.Service._UARTbus[_opts.bus.index].IDbus;
                this._Bus.setup(_opts.bus.baudrate);
            } catch (e) {
                H.Logger.Service.Log({ service: this._Name, level: 'I', msg: `Failed to setup UART bus ${_opts.bus.index}: ${e}` });
            }
            this.RouteOn();
        });
    }
    /** 
     * @getter 
     * Возвращает тип текущего подключения к консоли: USB | UART | TCP | 'null' | ''
     */
    get ConsoleType() {
        let console = E.getConsole();

        if (console == 'LoopbackA' && isSocket(this._Source)) return 'TCP';
        if (console == 'USB' && E.isUSBConnected()) return console; //USB
        if (!console) return 'null';
        if (console.startsWith('Serial')) return 'UART';
        return '';      //  unexpected behavior
    }
    /**
     * @method
     * Запуск TCP-сервера, мониторинга UART шины и USB
     * Перехват консоли при подключении клиента. Объединение потоков с консоли на сокет и обратно.
     */
    RouteOn() {
        try {
            if (H.Network)  
                this.ListenTCP(); 
            if (this._Bus instanceof Serial && this._Bus.isConnected()) 
                this.ListenUART();
            if (this._DfltConsole instanceof Serial) 
                this.ListenUSB();
        } catch (e) {
            H.Logger.Service.Log({ service: this._Name, level: 'I', msg: e });
            this.RouteOff();
        }
        this.on(EVENT_CH_CONSOLE, this.SetConsole.bind(this));
        this._IsOn = true;
    }
    /**
     * @method 
     * Возвращает работу консоли в состояние по умолчанию (как при запуске Espruino IDE). 
     * Рассчитан на применение сугубо в целях отладки.
     */
    RouteOff() {
        E.setConsole(this._DfltConsole, { force: true });
        if (isSocket(this._Source)) this._Source.end();
        this.removeAllListeners(EVENT_CH_CONSOLE);
        this._IsOn = false;
    }
    /**
     * @method
     * Запуск TCP-сервера. Перехват консоли при подключении клиента.
     */
    ListenTCP() {
        try {
            this._Server = require('net').createServer(_socket => {
                // завершение предыдущего подключения
                if (isSocket(this._Source)) this._Source.end();
                this._Source = _socket;
                _socket.on('close', () => {
                    this._Source = null;
                });
                this.emit(EVENT_CH_CONSOLE, _socket);
            });
            this._Server.listen(this._Port);
        } catch (e) {
            H.Logger.Service.Log({ service: this._Name, level: 'E', msg: `Error on TCP server: ${e}` });       
        }
    }

    /**
     * @method
     * @description Запускает мониторинг UART-шины. 
     * При поступлении сообщения \r\n устанавливает консоль на шину. Если 
     */
    ListenUART() {
        this._Bus.on('data', _stdin => {
            // \r приводит к перехвату консоли
            if (_stdin.indexOf('\r') > -1 && this.ConsoleType != 'UART') {
                this.emit(EVENT_CH_CONSOLE, this._Bus);
            }
        });
    }

    /**
     * @method
     * @description Запускает мониторинг USB. 
     * Периодический просмотр статуса подключения USB, в зависимости от которого обновляется setConsole()
     */
    ListenUSB() {
        // обработчик, слушающий событие 'data' когда USB перестает быть активным интерфейсом
        // \r приводит к перехвату консоли
        const usbHandler = (_stdin => {
            if (this.ConsoleType != 'USB' && _stdin.indexOf('\r') > -1 && !this._Sending) {
                this._DfltConsole.removeListener('data', usbHandler);
                this.emit(EVENT_CH_CONSOLE, this._DfltConsole);
            }
        }).bind(this);

        //  по событию EVENT_CH_CONSOLE либо назначить обнаботчик на USB либо удалить его
        this.on(EVENT_CH_CONSOLE, _source => {
            if (_source == this._DfltConsole) 
                this._DfltConsole.removeListener('data', usbHandler);
            else 
                this._DfltConsole.on('data', usbHandler);
        });

        // проверка что USB не был физически отключен (это нельзя перехватить как событие)  
        const watchActivity = ms => setTimeout(() => {
            if (this.ConsoleType == 'USB' && !E.isUSBConnected()) 
                this.emit(EVENT_CH_CONSOLE, null);
            
            this._USBtimeout = watchActivity(ms)

        }, ms);

        if (this._USBtimeout) clearTimeout(this._USBtimeout);
        this._USBtimeout = watchActivity(COM_TIMEOUT);
    }
    /**
     * @method
     * @description 
     * @param {} _source 
     */
    SetConsole(_source, _cb) {
        if (isSocket(this._Source)) this._Source.end();
        // сокеты связываются с консолью через Loopback'и
        if (isSocket(_source)) {
            _source.pipe(LoopbackB);
            LoopbackB.pipe(_source);
            E.setConsole(LoopbackA, { force: true });
        }
        else E.setConsole(_source, { force: true });
        this._Source = _source;
        try {
            H.Logger.Service._HaveConsole = this.ConsoleType != 'null' ? true : false;
        } catch (e) {}
        if (typeof _cb =='function') _cb();
    }
    /**
     * @deprecated
     * @param {*} _flag 
     * @returns 
     */
    isREPLConnected(_flag) {
        let func = USB.isConnected || E.isUSBConnected || (() => false);
        return Boolean(this._IsOn || func());
    }
    /**
     * @method
     * @description Загружает файл в хранилище
     * @param {string} _fileName 
     * @returns 
     */
    UploadFile(_fileName, _fileSize) {
        if (this._Sending) return;
        return new Promise((res, rej) => {
            // блокировка консоли чтобы данные с сокета не могли попасть в файл
            E.setConsole(null, { force: true });
            let offset = 0;
            this._Source.removeAllListeners('data');
            let tail = '';
            let timeout = null;
            let resetTimeout = () => {
                if (timeout) clearTimeout(timeout)
                timeout = setTimeout(rej, 2000);
            }
            /**
             * @function
             * @description Обработчик сокета для чтения данных 
             * @param {string} _data 
             */
            let socketHandler = _data => {
                resetTimeout();
                if (tail.length) _data = tail + _data;
                let eof = _data.indexOf(EOF);
                let sof = _data.indexOf(SOF);
                if (sof > eof && eof != -1) sof = -1;
                // текст обрезается либо по EOF последовательности (1),
                // либо за EOF.length-1=3 символа до конца (2)
                let dataCut = _data.slice(
                    sof == -1 ? 0 : sof+SOF.length,
                    _data.endsWith(SOF) ? _data.length : eof == -1 ? _data.length-EOF.length+1 : eof
                );
                // если (1) то tail - текст после EOF
                // если (2) то tail - последние 3 символа  
                tail = _data.endsWith(SOF) ? '' : eof == -1 
                    ? _data.slice(_data.length-EOF.length+1) 
                    : _data.slice(eof+EOF.length);

                if (dataCut.length && (sof > -1 || offset > 0)) {
                    require('Storage').write(_fileName, dataCut, offset, _fileSize);
                    offset += dataCut.length;
                }
                // чтение файла завершено
                if (eof > -1) {
                    this._Source.removeListener('data', socketHandler);
                    E.setConsole(LoopbackA, { force: true });
                    H.Logger.Service.Log({ service: this._Name, level: 'I', msg: `Uploaded new file over TCP: ${_fileName} with ${_fileName} bytes ` });
                    if (timeout) clearTimeout(timeout);
                    res();
                }
            }
            this._Source.prependListener('data', socketHandler);
        }).then(this.RouteOn.bind(this));
    }
    /**
     * @method
     * @returns Возвращает список файлов в хранилище
     */
    GetFileList() {
        return require('Storage').list(undefined, { sf: false });
    }
    /**
     * @method
     * @description Отправляет на сокет список файлов
     */
    SendFileList() {
        E.setConsole(null, { force: true });
        this._Source.write(`${SOF}${this.GetFileList().join(', ')}${EOF}`);
        setTimeout(() => {
            this.RouteOn();
        }, 250);
    }
    /**
     * @method
     * @param {[string]|string} _args - список файлов которые необходимо отправить 
     * @returns {Promise}
     */
    SendFiles(_args) {
        // указание отправить все доступные файлы
        if (_args == '*')
            _args = this.GetFileList().filter(_fn => _fn != 'plcRouteREPL.min.js');
        // если получен массив, то поочередно выполняется отправка указанных файлов
        if (Array.isArray(_args) && _args.length > 0) {
            // создаём цепочку промисов, чтобы отправить файлы последовательно
            return _args.reduce((promiseChain, fileName) => {
                return promiseChain.then(() => this.SendFile(fileName));
            }, Promise.resolve()).then(this.RouteOn.bind(this)); // начальная цепочка - resolved Promise
        }
    }
    /**
     * @method
     * @description Записать файл в сокет
     * @param {string} _fileName 
     * @returns {Promise}
     */
    SendFile(_fileName) {
        return new Promise((res, rej) => {
            if (!this._Source) rej();
            // блокировка консоли
            E.setConsole(null, { force: true });
            this._Source.removeAllListeners('data');
            let file;
            try {
                file = require("Storage").read(_fileName);
                if (!file) throw new Error(`Failed to read ${_fileName}`);
            } catch (e) {
                H.Logger.Service.Log({ service: this._Name, level: 'E', msg: `Error while sending ${_fileName} file via TCP: ${e.message}` });
                rej();
                return;
            }
            this._Sending = true;
            setTimeout(() => {
                this._Source.write(`${SON}${JSON.stringify({ fn: _fileName })}${EON}`);
                this._Source.write(SOF);
                E.pipe(file, this._Source, {
                    end: false,
                    chunkSize: 64,
                    complete: () => {
                        this._Source.write(EOF);
                        this._Sending = false;
                        // E.setConsole(LoopbackA, { force: false });
                        // H.Logger.Service.Log({ service: 'Repl', level: 'I', msg: `Sent file over TCP: ${_fileName} `});
                        setTimeout(res, 500);
                    }
                });
            }, 250);
        });
    }
}
exports = ClassRouteREPL;
