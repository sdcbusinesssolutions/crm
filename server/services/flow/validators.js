
/**
 * Validator Utility for AskInput Node
 */

const EMAIL_REGEX = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

// Common extensions
const EXTENSIONS = {
    image: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    video: ['mp4', 'mov', 'avi', 'mkv'],
    audio: ['mp3', 'wav', 'ogg', 'm4a'],
    document: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv']
};

class Validators {

    validate(input, config) {
        if (!config) return { valid: true }; // No config, accept all?

        const { inputType } = config;

        if (inputType === 'Media') {
            return this.validateMedia(input, config);
        } else {
            return this.validateText(input, config);
        }
    }

    validateMedia(input, config) {
        // Input for media might be an object { type: 'image', url: '...', mime_type: '...' } 
        // Assuming 'input' is the message object from WhatsApp.

        // If the user sent text but we expect media:
        if (typeof input === 'string') {
            return { valid: false, error: 'Expected media file, received text.' };
        }

        const msgType = input.type; // image, video, document, audio

        // Handle Legacy Config (mediaInputTypes array) vs New Config (mediaInputType string)
        let allowedType = '';
        if (config.mediaInputType) {
            allowedType = config.mediaInputType.toLowerCase();
        } else if (config.mediaInputTypes && config.mediaInputTypes.length > 0) {
            allowedType = config.mediaInputTypes[0].toLowerCase();
        } else {
            return { valid: true }; // No restrictions?
        }

        if (msgType !== allowedType) {
            return { valid: false, error: `Invalid media type: ${msgType}. Expected: ${allowedType}` };
        }

        // Validate Allowed Formats / Extensions
        if (config.allowedFormats && config.allowedFormats.length > 0) {
            // Try to get extension from filename or mime_type
            let extension = '';
            let filename = '';

            if (input[msgType]) {
                filename = input[msgType].filename || '';
                // Mime type fallback could be added here
            }

            if (filename) {
                const parts = filename.split('.');
                if (parts.length > 1) {
                    extension = parts.pop().toLowerCase();
                }
            }

            // If we can't determine extension (e.g. image without filename), strict validation might fail.
            // For strictness, if extension is required but not found -> fail? 
            // Or check MIME type mapping? 
            // Making it simple: if extension is known, check it.

            if (extension) {
                const allowed = config.allowedFormats.map(f => f.toLowerCase().trim().replace('.', ''));
                if (!allowed.includes(extension)) {
                    return { valid: false, error: `Invalid file format: .${extension}. Allowed: ${allowed.join(', ')}` };
                }
            }
        }

        return { valid: true };
    }

    validateText(input, config) {
        // Input should be string
        let text = '';
        if (typeof input === 'string') text = input;
        else if (input.text && typeof input.text === 'string') text = input.text; // Simplified object
        else if (input.type === 'text') text = input.text.body; // Raw object
        else return { valid: false, error: 'Expected text input.' };

        const { textInputType, validationRegex } = config;

        if (textInputType === 'Email') {
            if (!EMAIL_REGEX.test(text)) return { valid: false, error: 'Invalid email format.' };
        }
        else if (textInputType === 'Phone') {
            if (!PHONE_REGEX.test(text)) return { valid: false, error: 'Invalid phone format.' };
        }
        else if (textInputType === 'Number') {
            if (isNaN(parseFloat(text))) return { valid: false, error: 'Expected a number.' };
        }
        else if (textInputType === 'Date') {
            if (validationRegex) {
                try {
                    // Create case-insensitive regex
                    const regex = new RegExp(validationRegex, 'i');
                    if (!regex.test(text)) {
                        return { valid: false, error: config.dateFormat ? `Invalid date format. Expected: ${config.dateFormat}` : 'Invalid date format.' };
                    }
                } catch (e) {
                    console.warn('[Validators] Invalid Regex for Date:', validationRegex);
                    // Fallback if regex is broken (unlikely if from UI)
                    if (isNaN(Date.parse(text))) return { valid: false, error: 'Invalid date format.' };
                }
            } else {
                // Fallback: If regex missing, use dateFormat (defaulting to DD/MM/YYYY)
                let fallbackRegex = '';
                const fmt = config.dateFormat || 'DD/MM/YYYY';

                if (fmt === 'DD/MM/YYYY') fallbackRegex = '^(0?[1-9]|[12][0-9]|3[01])/(0?[1-9]|1[0-2])/\\d{4}$';
                else if (fmt === 'MM/DD/YYYY') fallbackRegex = '^(0?[1-9]|1[0-2])/(0?[1-9]|[12][0-9]|3[01])/\\d{4}$';
                else if (fmt === 'YYYY-MM-DD') fallbackRegex = '^\\d{4}-(0?[1-9]|1[0-2])-(0?[1-9]|[12][0-9]|3[01])$';
                else if (fmt === 'DD-MM-YYYY') fallbackRegex = '^(0?[1-9]|[12][0-9]|3[01])-(0?[1-9]|1[0-2])-\\d{4}$';
                else if (fmt === 'DD-MMM-YYYY') fallbackRegex = '^(0?[1-9]|[12][0-9]|3[01])-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\\d{4}$';
                else if (fmt === 'YYYY/MM/DD') fallbackRegex = '^\\d{4}/(0?[1-9]|1[0-2])/(0?[1-9]|[12][0-9]|3[01])$';

                if (fallbackRegex) {
                    try {
                        const regex = new RegExp(fallbackRegex, 'i');
                        if (!regex.test(text)) {
                            return { valid: false, error: `Invalid date format. Expected: ${fmt}` };
                        }
                    } catch (e) {
                        console.warn('[Validators] Invalid Fallback Regex:', fallbackRegex);
                        return { valid: false, error: 'Invalid date format.' };
                    }
                } else {
                    return { valid: false, error: 'Invalid date configuration.' };
                }
            }
        }
        else if ((textInputType === 'Custom' || textInputType === 'Text') && validationRegex) {
            try {
                const regex = new RegExp(validationRegex);
                if (!regex.test(text)) return { valid: false, error: 'Input does not match required format.' };
            } catch (e) {
                console.warn('Invalid Regex in node config:', validationRegex);
            }
        }

        return { valid: true };
    }
}

module.exports = new Validators();
