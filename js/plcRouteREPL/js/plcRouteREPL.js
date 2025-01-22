const SENDING_PERIOD = 250;

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
        this.USBIsActive = false;
        this._Sending = false;
        // авто запуск роутинга после полного старта PLC
        Object.on('complete', this.RouteOn.bind(this));
    }
    /** 
     * @getter 
     * Возвращает тип текущего подключения к консоли: NONE, USB или REMOTE
     */
    get ConsoleType() {
        let cons = E.getConsole();
        return (!cons) ? 'NONE' :
                cons.startsWith('Loopback') || cons == 'Telnet' ? 'REMOTE' : 'USB';
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
                })
                // перехват и перенаправление консоли на сокет
                _socket.pipe(LoopbackB);
                LoopbackB.pipe(_socket);
                // _socket.on('data', _stdin => {
                //     LoopbackB.write(_stdin);
                // });
                // LoopbackB.on('data', _stdout => {
                //     _socket.write(_stdout);
                //     if (this.USBIsActive) this._DefConsole.write(_stdout);
                // });
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
        return _flag;
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
     * @description Записать файл в сокет
     * @param {*} _fileName 
     * @returns 
     */
    SendFile(_fileName) {
        if (!this._Socket) return;
        E.setConsole(null);
        let file;
        try {
            file = require("Storage").read(_fileName);
        } catch (e) {
            H.Logger.Service.Log({ service: this._Name, level: 'E', msg: `Error while sending file via TCP: ${e.message}`}); 
            return; 
        }
        let CHUNKSIZE = 384;
        let i = 0;
        this._Sending = true;
        let intrv = setInterval(() => {
            // проверка работы сокета
            if (!this._Socket || !this._Socket.conn) {
                this.RouteOff();
                return;
            }
            // передача файла чанками
            if (i < file.length) {
                H.Repl.Service._Socket.write(file.substr(i, CHUNKSIZE));
                i += CHUNKSIZE;
            } else { 
                clearInterval(intrv);
                this._Sending = false;
                E.setConsole(LoopbackA, { force: false });
                // если через 2 сек не Sending все еще будет true, то закрываем соединение 
                setTimeout(() => {
                    if (!this._Sending) this._Socket.end();
                }, 2000);
            }
        }, SENDING_PERIOD);
    }
}
exports = ClassRouteREPL;
