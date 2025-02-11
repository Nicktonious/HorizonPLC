import net, { Socket } from 'net';
import fs from 'fs';
import path from 'path';
import { findNonEmptyFiles } from './utils.mjs';
import LoggingStream from './loggingStream.mjs';
import ClassLogger from './plcLogger.mjs';

const GET_LIST_TIMEOUT = 2500;
const UPLOAD_PERIOD = 50;
const CHUNKSIZE_UPL = 64;
const MAX_TIME_NO_RECEIVE = 2500;
const SLEEP_AFTER_ERR_UPL = 2000;
const SLEEP_AFTER_GET_LIST = 100;

const DWNLD_DFLT_PATH = './temp_from_plc';

const SOF = '<< <';
const EOF = '>> >';
const SON = '<<$<';
const EON = '>>$>';

const sleep = async ms => new Promise(res => setTimeout(res, ms));

class HorizonTools {
    constructor(_connectOpts) {
        // { host: '192.168.1.71', port: 23 }
        this._connectOpts = _connectOpts;
        try {
            // const ClassLogger = cjsrequire('../../plcLogger/js/plcLogger.js'); 
            this._logger = new ClassLogger();
        } catch (e) {
            this._logger = null;
        }
    }
    /**
     * @method
     * @description Команда, которая передается в REPL PLC для инициализации скачивания файла
     * @returns {[String]}
     */
    DownloadFile_GetStartCommand(_fileNames) { 
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
     * 
     * @param {string} _data 
     * @returns {}
     */
    #DownloadFile_ProcessText(_data) {
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
        const tail = _data.endsWith(SOF) ? '' : eof == -1 ? _data.slice(_data.length-EOF.length+1) : _data.slice(eof+EOF.length);
        // const end = eof > -1;
        return { eof, sof, data: dataCut, tail };
    }
    /**
     * @method
     * @description Обработчик 'data' сокета при скачивании файла. Проверяет наличие SOF и EOF при приеме данных.
     * @param {Buffer} _chunk 
     */
    async #DownloadFile_OnData(_savePath, resolveCb, _chunk) {
        if (this.downloadTimeout) clearTimeout(this.downloadTimeout);
        this.downloadTimeout = setTimeout(() => {
            if (this.tail?.length) {
                this.#DownloadFile_OnData('', _savePath, resolveCb);
                clearTimeout(this.downloadTimeout);
            }
            else setTimeout(() => { if (!this.socket.destroyed) 
                this.socket.end();
                resolveCb(); 
            }, MAX_TIME_NO_RECEIVE);
        }, MAX_TIME_NO_RECEIVE);

