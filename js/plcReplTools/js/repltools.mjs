import net from 'net';
import fs from 'fs';
import path from 'path';

const WAIT_LAST_CHUNK = 1000;
const GET_LIST_TIMEOUT = 5000;
const SOF = /*['-> null'*/ '<< <';
const EOF = '>> >';
const SON = '<<$<';
const EON = '>>$>';
const CHUNKSIZE_UPL = 64;
const sleep = async ms => new Promise((res, rej) => setTimeout(() => res()), ms);

class HorizonTools {
    constructor(_connectOpts) {
        // { host: '192.168.1.71', port: 23 }
        this._connectOpts = _connectOpts;
    }
    /**
     * @method
     * @description Команда, которая передается в REPL PLC для инициализации скачивания файла
     * @returns {String}
     */
    DownloadFile_GetStartCommand(..._fileNames) { 
        let argsStr = _fileNames.map(_fn => `'${_fn}'`).join(',');
        return `\r\nH.Repl.Service.SendFiles([${argsStr}])\r\n`; 
    }
    /**
     * @method
     * @description Команда, которая передается в REPL PLC для инициализации загрузки файла
     * @returns {String}
     */
    Upload_GetStartCommand(_fileName, _fileSize) { return `\r\nH.Repl.Service.UploadFile('${_fileName}', ${_fileSize})\r\n`; }
    /**
     * @method
     * @description Команда, которая передается в REPL PLC для инициализации получения списка файлов
     * @returns {String}
     */
    GetFileList_GetStartCommand() { return `\r\nH.Repl.Service.SendFileList()\r\n`; }
    /**
     * 
     * @param {string} _data 
     */
    #DownloadFile_ParseFileName(_data) {
        try {
            let s = _data.indexOf(SON)+SON.length;
            let e = _data.indexOf(EON);
            let tempStr = _data.slice(s, e);
            return JSON.parse(tempStr).fn;
        } catch (e) {
            return undefined;
        }
    }
    /**
     * @method
     * @description Обработчик 'data' сокета при скачивании файла. Проверяет наличие SOF и EOF при приеме данных.
     * @param {Buffer} _chunk 
     */
    #DownloadFile_OnData(_chunk, _savePath) {
        const data = (this.tail ?? '') + _chunk.toString(); // Преобразуем данные в строку
        let sof = data.indexOf(SOF);
        let eof = data.indexOf(EOF);
        if (!this.isWriting) {
            let fn = this.#DownloadFile_ParseFileName(data);
            if (!fn) return;
            this.writeStream = fs.createWriteStream(`${_savePath}/${fn}`);
            this.writeStream.name = fn;
            console.log(`Начало записи файла ${fn}`);
        }
        if (sof !== -1 || this.isWriting) {
            let dataCut = data.slice(
                sof == -1 ? 0 : sof+SOF.length,
                eof == -1 ? data.length : eof
            );
            this.writeStream.write(dataCut, () => {
                if (eof != -1) {
                    this.isWriting = false;
                    this.tail = data.split(eof)[1];
                    this.writeStream.end(() => {
                        console.log(`Окончание записи файла ${this.writeStream?.name}`);
                    });
                }
            });
            this.isWriting = true;
        }
    }

    #CreateConnection() {
        return net.createConnection(this._connectOpts.port, this._connectOpts.host);
    }
    /**
     * @method
     * @description Выполняет подключение к PLC и инициирует скачивание указанного файла с него
     * @param {string} _fileName 
     */
    async DownloadFile(_fileName) {
        if (_fileName == '*') {
            // let list = await this.GetFileList();
            // await this.#DownloadFile_Wrapped(_fileName);
            // if ()
        }
        this.#DownloadFile_Wrapped(_fileName, './temp_from_plc');
    }

    async #DownloadFile_Wrapped(_fileName, _savePath) {
        this.isWriting = false;
        this.socket = this.#CreateConnection();

        const startCom = this.DownloadFile_GetStartCommand(_fileName);
        this.socket.write(startCom);
        // Обработка данных от клиента
        const handler = this.#DownloadFile_OnData.bind(this);
        this.socket.on('data', _data => handler(_data, _savePath));

        // Обработка закрытия соединения
        this.socket.on('end', () => {
            console.log('Клиент отключился.');
            if (this.isWriting)
                console.warn('Соединение закрыто до завершения записи файла!');
            // this.writeStream?.end(); // Закрываем файл
        });
        this.socket.on('close', () => {
            console.log('Подключение закрыто');
        });

        // Обработка ошибок
        this.socket.on('error', (err) => {
            console.error('Ошибка сокета:', err);
        });
    }
    /**
     * @method
     * @description Выполняет подключение к PLC и инициирует загрузку указанного файла на него
     * @param {string} _fileName - имя файла который требуется загрузить
     * @param {string} [_uploadName=_fileName] - имя с которым загрузить файл (опционально)
     */
    UploadFile(_fileName, _uploadName) {
        let uploadName = _uploadName ?? path.basename(_fileName);
        let socket = this.#CreateConnection();
        let file = fs.readFileSync(_fileName, 'utf-8').toString();
        let fileSize = file.length;
        file = `<< <${file}>> >`;
        socket.on('connect', async () => {
            socket.write(this.Upload_GetStartCommand(uploadName, fileSize));
            let offset = 0;
            let interval = setInterval(async () => {
                if (socket.closed || offset >= fileSize) {
                    clearInterval(interval);
                    console.log('\r\nПередача файла завершена');
                    socket.end();
                    return;
                }
                let data = file.slice(offset, offset+CHUNKSIZE_UPL);
                socket.write(data);
                offset += data.length;

                process.stdout.write(`Загрузка файла: ${offset}/${fileSize}\r`);
            },50);

            socket.on('close', () => {
                console.log('Подключение закрыто');
            });
        });
    }
    /**
     * @method
     * @description Выполняет подключение к PLC и инициирует получение списка файлов на PLC
     */
    async GetFileList(_fileName, print) {
        try {
            let list = await this.#GetFileList_Wrapped();
            if (print) console.log(list.join('\n'));
            if (_fileName) fs.writeFileSync(_fileName, list.join('\n'), 'utf-8');
            return list;
        } catch (e) {
            console.log(`Не удалось получить список файлов: ${e}`);
        }
    }

    #GetFileList_Wrapped() {
        return new Promise((res, rej) => {
            let isWriting = false;
            let fileNameList = [];
            let tail = '';
            let socket = this.#CreateConnection();
            socket.write(this.GetFileList_GetStartCommand());

            socket.on('data', _data => {
                let data = _data.toString();
                let sof = data.indexOf(SOF);
                let eof = data.indexOf(EOF);
                isWriting = isWriting || sof != -1;
                // если isWriting == false значит пришедшие данные откидываются
                if (!isWriting) return;
                data = data.slice(
                    sof == -1 ? 0 : sof+SOF.length,
                    eof == -1 ? _data.length : eof
                );
                let newFiles = (tail + data).split(', ');
                tail = newFiles.at(-1) ?? '';
                fileNameList.push(...newFiles);
                if (eof > -1) 
                    // все данные получены
                    res(fileNameList);
            });
            socket.on('close', rej);
            // таймаут чтобы избежать вечного ожидания
            setTimeout(rej, GET_LIST_TIMEOUT);
        });
    }
    /**
     * @method
     * @description Выполняет подключение к консоли
     */
    RouteRepl() {
        let socket = this.#CreateConnection();
        socket.pipe(process.stdout);
        process.stdin.pipe(socket);

        socket.on('close', () => process.exit());
    }
}

export default HorizonTools;

// let tools = new HorizonTools({ host: '192.168.1.71', port: 23 }).DownloadFile('plcProcess.min.js');
// let tools = new HorizonTools({ host: '192.168.1.106', port: 23 }).UploadFile('l2.txt', 'testupload');
