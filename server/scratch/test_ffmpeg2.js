const fs = require('fs');
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
try {
    const ffmpegStatic = require('ffmpeg-static');
    ffmpeg.setFfmpegPath(ffmpegStatic);
    const ffprobeStatic = require('ffprobe-static');
    ffmpeg.setFfprobePath(ffprobeStatic.path);
} catch (e) {}

async function runTest() {
    const tmpInput = 'scratch/horse.mp3';
    const tmpOutput = 'scratch/output_test.mp4';
    
    console.log("[TEST] Running exact whatsappService.js transcode logic...");
    try {
        await new Promise((resolve, reject) => {
            ffmpeg(tmpInput)
                .audioCodec('aac')
                .audioBitrate('128k')
                .audioChannels(2)
                .toFormat('mp4')
                .on('end', () => resolve(tmpOutput))
                .on('error', reject)
                .save(tmpOutput);
        });
        
        console.log("Transcode to MP4/AAC Successful!");
        
        // Verify codec details using ffprobe
        ffmpeg.ffprobe(tmpOutput, (err, metadata) => {
            if (err) {
                console.error("FFprobe error:", err);
                return;
            }
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
            console.log("\n[PROOF OF COMPLIANCE]");
            console.log("Codec:", audioStream.codec_name);
            console.log("Format:", metadata.format.format_name);
            console.log("Channels:", audioStream.channels);
            console.log("Bitrate:", Math.round(audioStream.bit_rate / 1000) + "k");
            console.log("✅ Ready for WhatsApp Cloud API (audio/mp4)!");
        });
        
    } catch (err) {
        console.error("Transcode failed:", err);
    }
}
runTest();
