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
                cons.startsWith('Loopback') ? 'REMOTE' : 'USB';
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
                E.setConsole(LoopbackA, { force: true });   //Перехватываем консоль
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
}
exports = ClassRouteREPL;
