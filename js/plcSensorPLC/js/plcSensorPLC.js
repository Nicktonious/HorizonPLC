const ClassSensor = require('plcSensor.min.js');

/**
 * @class
 * @description Класс виртуального сенсора, предназначенного для мониторинга PLC
 */
class ClassSensorPLC extends ClassSensor {
    constructor(_opts) {
        ClassSensor.call(this, _opts);
        // вкл. Bypass в каналах, возвращающих string
        this._Channels[2]._Bypass = true;
        this._Channels[6]._Bypass = true;
        this._Channels[7]._Bypass = true;
        // Запуск всех каналов с частотой заданной в конфиге либо 1 р/сек 
        this._Channels.forEach(_ch => _ch.Start(1000/_opts.pollFreq || 1));
    }
    
    Start(_chNum, _period, _opts) {
        if (_chNum < 0 || _chNum >= this._QuantityChannel || typeof _period !== 'number') return false;
        this._Channels[_chNum].Status = 1;

        if (!this._Interval) {
            this._Interval = setInterval(() => {
                this._Channels[0].Value = E.getTemperature();
                this._Channels[1].Value = getTime();
                this._Channels[2].Value = Process.GetSystemTime();
                this._Channels[3].Value = process.memory().total;
                this._Channels[4].Value = process.memory().free;
                this._Channels[5].Value = process.memory().flash_length;
                this._Channels[6].Value = H.Network ? H.Network.Service ? H.Network.Service._Ip : undefined : undefined;
                this._Channels[7].Value = getSerial();
            }, _period);
        }
        return true;
    }

    Stop(_chNum) {
        this._Channels[_chNum].Status = 0;
        if (!this._Channels.map(ch => ch.Status).find(s => s !== 0)) 
            clearInterval(this._Interval);
        return true;
    }
}
exports = ClassSensorPLC;