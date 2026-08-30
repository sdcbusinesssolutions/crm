const ffmpegPath = require('ffmpeg-static');
const { execFile } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Converts a WebM audio buffer to OGG (Opus) format suitable for WhatsApp voice notes.
 * @param {Buffer} inputBuffer - The WebM audio buffer
 * @returns {Promise<Buffer>} - The converted OGG audio buffer
 */
async function convertWebmToOgg(inputBuffer) {
    return new Promise((resolve, reject) => {
        if (!ffmpegPath) {
            return reject(new Error('ffmpeg-static not found'));
        }

        const tempId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const inputPath = path.join(os.tmpdir(), `input-${tempId}.webm`);
        const outputPath = path.join(os.tmpdir(), `output-${tempId}.ogg`);
        
        try {
            fs.writeFileSync(inputPath, inputBuffer);
        } catch (writeErr) {
            return reject(writeErr);
        }
        
        execFile(ffmpegPath, [
            '-i', inputPath,
            '-vn',                // CRITICAL: Strip video/metadata streams that MediaRecorder adds
            '-c:a', 'libopus',    // WhatsApp expects Opus codec for OGG voice notes
            '-b:a', '64k',        // Standard bitrate for voice
            '-ar', '48000',       // Standard opus sample rate
            '-vbr', 'on',         // Variable bitrate
            '-compression_level', '10',
            '-y', outputPath      // Overwrite output
        ], (error, stdout, stderr) => {
            // Cleanup input file
            if (fs.existsSync(inputPath)) {
                try { fs.unlinkSync(inputPath); } catch (e) { console.error('Failed to cleanup input temp file:', e); }
            }
            
            if (error) {
                console.error('[AudioConverter] FFmpeg conversion failed:', stderr);
                if (fs.existsSync(outputPath)) {
                    try { fs.unlinkSync(outputPath); } catch (e) {}
                }
                return reject(error);
            }
            
            try {
                const outputBuffer = fs.readFileSync(outputPath);
                // Cleanup output file
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
                resolve(outputBuffer);
            } catch (readError) {
                console.error('[AudioConverter] Failed to read converted file:', readError);
                reject(readError);
            }
        });
    });
}

module.exports = {
    convertWebmToOgg
};
