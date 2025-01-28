import HorizonTools from "./hrztools.mjs";

const DFLT_PORT = 23;
/**
 * @function 
 * @description Собирает аргументы командной строки
 * @returns {object}
 */
const getAppArgs = () => {
    const args = process.argv.slice(2); // Убираем первые два аргумента: "node" и имя скрипта
    const parsedArgs = {};

    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('-')) {
            parsedArgs[args[i].replace('-', '')] = args[i + 1];
            i++; // Пропускаем значение
        }
    }

    // Пример запуска: node index.js -host 192.168.1.110 -upload fileToUploadName
    // Результат: { host: '192.168.1.110', upload: 'fileToUploadName' }
    return parsedArgs;
}
/**
 * @function
 * @description Парсит аргумент формата 192.168.1.1:23 в { host, port }
 * @param {string} _fullHost 
 */
const getConnOpts = _fullHost => {
    let [host, port=DFLT_PORT] = _fullHost.split(':')
    return {host, port};
}


let args = getAppArgs();
let connOpts = getConnOpts(args.host);

let app = new HorizonTools(connOpts);
if (args.download)
    app.DownloadFile(args.download);
else if (args.upload)
    app.UploadFile(args.upload);
else if (args.fileList)
    app.GetFileList(false, true);
else app.RouteRepl();