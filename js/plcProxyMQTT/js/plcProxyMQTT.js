/**
 * @typedef TypePubMsg
 * @property {string} topic
 * @property {string} message
 */

/**
 * @class является придатком WS Server и реализует передачу и обработку запросов и сообщений 
 * как со стороны WS Server (сверху), так и со стороны RouteREPL, SensorManager, Control (снизу). 
 * Экземпляр класса инициализируется как поле класса WS Server при успешном создании последнего.
 */
class ClassProxyMQTT {
    /**
     * @constructor
     * @param {ClassMQTT} _mqtt - MQTT Server(publisher) object
     */
    constructor(_mqtt, _subs) {
        this._MQTT = _mqtt;
        this._Subs = { dm: { 'sensor': [], 'actuator': [] } };

        this._SkipData = false;
        this._DataSkipInterval = null;
        // EVENTS
        Object.on('complete', () => _mqtt.connect());
        Object.on('proxymqtt-sub-sensorall', this.HandlerEvents_proxymqtt_sub_sensorall.bind(this));
        Object.on('all-data-raw-get', this.HandlerEvents_all_data_raw.bind(this)); 
        this._MQTT.on('connected',    this.OnConnected.bind(this));
        this._MQTT.on('publish',      this.OnPublish.bind(this));
        this._MQTT.on('disconnected', this.OnDisconnected.bind(this));
        this._MQTT.on('error', this.OnError.bind(this));
    }

    /**
     * @method
     * @description Обработчик данных, полученных от DeviceManager 
     * @param {Object} _msg 
     */
    HandlerEvents_all_data_raw(_msg) {
        if (!this._SkipData) {
            const ch_id = _msg.arg[0];
            const topic = (this._Subs.dm.sensor
                .find(_mapObjs => _mapObjs.name == ch_id) || {})
                .address;
            if (typeof topic == 'string' && this._MQTT.connected)
                this._MQTT.publish(topic, JSON.stringify(_msg.value[0]));
        }  
    }

    /**
     * @method
     * @description Обработчик сообщения от DM.
     * Сохраняет данные для маппинга каналов с топиками.
     * Инициирует подписку на топики каналов сенсоров.
     * @param {*} _msg 
     */
    HandlerEvents_proxymqtt_sub_sensorall(_msg) {
        try {
            let list = _msg.value;
            this._Subs.dm.sensor   = list[0].sensor || [];
            this._Subs.dm.actuator = list[0].actuator || [];
            // подписываемся только на топики актуаторов
            let sub_topic_list = this._Subs.dm.actuator.map(_mapObj => _mapObj.address);
            this._MQTT.subscribe(sub_topic_list);
            H.Logger.Service.Log({ service: 'MQTT', level: 'I', msg: `MQTT subscribed on topics ${sub_topic_list}` });
        } catch (e) {
            H.Logger.Service.Log({ 
                service: 'proxymqtt', 
                level: 'E', 
                msg: `Error processing "proxymqtt-sub-sensorall" msg: ${e.message}` 
            });
        }
    }

    /**
     * @method
     * @param {TypePubMsg} pub 
     * @description Устанавливает обработчик на событие 'publish' клиента. Инициирует вызов сообщение 'dm-actuator-set' 
     */
    OnPublish(pub) {
        // Находим маппинг по топику и забираем ID канала
        const ch_id = (this._Subs.dm.actuator
            .find(_mapObj => _mapObj.address == pub.topic) || {})
            .name;
        if (typeof ch_id == 'string')
            Object.emit('dm-actuator-set', { arg: [ch_id], value: [pub.message] });
    }

    /**
     * @method
     * @description Устанавливает обработчик на событие 'disconnected' клиента
     */
    OnDisconnected() {
        H.Logger.Service.Log({ service: 'MQTT', level: 'I', msg: `MQTT disconnected!` });
        
        let c = 0;
        let interval = setInterval(() => {
            if (this._MQTT.connected) {
                clearInterval(interval);
                return;
            }
            if (++c == 3) {
                clearInterval(interval);
                H.Logger.Service.Log({ service: 'MQTT', level: 'I', msg: `MQTT failed to reconnect after ${c} retries.` });
                return;
            }
            H.Logger.Service.Log({ service: 'MQTT', level: 'I', msg: `MQTT trying to reconnect..` });
            this._MQTT.connect();
        }, 5000);
    }

    /**
     * @method
     * @description Устанавливает обработчик на событие 'connected' клиента
    */ 
    OnConnected() {
        H.Logger.Service.Log({ service: 'MQTT', level: 'I', msg: `MQTT connected!`});
        this.EmitEvents_dm_sub_sensorall();
    }

    /**
     * @method
     * @description Устанавливает обработчик на событие 'error' клиента
    */ 
    OnError(_errMsg) {
        H.Logger.Service.Log({service: 'MQTT', level: 'E', msg: `${_errMsg}`});
    }

    /**
     * @method
     * Отправляет сообщение и соответствующий ему топик на MQTT-publisher
     * @param {String} _topicName - идентификатор топика 
     * @param {String} _data сообщение 
     */
    Send(_topicName, _data) { 
        this._MQTT.publish(_topicName, _data);
    }

    /**
     * @method
     * Устанавливает максимальную частоту, с которой пакет сообщений рассылается на MQTT.
     * @param {Number} _freq - частота
     * @returns 
     */
    SetPubMaxFreq(_freq) {
        if (typeof _freq !== 'number' || _freq < 0) return false;

        this._DataSkipInterval = setInterval(() => {
            this._SkipData = !this._SkipData;
        }, 1/_freq*1000);

        return true;
    }
    /**
     * @method
     * @description Отправляет сообщение подписки на DM
     */
    EmitEvents_dm_sub_sensorall() {
        let msg = {
            metadata: { source: 'proxymqtt' },
            com: 'dm-sub-sensorall'
        }
        Object.emit(msg.com, msg);
    }
}
exports = ClassProxyMQTT;
