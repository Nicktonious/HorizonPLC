import HorizonTools from "./repltools.mjs";
import { getAppArgs } from "./utils.mjs";

const DFLT_PORT = 23;
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
let logOpts = args.log ? getConnOpts(args.log) : undefined;

let app = new HorizonTools(connOpts);

(async () => { 
if (args.download)
    return await app.DownloadFile(args.download, args.path);
else if (args.upload)
    return await app.UploadFile(args.upload);
else if (args.fileList)
    return await app.GetFileList(args.path, true);
else if (args.erase) 
    return await app.EraseFile(args.erase);
else 
    return await app.RouteRepl(logOpts);
})().finally(process.exit);
