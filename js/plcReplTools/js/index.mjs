import HorizonTools from "./repltools.mjs";

const DFLT_PORT = 23;
/**
 * @function 
 * @description Собирает аргументы командной строки
 * @returns {object}
 */
const getAppArgs = () => {
    const args = process.argv.slice(2); // Убираем первые два аргумента
    const parsedArgs = {};
    let currentKey = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('-')) {
            currentKey = args[i].replace('-', '');
            parsedArgs[currentKey] = []; // Создаем массив для хранения значений
        } else if (currentKey) {
            parsedArgs[currentKey].push(args[i]); // Добавляем значение в массив
        }
    }

    // Преобразуем массивы с одним элементом в строку (как раньше)
    Object.keys(parsedArgs).forEach(key => {
        if (parsedArgs[key].length === 1) {
            parsedArgs[key] = parsedArgs[key][0];
        }
    });

    return parsedArgs;
};
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
    app.DownloadFile(args.download, args.path);
else if (args.upload)
    app.UploadFile(args.upload);
else if (args.fileList)
    app.GetFileList(args.path, true);
else if (args.erase) 
    app.EraseFile(args.erase);
else app.RouteRepl();