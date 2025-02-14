import { Transform } from "node:stream";

class LoggingStream extends Transform {
    #i = 0;
    constructor(_logFunc, _sessionID) {
        super();
        this._Log = _logFunc;
        this._sessionID = _sessionID;
    }
    get I() { return ++this.#i; }

    Log(type, _txtMsg) {
        this._Log?.({
            obj: { metadata: { type, count: this.I, sessionID: this._sessionID, user: process.env.USERNAME }, msg: _txtMsg },
            msg: _txtMsg
        });
    }
    _transform(chunk, encoding, callback) {
        // Отправка в UDP логер
        let fullMsg = chunk.toString();
        this.Log(fullMsg);
        let splitInd = fullMsg.indexOf('\r\n=');
        if (splitInd > -1) {
            this.Log('i', fullMsg.slice(0, splitInd));
            this.Log('o', fullMsg.slice(splitInd, fullMsg.length));
        } else {
            this.Log('o', fullMsg);
        }

        this.push(chunk); // Передача данных дальше в stdout
        callback();
    }
    
    _final(callback) {
        this.udpSocket.close(); // Закрываем сокет при завершении
        callback();
    }
}
export default LoggingStream;