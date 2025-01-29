import fs from 'fs';
import path from 'path';

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

        /*if (entry.isDirectory()) {
            // Если это папка, обходим её рекурсивно
            const subDirFiles = await findNonEmptyFiles(fullPath);
            nonEmptyFiles = nonEmptyFiles.concat(subDirFiles);
        } else */
        if (entry.isFile()) {
            // Если это файл, проверяем его размер
            const stats = await fs.promises.stat(fullPath);
            if (stats.size > 0) {
                nonEmptyFiles.push(fullPath);
            }
        }
    }

    return nonEmptyFiles;
}


export { findNonEmptyFiles };