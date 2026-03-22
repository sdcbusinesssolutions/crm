
import React, { useState } from 'react';
import { NodeType } from '../types';
import {
  MessageIcon, ImageFileIcon, VideoFileIcon, AudioFileIcon, DocumentFileIcon, WebhookIcon, TimingIcon,
  ListIcon, QuickReplyIcon, CtaIcon, GsheetIcon, CodeIcon, AskLocationIcon, TriggerIcon, OnMessageIcon,
  ChevronDownIcon, ConditionIcon, BookmarkIcon, SetWebhookIcon, CloseIcon, CarouselIcon, FlowIcon, CallApiIcon, TagIcon, UsersIcon, GmailIcon, CalendarIcon, RobotIcon
} from './icons';

interface NodesPanelProps {
  onAddNode: (type: NodeType) => void;
  onClose?: () => void;
}

const triggers = [
  { type: NodeType.OnMessage, label: 'On Message', icon: <OnMessageIcon /> },
  { type: NodeType.NewLead, label: 'New Lead', icon: <UsersIcon /> },
  { type: NodeType.PipelineTrigger, label: 'Added to Pipeline', icon: <BookmarkIcon /> },
  { type: NodeType.TaskReminder, label: 'Task Due', icon: <TimingIcon /> },
  { type: NodeType.SheetTrigger, label: 'New Google Sheet Row', icon: <GsheetIcon /> },
  { type: NodeType.SetWebhook, label: 'Set Webhook', icon: <SetWebhookIcon /> },
];
const messageNodes = [
  { type: NodeType.TextMessage, label: 'Text', icon: <MessageIcon /> },
  { type: NodeType.MediaMessage, label: 'Media', icon: <ImageFileIcon /> },
  { type: NodeType.TemplateMessage, label: 'Template', icon: <MessageIcon /> },
  { type: NodeType.ListMessage, label: 'List', icon: <ListIcon /> },
  { type: NodeType.QuickReplyMessage, label: 'Quick Reply', icon: <QuickReplyIcon /> },
  { type: NodeType.CTAMessage, label: 'CTA Button', icon: <CtaIcon /> },
  { type: NodeType.CarouselMessage, label: 'Carousel', icon: <CarouselIcon /> },
  { type: NodeType.Notify, label: 'Notify', icon: <UsersIcon /> },
];

const captureNodes = [
  { type: NodeType.AskAnything, label: 'Ask Question', icon: <MessageIcon /> },
  { type: NodeType.AskInput, label: 'Ask Input', icon: <MessageIcon /> },
  { type: NodeType.AskLocation, label: 'Location', icon: <AskLocationIcon /> },
];

const logicNodes = [
  { type: NodeType.CheckCondition, label: 'Condition', icon: <ConditionIcon /> },
  { type: NodeType.Timing, label: 'Delay', icon: <TimingIcon /> },
  { type: NodeType.SendFlow, label: 'Send Flow', icon: <FlowIcon /> },
  { type: NodeType.CallApi, label: 'Call API', icon: <CallApiIcon /> },
  { type: NodeType.AIAgent, label: 'AI Agent', icon: <RobotIcon />, isBeta: true },
];

const crmNodes = [
  { type: NodeType.ManageTags, label: 'Manage Tags', icon: <TagIcon /> },
  { type: NodeType.ManageGroups, label: 'Manage Groups', icon: <UsersIcon /> },
  { type: NodeType.WriteAttribute, label: 'Attribute', icon: <BookmarkIcon /> },
  { type: NodeType.ContactPipeline, label: 'Pipeline Stage', icon: <BookmarkIcon /> },
];

const integrationNodes = [
  { type: 'gmail' as NodeType, label: 'Gmail', icon: <GmailIcon /> },
  { type: NodeType.Smtp, label: 'SMTP Email', icon: <GmailIcon /> },
  { type: NodeType.Calendar, label: 'Google Calendar', icon: <CalendarIcon /> },
  { type: NodeType.Gsheet, label: 'Google Sheets', icon: <GsheetIcon /> },
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

const NodeItem: React.FC<{ type: NodeType; label: string; icon: React.ReactNode; colorClass?: string; isBeta?: boolean; onDragStart: (event: React.DragEvent, nodeType: NodeType) => void; onAddNode: (type: NodeType) => void; }> = ({ type, label, icon, colorClass = "text-brand-400", isBeta, onDragStart, onAddNode }) => (
  <div onDragStart={(event) => { event.dataTransfer.setData('application/reactflow', type); event.dataTransfer.effectAllowed = 'move'; }} onClick={() => onAddNode(type)} draggable={true} className="flex flex-col items-center justify-center p-2 bg-slate-800/50 hover:bg-slate-700/80 rounded-xl border border-slate-700/50 hover:border-slate-500/80 cursor-grab active:cursor-grabbing transition-all duration-200 group shadow-sm hover:shadow-md h-20 relative overflow-visible">
    {isBeta && (
      <span className="absolute -top-2 -right-2 bg-amber-400 text-slate-900 text-[8px] font-bold px-1 rounded-sm rotate-12 shadow-sm z-10 border border-slate-900/10 pointer-events-none">
        Beta
      </span>
    )}
    <div className={`mb-1.5 ${colorClass} group-hover:scale-110 transition-transform duration-200`}>{icon}</div>
    <span className="text-[10px] font-medium text-slate-300 text-center leading-tight line-clamp-2">{label}</span>
  </div>
);

const NodesPanel: React.FC<NodesPanelProps> = ({ onAddNode, onClose }) => {
  return (
    <aside className="w-72 h-full bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden z-20 shadow-2xl">
      <div className="p-4 border-b border-white/5 flex justify-between items-center shrink-0 bg-slate-900">
        <div><h2 className="text-sm font-bold text-white">Components</h2><p className="text-xs text-slate-500 mt-0.5">Drag & drop to canvas</p></div>
        {onClose && <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors" title="Close Panel"><CloseIcon className="w-5 h-5" /></button>}
      </div>
      <div className="flex-grow overflow-y-auto custom-scrollbar pt-4 pb-10">
        <CollapsibleSection title="Triggers">{triggers.map(t => <NodeItem key={t.type} {...t} colorClass="text-pink-500" onDragStart={() => { }} onAddNode={onAddNode} />)}</CollapsibleSection>
        <CollapsibleSection title="Messages">{messageNodes.map(t => <NodeItem key={t.type} {...t} onDragStart={() => { }} onAddNode={onAddNode} />)}</CollapsibleSection>
        <CollapsibleSection title="Capture Data">{captureNodes.map(t => <NodeItem key={t.type} {...t} onDragStart={() => { }} onAddNode={onAddNode} />)}</CollapsibleSection>
        <CollapsibleSection title="Logic & Tools">{logicNodes.map(t => <NodeItem key={t.type} {...t} onDragStart={() => { }} onAddNode={onAddNode} />)}</CollapsibleSection>
        <CollapsibleSection title="CRM Actions">{crmNodes.map(t => <NodeItem key={t.type} {...t} onDragStart={() => { }} onAddNode={onAddNode} />)}</CollapsibleSection>
        <CollapsibleSection title="Integrations">{integrationNodes.map(t => <NodeItem key={t.type} {...t} onDragStart={() => { }} onAddNode={onAddNode} />)}</CollapsibleSection>
      </div>
    </aside>
  );
};

export default NodesPanel;

// Force Refresh for AskInput Node Type Match
