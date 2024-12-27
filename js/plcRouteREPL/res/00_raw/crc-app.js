let CRC32 = require("crc-32");

function addCRC(str) {
    let obj = JSON.parse(str);
    obj.MetaData.CRC = CRC32.str(str)>>>0;
    return JSON.stringify(obj);
}

function getWriteCommand(evName, ...commands) {
    let o = ({
        "MetaData": {
            "ID": 'nikita',
            "Command": []
        }
    });
    commands.forEach(com => {
        console.log([com]);
        o.MetaData.Command.push({ "com": evName, "arg": [com] });
    });
    return JSON.stringify(o);
}

// let c = `let i = setInterval(()=>process.memory(), 250)`;
// let a = '{"MetaData":{"ID":"nikita","Command":[{"com":"sensor-sub","arg":[]}],"CRC":3814734421}}';
// // console.log(addCRC(getWriteCommand('repl-write', c)));

// let u = {"MetaData": {"ID": "nikita","Command": [{ "com": "repl-sub", "arg": [] }],},"CRC": 1592949337}
// `{"MetaData": {"ID": "nikita","Command": [{"com": "repl-cm","arg": []}]},"CRC":225499666}`
// let t = {"MetaData":{"ID":"nikita","Command":[{"com":"repl-write","arg":["console.log(`5454`)"]}],"CRC":1231993470}}
console.log(
    addCRC(getWriteCommand('sensor-sub'))
);