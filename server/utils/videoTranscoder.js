const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

let ffmpegPath = 'ffmpeg'; // Default host fallback
try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic) {
        ffmpegPath = ffmpegStatic;
    }
} catch (err) {
    console.log('[videoTranscoder] ffmpeg-static not found, falling back to system ffmpeg');
}

/**
 * Transcodes a video into a pure, WhatsApp-compliant H.264 / AAC MP4 file.
 * Automatically handles videos without sound.
 * 
 * @param {Buffer} inputBuffer - The original raw video buffer
 * @returns {Promise<Buffer>} - The transcoded WhatsApp-native MP4 buffer
 */
async function transcodeToWhatsAppVideo(inputBuffer) {
    return new Promise((resolve, reject) => {
        const uniqueId = Date.now().toString() + Math.floor(Math.random() * 10000).toString();
        // Uses OS temp dir or local tmp
        const tempDir = process.env.TEMP || process.env.TMPDIR || '/tmp';
        const inputPath = path.join(tempDir, `wa_in_${uniqueId}.mp4`);
        const outputPath = path.join(tempDir, `wa_out_${uniqueId}.mp4`);

        try {
            // Write input to disk to allow ffmpeg to process it
            fs.writeFileSync(inputPath, inputBuffer);

            const args = [
                '-i', inputPath,
                '-c:v', 'libx264',
                '-preset', 'ultrafast', // 🚀 Maximize transcode speed
                '-threads', '0',        // 🚀 Use all available CPU cores
                '-profile:v', 'baseline',
                '-level', '3.0',
                '-pix_fmt', 'yuv420p',
                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-strict', 'experimental',
                '-movflags', '+faststart',
                '-y', // Overwrite
                outputPath
            ];

            console.log(`[videoTranscoder] Running: ${ffmpegPath} ${args.join(' ')}`);

            execFile(ffmpegPath, args, { timeout: 120000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('FFmpeg Transcode Error:', error.message);
                    if (stderr) console.error('FFmpeg Stderr:', stderr);
                    // Cleanup
                    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                    return reject(new Error('Failed to transcode video for WhatsApp.'));
                }

                // Processing success: read back the transcoded buffer
                try {
                    const outputBuffer = fs.readFileSync(outputPath);
                    // Cleanup
                    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

                    resolve(outputBuffer);
                } catch (readErr) {
                    reject(readErr);
                }
            });
        } catch (globalErr) {
            reject(globalErr);
        }
    });
}

module.exports = {
    transcodeToWhatsAppVideo
};
