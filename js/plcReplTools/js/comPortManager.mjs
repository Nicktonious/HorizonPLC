import { SerialPort } from "serialport";

class ClassSerialManager {
    constructor() {
        this.port = null;
        this.path = null;
        this.options = null;
        this.opening = false;
    }

    async getConnection(path, baud) {
        // Если порт уже открыт и соответствует пути — вернуть его
        if (this.port && this.port.isOpen && this.path === path) {
            return this.port;
        }

        // Если в процессе открытия — дождаться
        if (this.opening) {
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.getConnection(path, options);
        }

        this.opening = true;

        // Если порт существует — закрыть
        if (this.port) {
            await this._closePort();
            this.port = null;
        }

        // Открываем новый порт
        this.port = new SerialPort({
            path,
            autoOpen: false,
            baudRate: baud,
        });

        this.path = path;
        // this.options = options;

        return new Promise((resolve, reject) => {
            this.port.open((err) => {
                this.opening = false;
                if (err) {
                    return reject(new Error('Ошибка открытия порта: ' + err.message));
                }
                resolve(this.port);
            });
        });
    }

    _closePort() {
        return new Promise((resolve) => {
            if (!this.port || !this.port.isOpen) return resolve();

            this.port.close((err) => {
                if (err) {
                    console.warn('Ошибка при закрытии порта:', err.message);
                }
                resolve();
            });
        });
    }
}

export default ClassSerialManager;
