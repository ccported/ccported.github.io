const node_canvase = require("canvas");
const fs = require("fs");
const { Image } = node_canvase;
const path = require("path");
const sharp = require("sharp");
/*
    width: 500px;
    height: 325px;*/
const canvas = node_canvase.createCanvas(500, 325);
const ctx = canvas.getContext("2d");
async function reformat(imageSRC) {
    try {
        const loadImage = (src) => {
            return new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = src;
            });
        };

        const drawAndConvert = (image) => {
            const ratio = image.width / image.height;
            let newWidth = canvas.width;
            let newHeight = newWidth / ratio;
            
            if (newHeight < canvas.height) {
                newHeight = canvas.height;
                newWidth = newHeight * ratio;
            }
            
            const xOffset = newWidth > canvas.width ? (canvas.width - newWidth) / 2 : 0;
            const yOffset = newHeight > canvas.height ? (canvas.height - newHeight) / 2 : 0;
            ctx.clearRect(0,0,canvas.width, canvas.height);
            ctx.drawImage(image, xOffset, yOffset, newWidth, newHeight);
            return canvas.toBuffer("image/jpeg");
        };

        try {
            const image = await loadImage(imageSRC);
            return drawAndConvert(image);
        } catch (err) {
            if (err.message?.includes('Unsupported image type')) {
                // Read the file into memory first
                const inputBuffer = await fs.promises.readFile(imageSRC);
                
                // Convert using the buffer instead of the file path
                const jpegBuffer = await sharp(inputBuffer)
                    .jpeg()
                    .toBuffer();
                
                const base64Image = jpegBuffer.toString('base64');
                const dataUrl = `data:image/jpeg;base64,${base64Image}`;
                
                const convertedImage = await loadImage(dataUrl);
                return drawAndConvert(convertedImage);
            }
            throw err;
        }
    } catch (err) {
        throw err;
    }
}

// Usage:
async function processAndDeleteImage(imageSRC) {
    try {
        const newBuffer = await reformat(imageSRC);
        
        // Add a small delay to ensure file handles are closed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Now try to delete the file
        await fs.promises.unlink(imageSRC);
        
        return newBuffer;
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
}

const dirURL = "../static/assets/images/game_covers";
// Example reference that would be updated by migration script
const sampleImagePath = "https://ccported.github.io/games/assets/images/sample_game_logo.jpg";

fs.readdir(dirURL, async (err, files) => {
    console.log(files)
    if (err) {
        console.log(err);
    } else {
        try {
            for (var i = 0; i < files.length; i++) {
                const file = files[i];
                if(file.includes("reformated")){
                    continue;
                }
                console.log(file);
                const imageSRC = `${dirURL}/${file}`;
                const newSRC = await processAndDeleteImage(imageSRC);
                // remove the old file
                const destSRC = `${dirURL}/${file.split(".")[0]}.jpg`;
                console.log(destSRC);
                fs.writeFile(destSRC, newSRC, (err) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log("File saved");
                    }
                });
            }
        } catch (err) {
            console.log(err);
        }
    }
});