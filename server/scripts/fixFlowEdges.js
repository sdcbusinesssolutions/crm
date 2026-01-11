
const { supabase } = require('../lib/supabaseClient');

async function fixFlow() {
    const flowId = '4dd540ae-3d75-4a74-9ed0-e4537c5db005';
    const nodes = [
        {
            "id": "onMessage-1764356960351",
            "data": {
                "label": "On Message",
                "keywords": ["wel"],
                "messageType": "Text",
                "phoneNumbers": []
            },
            "type": "onMessage",
            "position": { "x": 1120.2000122070312, "y": 254 }
        },
        {
            "id": "ctaMessage-1764356965164",
            "data": {
                "url": "https://www.google.com",
                "body": "image body",
                "label": "Send CTA",
                "footer": "image footer",
                "headerUrl": "https://cdn.pixabay.com/photo/2015/01/07/15/51/woman-591576_1280.jpg",
                "headerText": "",
                "headerType": "Image",
                "displayText": "Click "
            },
            "type": "ctaMessage",
            "position": { "x": 1555.3999938964844, "y": 206 }
        },
        {
            "id": "ctaMessage-1764357018935",
            "data": {
                "url": "https://www.google.com",
                "body": "header  body text",
                "label": "Send CTA",
                "footer": "text  footer",
                "headerUrl": "",
                "headerText": "hader text mesg",
                "headerType": "Text",
                "displayText": "Click "
            },
            "type": "ctaMessage",
            "position": { "x": 1980.3999938964844, "y": 169 }
        },
        {
            "id": "ctaMessage-1764357626252",
            "data": {
                "url": "https://www.google.com",
                "body": "Body video",
                "label": "Send CTA 3",
                "footer": "footer video cta",
                "headerUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                "headerText": "",
                "headerType": "Video",
                "displayText": "click here"
            },
            "type": "ctaMessage",
            "position": { "x": 2498.3999938964844, "y": 168 }
        }
    ];

    const edges = [
        {
            "id": "e-onMessage-1764356960351-default-ctaMessage-1764356965164",
            "source": "onMessage-1764356960351",
            "target": "ctaMessage-1764356965164",
            "sourceHandle": "default"
        },
        {
            "id": "e-ctaMessage-1764356965164-default-ctaMessage-1764357018935",
            "source": "ctaMessage-1764356965164",
            "target": "ctaMessage-1764357018935",
            "sourceHandle": "default"
        },
        {
            "id": "e-ctaMessage-1764357018935-default-ctaMessage-1764357626252",
            "source": "ctaMessage-1764357018935",
            "target": "ctaMessage-1764357626252",
            "sourceHandle": "default"
        }
    ];

    console.log('Updating flow with working video URL...');
    const { error } = await supabase
        .from('flows')
        .update({ nodes, edges })
        .eq('id', flowId);

    if (error) {
        console.error('Error updating flow:', error);
    } else {
        console.log('Flow updated successfully');
    }
}

fixFlow();
