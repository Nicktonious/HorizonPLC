const SOF = '<< <';
const EOF = '>> >';
const SON = '<<$<';
const EON = '>>$>';

function pipe(_fn, _dest, _opts) {
    let offset = 0;
    let l = require("Storage").read(_fn).length;
    let interval = setInterval(() => {
        // let str = require("Storage").read(_fn, offset, _opts.chunkSize);
        if (!_dest.conn || offset >= l /*!str.length*/) {
            clearInterval(interval);
            if (_opts.complete) _opts.complete();
            if (_opts.end && _dest) _dest.end();
            return;
        }
        _dest.write(require("Storage").read(_fn, offset, _opts.chunkSize));
        offset += _opts.chunkSize;   
        // delete str;
    }, 50);
}
/**
 * @class
 * Класс предоставляет возможность удаленного подключения к консоли по TCP-соединению.
 */
class ClassRouteREPL {
    constructor(_opts) {
        _opts = _opts || {};
        this._DefConsole = eval(E.getConsole()); // eval позволяет хранить инициализированный объект UART шины. Это необходимо для работы с его функционалом из класса Route   
        this._IsOn = false;
        this._Name = 'RouteREPL';
        this._ReconnectTry = 0;
        this._Port = _opts.port || 23;
        this._Sending = false;
        // авто запуск роутинга после полного старта PLC
        Object.on('complete', this.RouteOn.bind(this));
    }
    /** 
     * @getter 
     * Возвращает тип текущего подключения к консоли: NONE, USB или REMOTE
     */
    get ConsoleType() {
        return this._IsOn ? 'Telnet' : E.isUSBConnected() ? 'USB' : 'NONE';
    }
    /**
     * @method
     * Запуск TCP-сервера
     * Перехват консоли при подключении клиента. Объединение потоков с консоли на сокет и обратно.
     */
    RouteOn() {
        try {
            this._Server = require('net').createServer(_socket => {
                // завершение предыдущего подключения
                if (this._Socket) this._Socket.end();
                this._Socket = _socket;
                _socket.on('close', () => {
                    this._Socket = null;
                    setTimeout(() => {
                        // возврат стандартной консоли если не появился новый сокет
                        if (!this._Socket) this.RouteOff();
                    }, 50);
                });

                _socket.pipe(LoopbackB);
                LoopbackB.pipe(this._Socket);

                E.setConsole(LoopbackA, { force: false });   //Перехватываем консоль
            });
            this._Server.listen(this._Port);
        } catch (e) {
            H.Logger.Service.Log({ service: 'RouteREPL', level: 'I', msg: e });
            if (++this._ReconnectTry < 3) {
                this.RouteOn();
            } else {
                this.RouteOff();
                this._ReconnectTry = 0;
            }
        }

        this._IsOn = true;
    }
    /**
     * @method
     * Через этот метод RouteREPL получает команду к непосредственно выполнению.
     * @param {String} _stdin - команда, которая передается в REPL
     * @returns 
     */
    Receive(_stdin) {
        LoopbackB.write(_stdin);
    }

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
            E.setConsole(null);
            let offset = 0;
            this._Socket.removeAllListeners('data');
            /**
             * @function
             * @description Обработчик сокета для чтения данных 
             * @param {string} _data 
             */
            let socketHandler = _data => {
                let sof = _data.indexOf(SOF);    // начало файла
                let eof = _data.indexOf(EOF);    // конец файла
                _data = _data.slice(sof != -1 ? sof + SOF.length : 0, eof == -1 ? _data.length : eof);

                require('Storage').write(_fileName, _data, offset, _fileSize);
                // чтение файла завершено
                if (eof > -1) {
                    this._Socket.removeListener('data', socketHandler);
                    E.setConsole(LoopbackA);
                    H.Logger.Service.Log({ service: 'Repl', level: 'I', msg: `Uploaded new file over TCP: ${_fileName} with ${_fileName} bytes ` });
                    res();
                }
                offset += _data.length;
            }
            this._Socket.prependListener('data', socketHandler);
        });
    }
    /**
     * @method 
     * Возвращает работу консоли в состояние по умолчанию (как при запуске Espruino IDE). 
     * Рассчитан на применение сугубо в целях отладки.
     */
    RouteOff() {
        E.setConsole(this._DefConsole, { force: true });
        if (this._Socket) this._Socket.end();
        this._IsOn = false;
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
        E.setConsole(null);
        this._Socket.write(`${SOF}${this.GetFileList().join(', ')}${EOF}`);
        setTimeout(() => {
            this.RouteOff();
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
            }, Promise.resolve()).then(this.RouteOff); // начальная цепочка - resolved Promise
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
            if (!this._Socket) rej();
            // блокировка консоли
            E.setConsole(null);
            this._Socket.removeAllListeners('data');
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
                this._Socket.write(`${SON}${JSON.stringify({ fn: _fileName })}${EON}`);
                this._Socket.write(SOF);
                E.pipe(file, this._Socket, {
                    end: false,
                    chunkSize: 64,
                    complete: () => {
                        this._Socket.write(EOF);
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
