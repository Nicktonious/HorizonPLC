import fs from 'fs';
import path from 'path';

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
 * Обходит все папки и находит непустые файлы
 * @param {string} dir Путь к директории для обхода
 * @returns {Promise<string[]>} Список путей к непустым файлам
 */
async function findNonEmptyFiles(dir) {
    let nonEmptyFiles = [];

    // Читаем содержимое директории
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isFile()) {
            // Если это файл, проверяем его размер
            const stats = await fs.promises.stat(fullPath);
            if (stats.size > 0) {
                nonEmptyFiles.push(entry.name);
            }
        }
    }

    return nonEmptyFiles;
}

const getSystemTime = () => {
    let date = new Date();
    return (date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).substr(-2) +
        "-" + ("0" + date.getDate()).substr(-2) + " " + ("0" + date.getHours()).substr(-2) +
        ":" + ("0" + date.getMinutes()).substr(-2) + ":" + ("0" + date.getSeconds()).substr(-2));
}

export { getAppArgs, findNonEmptyFiles, getSystemTime };