import net, { Socket } from 'net';
import fs from 'fs';
import path from 'path';
import { findNonEmptyFiles } from './utils.mjs';

const GET_LIST_TIMEOUT = 5000;
const UPLOAD_PERIOD = 50;
const CHUNKSIZE_UPL = 64;
const MAX_TIME_NO_RECEIVE = 2000;
const SLEEP_AFTER_ERR_UPL = 5000;

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
    #ParseFileText(_data) {
        let sof = _data.indexOf(SOF);
        let eof = _data.indexOf(EOF);
        return { 
            data: _data.slice(
                sof == -1 ? 0 : sof+SOF.length,
                eof == -1 ? _data.length : eof
            ), 
            sof, 
            eof 
        };
    }
    /**
     * @method
     * @description Обработчик 'data' сокета при скачивании файла. Проверяет наличие SOF и EOF при приеме данных.
     * @param {Buffer} _chunk 
     */
    #DownloadFile_OnData(_chunk, _savePath, resolveCb) {
        if (this.downloadTimeout) clearTimeout(this.downloadTimeout);
        this.downloadTimeout = setTimeout(resolveCb, MAX_TIME_NO_RECEIVE);

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
        // TODO: создание директории _path если она не сущетсвует
        if (!Array.isArray(_fileNameList)) _fileNameList = [_fileNameList];
        const list = await this.GetFileList(); // Список всех файлов
        await this.#DownloadFile_Wrapped(_fileNameList, _path);

        if (_fileNameList[0] == '*') {
            // проверка кол-ва загруженных файлов
            let notFoundList = await this.GetNotDownloadedFiles(_path, list);
            console.log(`Не удалось скачать следующие файлы: ${notFoundList}`);
            let triesLeft = 3;
            // TODO: если не удалось скачать список файлов
            // пока остаются не скачанные файлы
            /*while (notFoundList.length && triesLeft-- > 0) {
                console.log(`Не удалось загрузить следующие файлы: ${notFoundList.join('\n')}`);
                console.log(`Новый запрос...`);
                await this.#DownloadFile_Wrapped(notFoundList, _path);
                notFoundList = await this.GetNotDownloadedFiles(_path, list);
            }*/
        }
    }

    async #DownloadFile_Wrapped(_fileNameList, _savePath) {
        return new Promise((res, rej) => {
            this.isWriting = false;
            this.socket = this.#CreateConnection();

            const startCom = this.DownloadFile_GetStartCommand(_fileNameList);
            this.socket.write(startCom);
            // Обработка данных от клиента
            // let anotherFileDownloadedCb = (_fn) => {}
            const handler = this.#DownloadFile_OnData.bind(this);
            this.socket.on('data', _data => handler(_data, _savePath, res));

            // Обработка закрытия соединения
            this.socket.on('end', () => {
                console.log('Клиент отключился.');
                if (this.isWriting) {
                    console.warn('Соединение закрыто до завершения записи файла!');
                }
                // this.writeStream?.end(); // Закрываем файл
            });
            this.socket.once('close', () => {
                console.log('Подключение закрыто');
            });

            // Обработка ошибок
            this.socket.on('error', (err) => {
                console.error('Ошибка сокета:', err);
                rej();
            });
        });
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
                    console.log(`продолжение отправки ${_filePath}`);
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
    RouteRepl() {
        let socket = this.#CreateConnection();
        socket.pipe(process.stdout);
        process.stdin.pipe(socket);

        socket.on('close', () => process.exit());
    }
    /**
     * @method
     * @description Инициирует удаление файла на PLC
     * @param {string} _fileName 
     * @returns 
     */
    async EraseFile(_fileName) {
        let fileList = await this.GetFileList() ?? [];
        if (!fileList.includes(_fileName)) {
            console.warn(`Файл ${_fileName} отсутствует, невозможно удалить`);
            return false;
        }
        await sleep(20);
        await this.#EraseFile_Wrapped(_fileName);
        await sleep(100);
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
                    socket.end();
                    res();
                });
                socket.once('connectionAttemptFailed', rej);
            } catch (e) {
                rej(e);
            }
        });
    }
}

export default HorizonTools;