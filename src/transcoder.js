const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Ensure media directory exists
const mediaDir = path.join(__dirname, '../media');
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
}

function transcodeToMp3(inputPath, filename) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(mediaDir, filename);

        ffmpeg(inputPath)
            .toFormat('mp3')
            .audioBitrate('48k')
            .audioFrequency(24000)
            .on('error', (err) => {
                console.error('An error occurred: ' + err.message);
                reject(err);
            })
            .on('end', () => {
                console.log('Transcoding finished!');
                resolve(filename);
            })
            .save(outputPath);
    });
}

module.exports = {
    transcodeToMp3
};
