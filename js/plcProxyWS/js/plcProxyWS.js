/**
 * @class является придатком WS Server и реализует передачу и обработку запросов и сообщений 
 * как со стороны WS Server (сверху), так и со стороны RouteREPL, DevicesManager, Control (снизу). 
 * Экземпляр класса инициализируется как поле класса WS Server при успешном создании последнего.
 */
class ProxyWS {
    /**
     * @constructor
     * @param {WS} _wss - WS Server
     */
    constructor(_wss) {
        this._WSS = _wss;
        this._SubID = {}; //{'MAS-1000': 'some-hash-key'} 
        this._Subs = { sensor: {} };   
        // Пришло сообщение о подписке на dm
        this._SubDM = false;    

        /************************************* SUB EVENTS **********************************/
        Object.on('proxyws-sub-sensorall', _msg => {
            H.Logger.Service.Log({ service: 'proxyws', level: 'I',  msg: `proxyws-sub-sensorall` });
            this._SubDM = true;
        });

        /************************************* READ EVENTS **********************************/

        Object.on('proxyws-send', _msg => {
            this.Send(JSON.stringify(_msg));
        });

        Object.on('all-data-raw-get', _msg => {
            if (this._SubDM) {
                this.Send(JSON.stringify(_msg));
            }
        });
    }
    /**
     * @method 
     * Вызывается извне (со стороны WSS) для передачи команд
     * @param {String} _msg - JSON пакет с командами в виде строки
     * @param {String} _key - ключ с которым WSS ассоциирует отправителя
     */
    Receive(_msg, _key) {
        let msg = null;
        try {
            msg = JSON.parse(_msg);
        } catch (e) {
            throw new err('Incorrect JSON data');
        }
        msg.metadata = { source: 'proxyws' };
        Object.emit(msg.com, msg);
    }
    /**
     * @method
     * Отправляет сообщение в виде JSON-строки на WS Server
     * @param {String} data сообщение 
     */
    Send(data) { 
        // data.MetaData.CRC = E.CRC32(JSON.stringify(data)); //расчет чексуммы
        this._WSS.Notify(data);         //отправка на WS Server
    }
    /**
     * @method 
     * @deprecated
     * Удаление подписчика из коллекции по ключу. Метод вызывается исключительно объектом WS
     * @param {String} key 
     */
    RemoveSub(key) {
        for (let k of this._SubID) {
            if (this._SubID[k] === key) delete this._SubID[k];
        };
        if (Object.keys(this._SubID).length === 0) Object.emit('repl-cm', 'EWI');
    }
}
exports = ProxyWS;