        let text = (this.tail??'')+_chunk.toString();
        let { sof, eof, data, tail } = this.#DownloadFile_ProcessText(text);
        this.tail = tail;
        if (!this.writeStream || this.writeStream.ending) {
            let fn = this.#DownloadFile_ParseFileName(text);
            if (!fn) return;
            this.writeStream = fs.createWriteStream(`${_savePath}/${fn}`);
            this.writeStream.name = fn;

            console.log(`Начало записи файла ${fn}`);
        }
        let ending = eof != -1 || _chunk == '';
        if (ending) this.writeStream.ending = true;
        this.#DownloadFile_Write(this.writeStream, data, ending);
    }
    /**
     * 
     * @param {WritableStream} _ws 
     * @param {string} _data 
     * @param {boolean} end 
     * @returns 
     */
    #DownloadFile_Write(_ws, _data, end) {
        return new Promise((res, rej) => {
            let { name } = this.writeStream; 

            _ws.write(_data, () => {
                if (end) {
                    _ws.end(() => {
                        console.log(`Окончание записи файла ${_ws?.name}`);
                        res();
                    });
                } else res();
            });
        });
    }

    #CreateConnection() {
        return net.createConnection(this._connectOpts.port, this._connectOpts.host);
    }
    // Функция для проверки загруженных файлов
    async GetNotDownloadedFiles(_dir, _totalList) {
        const foundList = await findNonEmptyFiles(_dir); // Непустые файлы
        return _totalList.filter(_fn => !foundList.includes(_fn)); // Список незагруженных
    }
    /**
     * @method
     * @description Выполняет подключение к PLC и инициирует скачивание указанного файла с него
     * @param {string | [string]} _fileNameList 
     */
    async DownloadFile(_fileNameList, _path = DWNLD_DFLT_PATH) {
        // TODO: создание директории _path если она не сущеcтвует
        if (!Array.isArray(_fileNameList)) _fileNameList = [_fileNameList];
        let list = await this.GetFileList(); // Список всех файлов
        if (_fileNameList[0] != '*') {
            let nonExistFiles = _fileNameList.filter(_fn => !list.includes(_fn));
            if (nonExistFiles.length) console.error(`На PLC нет файлов ${nonExistFiles} для удаления`);
            return;
        }
        await this.#DownloadFile_Wrapped(_fileNameList, _path);
        // проверка кол-ва загруженных файлов
        let notFoundList = await this.GetNotDownloadedFiles(_path, _fileNameList[0] == '*' ? list : _fileNameList);
        let triesLeft = 3
        // TODO: убрать filter
        while (notFoundList.filter(_fn => _fn!='plcRouteREPL.min.js').length && triesLeft-- > 0) {
            console.log(`Не удалось скачать следующие файлы: ${notFoundList}`);
            console.log(`Новый запрос...`);
            await this.#DownloadFile_Wrapped(notFoundList, _path);
            notFoundList = await this.GetNotDownloadedFiles(_path, list);
            await sleep(100);
        }
        if (notFoundList?.length) console.log(`Не удалось скачать следующие файлы: ${notFoundList}`);
    }
    /**
     * NOT USED YET
     * @param {*} _fileNameList 
     * @param {*} _path 
     */
    async DownloadFiles(_fileNameList, _path = DWNLD_DFLT_PATH) {
        if (!Array.isArray(_fileNameList)) _fileNameList = [_fileNameList];
        let list = await this.GetFileList(); // Список всех файлов
        // TODO: создание директории _path если она не сущеcтвует
        let tries = 0;
        let success = false;
        while (tries < 3 && !success) {
            for await (const _fn of _fileNameList) {
                try {
                    await this.#DownloadFile_Wrapped([_fn], _path);
                    // проверка кол-ва загруженных файлов
                    let notFoundList = await this.GetNotDownloadedFiles(_path, _fileNameList[0] == '*' ? list : _fileNameList);

                    if (notFoundList?.length) console.log(`Не удалось скачать следующие файлы: ${notFoundList}`);
                    else success = true;
                } catch (e) {
                    console.error(e);
                }
                tries++;
            }
        }
    }

    async #DownloadFile_Wrapped(_fileNameList, _savePath) {
        return new Promise((res, rej) => {
            this.isWriting = false;
            this.socket = this.#CreateConnection();

            const startCom = this.DownloadFile_GetStartCommand(_fileNameList);
            this.socket.write(startCom);
            // Обработка данных от клиента
            // const handler = this.#DownloadFile_OnData.bind(this);
            this.socket.on('data', d => this.#DownloadFile_OnData(_savePath, res, d));

            // Обработка закрытия соединения
            this.socket.on('end', () => {
                console.log('Передача данных завершена.');
                if (!this.writeStream.closed) {
                    console.warn('Соединение закрыто до завершения записи файла!');
                }
                // this.writeStream?.end(); // Закрываем файл
            });
            this.socket.once('close', () => {
                console.log('Подключение закрыто');
                res();
            });

            // Обработка ошибок
            this.socket.on('error', (err) => {
                console.error('Ошибка сокета:', err);
                rej();
            });
        });
    }
    #DownloadFile_CheckTimeout() {
        if (this.downloadTimeout) clearTimeout(this.downloadTimeout);
        this.downloadTimeout = setTimeout(() => {
            if (this.tail?.length) {
                this.#DownloadFile_OnData('', _savePath, resolveCb);
                clearTimeout(this.downloadTimeout);
                setTimeout(() => { if (!this.socket.destroyed) this.socket.end() }, MAX_TIME_NO_RECEIVE);
            }
            else resolveCb();
        }, MAX_TIME_NO_RECEIVE);
    }
    /**
     * @method
     * @description Выполняет подключение к PLC и инициирует загрузку указанного файла на него
     * @param {string} _filePath - имя файла который требуется загрузить либо директории из которой требуется загрузить все файлы
     * @param {string} [_uploadName=_fileName] - имя с которым загрузить файл (опционально)
     */
    async UploadFile(_filePath, _uploadName) {
        let fstat = fs.statSync(_filePath);
        // если папка, выкачиваются все файлы
        if (fstat.isDirectory()) {
            // список путей к файлам
            let fileList = await findNonEmptyFiles(_filePath);
            let errCount = 0;
            for await (let filePath of fileList) {
                try {
                    await this.#UploadFile_Wrapped(filePath, path.basename(filePath));
                    await sleep(100);
                } catch (e) {
                    // TODO: 
                    if (++errCount == 5) break;
                    console.log(`Ошибка при отправке ${_filePath}: ${e}`);
                    await sleep(SLEEP_AFTER_ERR_UPL);
                    console.log(`Продолжение отправки ${_filePath}`);
                    continue;
                    // await this.#UploadFile_Wrapped(filePath, path.basename(filePath));
                }
            }
            return Promise.resolve();
        } else if (fstat.isFile()) {
            return await this.#UploadFile_Wrapped(_filePath, _uploadName ?? path.basename(_filePath));
        } else return Promise.reject();
    }

    async #UploadFile_Wrapped(_filePath, _uploadName) {
        return new Promise((res, rej) => {
            let uploadName = _uploadName ?? path.basename(_filePath);
            let socket = this.#CreateConnection();
            let file = fs.readFileSync(_filePath, 'utf-8').toString();
            let fileSize = file.length;
            // при подключении 
            socket.once('connect', async () => {
                socket.write(this.Upload_GetStartCommand(uploadName, fileSize));
                await this.#SendFileToSocket(socket, file);
                res();
            });
            socket.once('error', rej);
            socket.once('close', () => {
                rej();
                console.log('Подключение закрыто');
            });
        });
    }
    /**
     * @method
     * @description Разбивает файл на чанки и отправляет их на сокет по интервалу.
     * @param {Socket} _socket 
     * @param {string} _text 
     * @returns 
     */
    #SendFileToSocket(_socket, _text) {
        return new Promise((res, rej) => {
            let offset = 0;
            let fileSize = _text.length;
            let file = SOF + _text + EOF;
            let interval = setInterval(async () => {
                if (_socket.closed) {
                    clearInterval(interval);
                    console.log('\r\nПередача файла завершена из за преждевременного закрытия соединения');
                    return rej();
                }
                if (offset >= file.length) {
                    clearInterval(interval);
                    console.log('\r\nПередача файла завершена');
                    _socket.end();
                    return res();
                }
                let data = file.slice(offset, offset+CHUNKSIZE_UPL);
                console.log(data);
                _socket.write(data);
                offset += data.length;

                process.stdout.write(`Загрузка файла: ${offset}/${fileSize}\r`);
            }, UPLOAD_PERIOD);
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
            await sleep(SLEEP_AFTER_GET_LIST);
            return list;
        } catch (e) {
            console.log(`Не удалось получить список файлов: ${e}`);
            await sleep(SLEEP_AFTER_GET_LIST);
        }
    }

    #GetFileList_Wrapped() {
        return new Promise((res, rej) => {
            let isWriting = false;
            let fileNameList = [];
            let tail = '';
            let socket = this.#CreateConnection();
            socket.write(this.GetFileList_GetStartCommand());
            // let data = '';
            // while (!(data=socket.read()))

            socket.on('data', _data => {
                let data = _data.toString();
                // console.log(data);
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
                newFiles.pop();
                fileNameList.push(...newFiles);
                if (eof > -1) {
                    // все данные получены
                    socket.end();
                    res(fileNameList);
                };
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
    async RouteRepl() {
        return new Promise((res, rej) => {
            let sessionID = new Date().getTime();
            const logFunc = this._logger ? ({msg, obj}) => this._logger.Log({ service: 'Repl', msg, obj, level: 'I' }) : (() => {});
            let logStream = new LoggingStream(logFunc, sessionID); 

            let socket = this.#CreateConnection();
            socket.pipe(logStream).pipe(process.stdout);
            process.stdin.pipe(socket);

            socket.once('error', rej);
            socket.once('close', res);
        });
    }
    /**
     * @method
     * @description Инициирует удаление файла на PLC
     * @param {string} _fileName 
     * @returns 
     */
    async EraseFile(_fileName) {
        let fileList = await this.GetFileList();
        if (!fileList.includes(_fileName)) {
            console.warn(`Файл ${_fileName} отсутствует, невозможно удалить`);
            return false;
        }
        await this.#EraseFile_Wrapped(_fileName);
        // await sleep(100); CHECK IF ERR
        fileList = await this.GetFileList();
        if (fileList.includes(_fileName)) {
            console.warn(`Не удалось удалить ${_fileName}`);
            return false;
        }
        console.log(`${_fileName} успешно удалён`);
        return true;
    }

    async #EraseFile_Wrapped(_fileName) {
        return new Promise((res, rej) => {
            try {
                let socket = this.#CreateConnection();
                socket.once('connect', async () => {
                    socket.write(`\r\nrequire('Storage').erase('${_fileName}')\r\n`);
                    socket.end(res);
                });
                socket.once('connectionAttemptFailed', rej);
            } catch (e) {
                rej(e);
            }
        });
    }
}

export default HorizonTools;