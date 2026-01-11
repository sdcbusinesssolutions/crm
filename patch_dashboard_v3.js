const fs = require('fs');
const path = require('path');

const filePath = path.resolve('client/src/components/Dashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The opening div tag content we expect
const startTag = 'className="flex-1 flex flex-col justify-center gap-4 overflow-y-auto custom-scrollbar px-2"';
const startTagIndex = content.indexOf(startTag);

if (startTagIndex === -1) {
    console.error('Start tag not found!');
    // Allow fuzzy match?
    process.exit(1);
}

// Find the start of the div ( <div ... )
const divStartIndex = content.lastIndexOf('<div', startTagIndex);

// Find the end of this div block. It ends before "Revenue Forecast".
// Unique string in next card: "Revenue Forecast"
const nextCardMarker = 'Revenue Forecast';
const nextCardIndex = content.indexOf(nextCardMarker, divStartIndex);

if (nextCardIndex === -1) {
    console.error('Next card not found!');
    process.exit(1);
}

// Find the last </div> before the next card
const divEndIndex = content.lastIndexOf('</div>', nextCardIndex);
// This '</div>' closes the card wrapper? No, it closes the 'flex-1' div?
// Let's look at structure:
/*
   <div ... card wrapper ...>
      <div ... header ...> ... </div>
      <div ... body (flex-1) ...>  <-- We want to replace this
          ...
      </div>
   </div>
   <div ... next card wrapper ...>
*/

// So there are TWO closing divs before next card.
// The last one is the card wrapper closing.
// The one before that is the body closing.

const cardWrapperEndIndex = content.lastIndexOf('</div>', nextCardIndex);
// Skip whitespace backwards?
// Search backwards from cardWrapperEndIndex
const bodyEndIndex = content.lastIndexOf('</div>', cardWrapperEndIndex - 1);

// So we replace from divStartIndex to bodyEndIndex + 6 ('</div>'.length)

console.log(`Replacing from ${divStartIndex} to ${bodyEndIndex + 6}`);

const replacement = `<div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar px-1">
                                    <EngagementCard stats={stats} />
                                </div>`;

const finalContent = content.substring(0, divStartIndex) + replacement + content.substring(bodyEndIndex + 6);

fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('Successfully patched Dashboard.tsx (v3)');
