const fs = require('fs');
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
try {
    const ffmpegStatic = require('ffmpeg-static');
    ffmpeg.setFfmpegPath(ffmpegStatic);
    const ffprobeStatic = require('ffprobe-static');
    ffmpeg.setFfprobePath(ffprobeStatic.path);
} catch (e) {
    console.log("Static binaries not found, assuming system ffmpeg exists.");
}

async function runTest() {
    const tmpInput = path.join(__dirname, 'sample.mp3');
    const tmpOutput = path.join(os.tmpdir(), `output_${Date.now()}.mp4`);
    
    console.log("\n[TEST] Running the EXACT transcode logic from whatsappService.js on sample.mp3...");
    try {
        await new Promise((resolve, reject) => {
            ffmpeg(tmpInput)
                .audioCodec('aac')
                .audioBitrate('128k')
                .audioChannels(2)
                .toFormat('mp4')
                .on('end', () => resolve(tmpOutput))
                .on('error', (err) => reject(err))
                .save(tmpOutput);
        });
        
        console.log("✅ Transcode to MP4/AAC Successful!");
        console.log("Output File:", tmpOutput);
        
        // Verify codec details using ffprobe
        ffmpeg.ffprobe(tmpOutput, (err, metadata) => {
            if (err) {
                console.error("FFprobe error:", err);
                return;
            }
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
            console.log("\n[VERIFICATION] Output Audio Stream Details:");
            console.log("- Codec Name:", audioStream.codec_name);
            console.log("- Format:", metadata.format.format_name);
            console.log("- Channels:", audioStream.channels);
            console.log("- Bitrate:", Math.round(audioStream.bit_rate / 1000) + "k");
            
            if (audioStream.codec_name === 'aac' && audioStream.channels === 2 && metadata.format.format_name.includes('mp4')) {
                console.log("\n🎉 PROOF: The file is a perfectly encoded, standard MP4/AAC file ready for WhatsApp Cloud API!");
            } else {
                console.log("\n❌ Failed verification.");
            }
            
            fs.unlinkSync(tmpOutput);
        });
        
    } catch (err) {
        console.error("Transcode failed:", err);
    }
}

runTest();
