const fs = require('fs');

const path = '/home/devendra/proj/wpcode/client/src/components/PipelineView.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add import
if (!code.includes("import LeadEditModal")) {
    code = code.replace(
        "import SendWhatsAppMessageModal from './SendWhatsAppMessageModal';",
        "import SendWhatsAppMessageModal from './SendWhatsAppMessageModal';\nimport LeadEditModal from './LeadEditModal';"
    );
}

// 2. Remove states
code = code.replace(/const \[activeTab, setActiveTab\][^;]+;/g, '');
code = code.replace(/const \[notes, setNotes\][^;]+;/g, '');
code = code.replace(/const \[tasks, setTasks\][^;]+;/g, '');
code = code.replace(/const \[appointments, setAppointments\][^;]+;/g, '');
code = code.replace(/const \[callLogs, setCallLogs\][^;]+;/g, '');
code = code.replace(/const \[newNote, setNewNote\][^;]+;/g, '');
code = code.replace(/const \[newTask, setNewTask\][^;]+;/g, '');
code = code.replace(/const \[newAppointment, setNewAppointment\][^;]+;/g, '');
code = code.replace(/const \[newCallLog, setNewCallLog\][^;]+;/g, '');

// 3. Update handleEditLeadClick
code = code.replace(
    /const handleEditLeadClick = async \(lead: Lead\) => \{[\s\S]*?\n    \};/,
    `const handleEditLeadClick = async (lead: Lead) => {\n        setEditingLead(lead);\n        setIsEditLeadModalOpen(true);\n    };`
);

// 4. Remove other handlers
code = code.replace(/const handleAddNote = async \(\) => \{[\s\S]*?\n    \};\n/g, '');
code = code.replace(/const handleDeleteNote = async \(noteId: string\) => \{[\s\S]*?\n    \};\n/g, '');
code = code.replace(/const handleAddFollowUp = async \(\) => \{[\s\S]*?\n    \};\n/g, '');
code = code.replace(/const handleAddAppointment = async \(\) => \{[\s\S]*?\n    \};\n/g, '');
code = code.replace(/const handleAddCallLog = async \(\) => \{[\s\S]*?\n    \};\n/g, '');

// 5. Remove setActiveTab
code = code.replace(/setTimeout\(\(\) => setActiveTab\('follow_up'\), 100\);/g, '');
code = code.replace(/setActiveTab\('opportunity'\);/g, '');

// 6. Replace modal
const startString = '{/* Edit Lead Modal */}';
const endString = '</Modal>';
const startIndex = code.indexOf(startString);
const endIndex = code.indexOf(endString, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const modalCode = code.substring(startIndex, endIndex + endString.length);
    if (modalCode.includes('Contact Info (Edit)')) {
        const replacement = `{/* Edit Lead Modal */}
            <LeadEditModal
                isOpen={isEditLeadModalOpen}
                onClose={() => setIsEditLeadModalOpen(false)}
                leadId={editingLead?.id}
                leadData={editingLead}
                onUpdate={() => {
                    if (selectedPipelineId) {
                        fetchBoardData(selectedPipelineId);
                    }
                }}
            />`;
        code = code.replace(modalCode, replacement);
    }
}

fs.writeFileSync(path, code);
console.log("Updated PipelineView.tsx successfully.");
