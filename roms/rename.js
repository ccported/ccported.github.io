const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'roms');

fs.readdir(directoryPath, (err, folders) => {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }

    folders.forEach(folder => {
        const folderPath = path.join(directoryPath, folder);
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                return console.log('Unable to scan folder: ' + err);
            }

            files.forEach(file => {
                const filePath = path.join(folderPath, file);
                const fileExtension = path.extname(file);
                const fileNameWithoutExtension = path.basename(file, fileExtension);

                if (fileExtension !== '.zip') {
                    const newFileName = `${fileNameWithoutExtension}${fileExtension}.zip`;
                    const newFilePath = path.join(folderPath, newFileName);

                    fs.rename(filePath, newFilePath, (err) => {
                        if (err) {
                            console.log('Error renaming file: ' + err);
                        } else {
                            console.log(`Renamed: ${filePath} -> ${newFilePath}`);
                        }
                    });
                }
            });
        });
    });
});