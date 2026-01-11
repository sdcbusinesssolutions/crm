
import React, { useState } from 'react';
import { NodeType } from '../types';
import {
  MessageIcon, ImageFileIcon, VideoFileIcon, AudioFileIcon, DocumentFileIcon, WebhookIcon, TimingIcon, 
  ListIcon, QuickReplyIcon, CtaIcon, GsheetIcon, CodeIcon, AskLocationIcon, TriggerIcon, OnMessageIcon, 
  ChevronDownIcon, ConditionIcon, BookmarkIcon, SetWebhookIcon, CloseIcon
} from './icons';

interface NodesPanelProps {
  onAddNode: (type: NodeType) => void;
  onClose?: () => void;
}

const triggers = [{ type: NodeType.OnMessage, label: 'On Message', icon: <OnMessageIcon /> }];
const nodeTypes = [
  { type: NodeType.TextMessage, label: 'Text', icon: <MessageIcon /> },
  { type: NodeType.MediaMessage, label: 'Media', icon: <ImageFileIcon /> },
  { type: NodeType.AskAnything, label: 'Ask Question', icon: <MessageIcon /> },
  { type: NodeType.CheckCondition, label: 'Condition', icon: <ConditionIcon /> },
  { type: NodeType.ListMessage, label: 'List', icon: <ListIcon /> },
  { type: NodeType.QuickReplyMessage, label: 'Quick Reply', icon: <QuickReplyIcon /> },
  { type: NodeType.CTAMessage, label: 'CTA Button', icon: <CtaIcon /> },
  { type: NodeType.Timing, label: 'Delay', icon: <TimingIcon /> },
  { type: NodeType.WriteAttribute, label: 'Attribute', icon: <BookmarkIcon /> },
  { type: NodeType.Webhook, label: 'Webhook', icon: <WebhookIcon /> },
  { type: NodeType.SetWebhook, label: 'Set Webhook', icon: <SetWebhookIcon /> },
  { type: NodeType.AskLocation, label: 'Location', icon: <AskLocationIcon /> },
  { type: NodeType.Gsheet, label: 'Sheets', icon: <GsheetIcon /> },
  { type: NodeType.Code, label: 'Code', icon: <CodeIcon /> },
];

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <div className="mb-4">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:text-white transition-colors">
                <span className="flex items-center gap-2">{title}</span>
                <ChevronDownIcon className={`w-3 h-3 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
            </button>
            {isOpen && <div className="grid grid-cols-3 gap-2 px-3 animate-fade-in">{children}</div>}
        </div>
    );
}

const NodeItem: React.FC<{ type: NodeType; label: string; icon: React.ReactNode; colorClass?: string; onDragStart: (event: React.DragEvent, nodeType: NodeType) => void; onAddNode: (type: NodeType) => void; }> = ({ type, label, icon, colorClass = "text-brand-400", onDragStart, onAddNode }) => (
    <div onDragStart={(event) => { event.dataTransfer.setData('application/reactflow', type); event.dataTransfer.effectAllowed = 'move'; }} onClick={() => onAddNode(type)} draggable={true} className="flex flex-col items-center justify-center p-2 bg-slate-800/50 hover:bg-slate-700/80 rounded-xl border border-slate-700/50 hover:border-slate-500/80 cursor-grab active:cursor-grabbing transition-all duration-200 group shadow-sm hover:shadow-md h-20">
        <div className={`mb-1.5 ${colorClass} group-hover:scale-110 transition-transform duration-200`}>{icon}</div>
        <span className="text-[10px] font-medium text-slate-300 text-center leading-tight line-clamp-2">{label}</span>
    </div>
);

const NodesPanel: React.FC<NodesPanelProps> = ({ onAddNode, onClose }) => {
  return (
    <aside className="w-72 h-full bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden z-20 shadow-2xl">
      <div className="p-4 border-b border-white/5 flex justify-between items-center shrink-0 bg-slate-900">
          <div><h2 className="text-sm font-bold text-white">Components</h2><p className="text-xs text-slate-500 mt-0.5">Drag & drop to canvas</p></div>
          {onClose && <button onClick={onClose} className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"><CloseIcon className="w-5 h-5" /></button>}
      </div>
      <div className="flex-grow overflow-y-auto custom-scrollbar pt-4 pb-10">
        <CollapsibleSection title="Triggers">{triggers.map(t => <NodeItem key={t.type} {...t} colorClass="text-pink-500" onDragStart={() => {}} onAddNode={onAddNode} />)}</CollapsibleSection>
        <CollapsibleSection title="Logic & Messages">{nodeTypes.map(t => <NodeItem key={t.type} {...t} onDragStart={() => {}} onAddNode={onAddNode} />)}</CollapsibleSection>
      </div>
    </aside>
  );
};

export default NodesPanel;
