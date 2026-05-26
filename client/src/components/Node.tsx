
import React, { useState, KeyboardEvent, ReactNode } from 'react';
import { Node, NodeType, AnyNodeData, OnMessageData, MediaMessageData, SetWebhookData, ListMessageData, CTAMessageData, QuickReplyMessageData, AskAnythingData, AskInputData, CheckConditionData, WriteAttributeData, MediaType, CallApiData, TemplateMessageData, SwitchData, ManageTagsData, ManageGroupsData, NewLeadData, ContactPipelineData, GmailData, AIAgentData, SmtpData, NotifyData } from '../types';
import { MessageIcon, ImageFileIcon, WebhookIcon, TimingIcon, ListIcon, QuickReplyIcon, CtaIcon, GsheetIcon, CodeIcon, AskLocationIcon, TrashIcon, EditIcon, SettingsIcon, ConditionIcon, BookmarkIcon, SetWebhookIcon, TriggerIcon, CopyIcon, FlowIcon, CallApiIcon, TagIcon, UsersIcon, GmailIcon, RobotIcon } from './icons';

interface NodeProps { node: Node; isConnecting: boolean; connectingSourceNodeId: string | null; onNodeDragStart: (e: React.MouseEvent, nodeId: string) => void; onNodeTouchStart: (e: React.TouchEvent, nodeId: string) => void; onUpdateNode: (nodeId: string, data: AnyNodeData) => void; onDeleteNode: (nodeId: string) => void; onDuplicateNode: (nodeId: string) => void; onSourceHandleMouseDown: (e: React.MouseEvent, nodeId: string, handleId: string) => void; onSourceHandleTouchStart: (e: React.TouchEvent, nodeId: string, handleId: string) => void; onNodeSettingsClick: (nodeId: string) => void; onNodeClick: (nodeId: string) => void; onNodeMouseUp: (nodeId: string) => void; canWrite?: boolean; }
interface NodeUIProps<T extends AnyNodeData> { node: Node & { data: T }; onUpdateNode: (nodeId: string, data: T) => void; onDeleteNode: (nodeId: string) => void; onDuplicateNode: (nodeId: string) => void; onSettingsClick: () => void; }
interface InteractiveNodeUIProps<T extends AnyNodeData> extends NodeUIProps<T> { onSourceHandleMouseDown: (e: React.MouseEvent, nodeId: string, handleId: string) => void; onSourceHandleTouchStart: (e: React.TouchEvent, nodeId: string, handleId: string) => void; }

type NodeColor = 'pink' | 'blue' | 'purple' | 'amber' | 'cyan' | 'teal' | 'emerald' | 'violet' | 'rose' | 'orange' | 'slate' | 'indigo';
const getColorStyles = (color: NodeColor) => {
  switch (color) {
    case 'pink': return { border: 'border-pink-600', headerBg: 'bg-pink-600', iconBg: 'bg-pink-700', shadow: 'shadow-pink-500/20' };
    case 'purple': return { border: 'border-purple-600', headerBg: 'bg-purple-600', iconBg: 'bg-purple-700', shadow: 'shadow-purple-500/20' };
    case 'blue': return { border: 'border-blue-600', headerBg: 'bg-blue-600', iconBg: 'bg-blue-700', shadow: 'shadow-blue-500/20' };
    case 'orange': return { border: 'border-orange-600', headerBg: 'bg-orange-600', iconBg: 'bg-orange-700', shadow: 'shadow-orange-500/20' };
    case 'cyan': return { border: 'border-cyan-600', headerBg: 'bg-cyan-600', iconBg: 'bg-cyan-700', shadow: 'shadow-cyan-500/20' };
    case 'teal': return { border: 'border-teal-600', headerBg: 'bg-teal-600', iconBg: 'bg-teal-700', shadow: 'shadow-teal-500/20' };
    case 'emerald': return { border: 'border-emerald-600', headerBg: 'bg-emerald-600', iconBg: 'bg-emerald-700', shadow: 'shadow-emerald-500/20' };
    case 'violet': return { border: 'border-violet-600', headerBg: 'bg-violet-600', iconBg: 'bg-violet-700', shadow: 'shadow-violet-500/20' };
    case 'rose': return { border: 'border-rose-600', headerBg: 'bg-rose-600', iconBg: 'bg-rose-700', shadow: 'shadow-rose-500/20' };
    case 'amber': return { border: 'border-amber-500', headerBg: 'bg-amber-500', iconBg: 'bg-amber-600', shadow: 'shadow-amber-500/20' };
    case 'indigo': return { border: 'border-indigo-600', headerBg: 'bg-indigo-600', iconBg: 'bg-indigo-700', shadow: 'shadow-indigo-500/20' };
    default: return { border: 'border-slate-600', headerBg: 'bg-slate-600', iconBg: 'bg-slate-700', shadow: 'shadow-slate-500/20' };
  }
};

const NodeContainer: React.FC<{ children: ReactNode, className?: string, selected?: boolean, color: NodeColor }> = ({ children, className, selected, color }) => {
  const styles = getColorStyles(color);
  return <div className={`relative bg-slate-900 text-slate-200 w-[250px] rounded-xl shadow-lg transition-all duration-300 border-l-[3px] border-y border-r border-y-slate-800 border-r-slate-800 ${styles.border} ${styles.shadow} ${selected ? 'ring-2 ring-white/20 scale-[1.01] shadow-2xl' : 'hover:shadow-xl hover:translate-y-[-2px]'} ${className} touch-none overflow-hidden flex flex-col`}>{children}</div>;
};

const NodeHeader: React.FC<{ title: string; onTitleSave: (newTitle: string) => void; onDelete: () => void; onDuplicate: () => void; onSettingsClick: () => void; icon?: React.ReactNode; color: NodeColor; }> = ({ title, onTitleSave, onDelete, onDuplicate, onSettingsClick, icon, color }) => {
  const [isEditing, setIsEditing] = useState(false); const [currentTitle, setCurrentTitle] = useState(title); const styles = getColorStyles(color);
  const handleSave = () => { if (currentTitle.trim()) onTitleSave(currentTitle.trim()); else setCurrentTitle(title); setIsEditing(false); };
  return (
    <div className={`flex justify-between items-center px-3 py-1.5 ${styles.headerBg} select-none`}>
      {isEditing ? (
        <input type="text" value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} onBlur={handleSave} onKeyDown={(e) => e.key === 'Enter' && handleSave()} autoFocus className="font-semibold text-sm bg-white/20 border border-white/30 rounded px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-white/40 w-full shadow-inner" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} />
      ) : (
        <div className="flex items-center space-x-3 overflow-hidden"><div className={`p-1.5 rounded-lg bg-black/20 text-white shadow-sm`}>{icon}</div><h3 className="font-bold text-sm text-white truncate drop-shadow-sm tracking-wide">{title}</h3></div>
      )}
      <div className="flex items-center space-x-1 pl-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button onMouseDown={e => e.stopPropagation()} onClick={(e) => { onSettingsClick(); e.stopPropagation(); }} className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-md transition-all" title="Settings"><SettingsIcon className="w-4 h-4" /></button>
        <button onMouseDown={e => e.stopPropagation()} onClick={(e) => { setIsEditing(true); e.stopPropagation(); }} className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-md transition-all" title="Rename"><EditIcon className="w-4 h-4" /></button>
        <button onMouseDown={e => e.stopPropagation()} onClick={(e) => { onDuplicate(); e.stopPropagation(); }} className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-md transition-all" title="Duplicate"><CopyIcon className="w-4 h-4" /></button>
        <button onMouseDown={e => e.stopPropagation()} onClick={(e) => { onDelete(); e.stopPropagation(); }} className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-md transition-all" title="Delete"><TrashIcon className="w-4 h-4" /></button>
      </div>
      <div className="flex md:hidden items-center space-x-1 pl-2"><button onMouseDown={e => e.stopPropagation()} onClick={(e) => { onSettingsClick(); e.stopPropagation(); }} className="p-1.5 text-white/80"><SettingsIcon className="w-4 h-4" /></button></div>
    </div>
  );
};

const FieldWrapper: React.FC<{ label: string, children: ReactNode }> = ({ label, children }) => (<div className="mb-2 last:mb-0"><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{label}</label>{children}</div>);
const TextInput: React.FC<{ value: string, onChange: (val: string) => void, placeholder?: string }> = ({ value, onChange, placeholder }) => (<input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} />);
const TextareaInput: React.FC<{ value: string, onChange: (val: string) => void, placeholder?: string, rows?: number }> = ({ value, onChange, placeholder, rows = 3 }) => (<textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none resize-none leading-relaxed" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} />);
const SelectInput: React.FC<{ value: string, onChange: (val: string) => void, options: string[] }> = ({ value, onChange, options }) => (<div className="relative"><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none appearance-none cursor-pointer" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>{options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select><div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div></div>);

const OnMessageNodeUI: React.FC<NodeUIProps<OnMessageData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick }) => {
  const [keywordInput, setKeywordInput] = useState(''); const data = node.data;
  const handleDataChange = (key: keyof OnMessageData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  const removeKeyword = (idx: number) => handleDataChange('keywords', data.keywords.filter((_, i) => i !== idx));
  const addKeywords = (newKws: string[]) => { const unique = newKws.map(k => k.trim()).filter(k => k && !data.keywords.includes(k)); if (unique.length > 0) handleDataChange('keywords', [...data.keywords, ...unique]); };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === ',' || e.key === 'Enter') { e.preventDefault(); addKeywords(keywordInput.split(',')); setKeywordInput(''); } };
  return (
    <NodeContainer color="pink" className="group">
      <NodeHeader color="pink" icon={<TriggerIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-2.5 space-y-2 bg-slate-900/95 flex-1">
        <FieldWrapper label="Message Type"><SelectInput value={data.messageType} onChange={val => handleDataChange('messageType', val)} options={['Text', 'Image', 'Audio', 'Video', 'Document']} /></FieldWrapper>
        <FieldWrapper label="Keywords"><div onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} className="w-full p-2 border border-slate-800 bg-slate-950 rounded-lg flex flex-wrap items-center gap-2 min-h-[42px]">{data.keywords.map((k, i) => (<div key={i} className="bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">{k}<button onClick={() => removeKeyword(i)} className="hover:text-white">×</button></div>))}<input type="text" value={keywordInput} onChange={e => setKeywordInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Add..." className="flex-grow bg-transparent focus:outline-none text-slate-400 text-sm min-w-[60px]" /></div></FieldWrapper>
      </div>
    </NodeContainer>
  );
}

const MediaMessageNodeUI: React.FC<NodeUIProps<MediaMessageData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick }) => {
  const { data } = node; const handleDataChange = (key: keyof MediaMessageData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="purple" className="group">
      <NodeHeader color="purple" icon={<ImageFileIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-2.5 space-y-2 bg-slate-900/95 flex-1"><FieldWrapper label="Media Type"><SelectInput value={data.mediaType} onChange={val => handleDataChange('mediaType', val as MediaType)} options={Object.values(MediaType)} /></FieldWrapper><FieldWrapper label="URL"><TextInput value={data.url} onChange={val => handleDataChange('url', val)} placeholder="https://..." /></FieldWrapper></div>
    </NodeContainer>
  );
}

const GenericNodeUI: React.FC<NodeUIProps<AnyNodeData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick }) => {
  const { data, type } = node; const handleDataChange = (key: string, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  let icon = <SettingsIcon />; let color: NodeColor = 'slate';
  if (type === NodeType.TextMessage) { icon = <MessageIcon />; color = 'blue'; } else if (type === NodeType.Webhook) { icon = <WebhookIcon />; color = 'amber'; } else if (type === NodeType.Timing) { icon = <TimingIcon />; color = 'slate'; } else if (type === NodeType.AskLocation) { icon = <AskLocationIcon />; color = 'teal'; } else if (type === NodeType.Code) { icon = <CodeIcon />; color = 'indigo'; } else if (type === NodeType.Gsheet || type === NodeType.SheetTrigger) { icon = <GsheetIcon />; color = 'emerald'; } else if (type === NodeType.SendFlow) { icon = <FlowIcon />; color = 'rose'; } else if (type === NodeType.AIAgent) { icon = <RobotIcon />; color = 'violet'; }
  const renderFields = () => {
    switch (type) { case NodeType.TextMessage: return <FieldWrapper label="Message Text"><TextareaInput value={data.message} onChange={val => handleDataChange('message', val)} placeholder="Hello!" /></FieldWrapper>; case NodeType.Webhook: return <FieldWrapper label="Event Type"><TextInput value={data.eventType} onChange={val => handleDataChange('eventType', val)} placeholder="e.g. user_signup" /></FieldWrapper>; case NodeType.Timing: return <div className="text-center text-xs text-slate-400 py-3 bg-slate-950 rounded-lg border border-slate-800">Waits for <span className="font-bold text-white">{data.delayValue ?? 1} {data.delayUnit || 'Minutes'}</span></div>; case NodeType.AskLocation: return <FieldWrapper label="Prompt Text"><TextInput value={data.text} onChange={val => handleDataChange('text', val)} placeholder="Share location..." /></FieldWrapper>; default: return <p className="text-slate-500 text-xs italic p-2 text-center">Configure via Settings</p>; }
  }
  return (
    <NodeContainer color={color} className="group">
      <NodeHeader color={color} icon={icon} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-2.5 space-y-2 bg-slate-900/95 flex-1">{renderFields()}</div>
    </NodeContainer>
  );
}

const SetWebhookNodeUI: React.FC<NodeUIProps<SetWebhookData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick }) => {
  const { data } = node; const handleDataChange = (key: keyof SetWebhookData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  // Construct a display URL or placeholder
  const displayUrl = data.webhookId ? `.../api/webhooks/.../${data.webhookId}/webhook` : 'Generate URL in Settings';

  return (
    <NodeContainer color="cyan" className="group">
      <NodeHeader color="cyan" title={data.label || 'Incoming Webhook'} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} icon={<SetWebhookIcon />} />
      <div className="p-2.5 space-y-2 bg-slate-900/95 flex-1">
        <div className="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
          <span className="font-mono font-bold text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">POST</span>
          <p className="text-slate-400 truncate text-xs font-mono flex-1 opacity-90" title="Incoming Webhook URL">
            {displayUrl}
          </p>
        </div>
        <div className="text-[10px] text-slate-500 text-center italic">
          Receives external requests
        </div>
      </div>
    </NodeContainer>
  );
};

const WriteAttributeNodeUI: React.FC<NodeUIProps<WriteAttributeData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick }) => {
  const { data } = node; const handleDataChange = (key: keyof WriteAttributeData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="teal" className="group">
      <NodeHeader color="teal" title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} icon={<BookmarkIcon />} />
      <div className="p-2.5 bg-slate-900/95 flex-1"><div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-2.5 text-center"><p className="text-xs text-teal-300 font-medium">Updates Contact Attributes</p></div></div>
    </NodeContainer>
  );
};

const AskAnythingNodeUI: React.FC<InteractiveNodeUIProps<AskAnythingData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node; const handleDataChange = (key: keyof AskAnythingData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="orange" className="group">
      <NodeHeader color="orange" icon={<MessageIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-2.5 bg-slate-900/95 flex-1">
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 mb-2"><p className="text-slate-300 whitespace-pre-wrap text-sm italic opacity-90 leading-relaxed">"{data.text || 'Ask a question...'}"</p></div>
        <div className="space-y-2">
          {data.ifUnresponsive && (<div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">On Timeout</span><div id={`h-${node.id}-unresponsive`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'unresponsive')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'unresponsive')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-slate-600 rounded-full cursor-pointer hover:bg-orange-400 hover:scale-125 transition-all touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" /></div>)}
          <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">On Answer</span><div id={`h-${node.id}-default`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'default')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'default')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-emerald-500 rounded-full cursor-pointer hover:scale-125 transition-all shadow-[0_0_8px_rgba(16,185,129,0.6)] touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" /></div>
        </div>
      </div>
    </NodeContainer>
  );
};

const ListMessageNodeUI: React.FC<InteractiveNodeUIProps<ListMessageData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node; const handleDataChange = (key: keyof ListMessageData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="violet" className="group">
      <NodeHeader color="violet" icon={<ListIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-2.5 space-y-2 bg-slate-900/95 flex-1">
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Body</p><p className="text-slate-300 text-xs leading-relaxed line-clamp-3">{data.body || "..."}</p></div>
        <div className="w-full py-2 bg-violet-500/10 rounded-lg border border-dashed border-violet-500/30 text-center text-xs text-violet-300 font-bold">{data.buttonText || "Menu Button"}</div>
        <div className="space-y-2 pt-1">{data.sections?.map((section) => (<div key={section.id} className="space-y-2"><p className="text-[10px] font-bold text-slate-500 uppercase pl-1">{section.title}</p>{section.items.map((item) => (<div key={item.id} className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-violet-500/40 transition-colors group/item"><span className="text-xs font-medium text-slate-300">{item.title}</span><div id={`h-${node.id}-${item.id}`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, item.id)} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, item.id)} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-violet-400 rounded-full cursor-pointer hover:scale-125 transition-transform shadow-sm absolute -right-1.5 top-1/2 -translate-y-1/2 border-2 border-slate-900 touch-none" /></div>))}</div>))}</div>
        {data.ifUnresponsive && (<div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle mt-2"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">On Timeout</span><div id={`h-${node.id}-unresponsive`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'unresponsive')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'unresponsive')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-slate-600 rounded-full cursor-pointer hover:bg-violet-400 hover:scale-125 transition-all touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" /></div>)}
      </div>
    </NodeContainer>
  );
};

const CheckConditionNodeUI: React.FC<InteractiveNodeUIProps<CheckConditionData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node; const handleDataChange = (key: keyof CheckConditionData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="rose" className="group">
      <NodeHeader color="rose" icon={<ConditionIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-2.5 space-y-2 bg-slate-900/95 flex-1">
        {data.conditions.map((condition, index) => (<div key={condition.id} className="relative flex items-center justify-between bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg"><span className="text-xs font-bold text-rose-200 truncate pr-4">{condition.name || `Condition ${index + 1}`}</span><div id={`h-${node.id}-${condition.id}`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, condition.id)} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, condition.id)} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-rose-500 rounded-full cursor-pointer hover:scale-125 transition-transform absolute -right-1.5 top-1/2 -translate-y-1/2 border-2 border-slate-900 touch-none shadow-[0_0_5px_rgba(244,63,94,0.5)]" /></div>))}
        <div className="relative flex items-center justify-between bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-lg mt-3"><span className="text-xs font-bold text-slate-500">False / Fallback</span><div id={`h-${node.id}-default`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'default')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'default')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-slate-500 rounded-full cursor-pointer hover:scale-125 transition-transform absolute -right-1.5 top-1/2 -translate-y-1/2 border-2 border-slate-900 touch-none" /></div>
      </div>
    </NodeContainer>
  );
};

const CTAMessageNodeUI: React.FC<NodeUIProps<CTAMessageData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick }) => {
  const { data } = node; const handleDataChange = (key: keyof CTAMessageData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="cyan" className="group">
      <NodeHeader color="cyan" icon={<CtaIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-2.5 space-y-2 bg-slate-900/95 flex-1">
        {data.headerType !== 'None' && (<div className="bg-slate-950 h-10 rounded-lg flex items-center justify-center border border-slate-800 text-slate-500"><span className="text-[10px] font-bold uppercase">{data.headerType} Header</span></div>)}
        <p className="text-sm text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 leading-relaxed">{data.body || "Message Body"}</p>
        <div className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-center py-2.5 rounded-lg font-bold text-sm cursor-pointer hover:bg-cyan-500/20 transition-colors">{data.displayText || 'Call To Action'}</div>
      </div>
    </NodeContainer>
  );
};

const QuickReplyMessageNodeUI: React.FC<InteractiveNodeUIProps<QuickReplyMessageData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node; const handleDataChange = (key: keyof QuickReplyMessageData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="emerald" className="group">
      <NodeHeader color="emerald" icon={<QuickReplyIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-2.5 space-y-2 bg-slate-900/95 flex-1">
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800"><p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{data.body || "Quick reply question..."}</p></div>
        <div className="space-y-2">{data.buttons.map((button) => (<div key={button.id} className="relative flex items-center justify-center px-3 py-1.5 bg-emerald-500/10 text-emerald-400 font-semibold rounded-lg border border-emerald-500/20 text-xs hover:bg-emerald-500/20 transition-colors">{button.title}<div id={`h-${node.id}-${button.id}`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, button.id)} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, button.id)} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-emerald-500 rounded-full cursor-pointer hover:scale-125 transition-transform absolute -right-1.5 top-1/2 -translate-y-1/2 border-2 border-slate-900 shadow-sm touch-none" /></div>))}</div>
        {data.ifUnresponsive && (<div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle mt-2"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">On Timeout</span><div id={`h-${node.id}-unresponsive`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'unresponsive')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'unresponsive')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-slate-600 rounded-full cursor-pointer hover:bg-emerald-400 hover:scale-125 transition-all touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" /></div>)}
      </div>
    </NodeContainer>
  );
}

const SendFlowNodeUI: React.FC<InteractiveNodeUIProps<AnyNodeData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node; const handleDataChange = (key: string, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="rose" className="group">
      <NodeHeader color="rose" icon={<FlowIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-2.5 bg-slate-900/95 flex-1">
        {data.flowName ? (
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
            <p className="text-xs font-bold text-slate-300">{data.flowName}</p>
            <p className="text-[10px] text-slate-500">Flow ID: {data.flowId}</p>
          </div>
        ) : (
          <p className="text-slate-500 text-xs italic p-2 text-center">Select a flow in settings</p>
        )}
        <div className="space-y-2 mt-3">
          {data.ifUnresponsive && (<div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">On Timeout</span><div id={`h-${node.id}-unresponsive`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'unresponsive')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'unresponsive')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-slate-600 rounded-full cursor-pointer hover:bg-rose-400 hover:scale-125 transition-all touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" /></div>)}
          <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">On Complete</span><div id={`h-${node.id}-default`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'default')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'default')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-rose-500 rounded-full cursor-pointer hover:scale-125 transition-all shadow-[0_0_8px_rgba(244,63,94,0.6)] touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" /></div>
        </div>
      </div>
    </NodeContainer>
  );
};

const SwitchNodeUI: React.FC<InteractiveNodeUIProps<SwitchData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node; const handleDataChange = (key: keyof SwitchData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="orange" className="group">
      <NodeHeader color="orange" icon={<ConditionIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-2.5 space-y-2 bg-slate-900/95 flex-1">
        {data.cases.map((conditionCase, index) => (
          <div key={conditionCase.id} className="relative flex items-center justify-between bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-lg">
            <span className="text-xs font-bold text-orange-200 truncate pr-4">{conditionCase.label || `Case ${index + 1}`}</span>
            <div
              id={`h-${node.id}-${conditionCase.id}`}
              onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, conditionCase.id)}
              onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, conditionCase.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-3 h-3 bg-orange-500 rounded-full cursor-pointer hover:scale-125 transition-transform absolute -right-1.5 top-1/2 -translate-y-1/2 border-2 border-slate-900 touch-none shadow-[0_0_5px_rgba(249,115,22,0.5)]"
            />
          </div>
        ))}
        <div className="relative flex items-center justify-between bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-lg mt-3">
          <span className="text-xs font-bold text-slate-500">Default</span>
          <div
            id={`h-${node.id}-default`}
            onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'default')}
            onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'default')}
            onClick={(e) => e.stopPropagation()}
            className="w-3 h-3 bg-slate-500 rounded-full cursor-pointer hover:scale-125 transition-transform absolute -right-1.5 top-1/2 -translate-y-1/2 border-2 border-slate-900 touch-none"
          />
        </div>
      </div>
    </NodeContainer>
  );

};

const AskInputNodeUI: React.FC<InteractiveNodeUIProps<AskInputData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node; const handleDataChange = (key: keyof AskInputData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="orange" className="group">
      <NodeHeader color="orange" icon={<MessageIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-2.5 bg-slate-900/95 flex-1">
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 mb-2">
          <p className="text-slate-300 whitespace-pre-wrap text-sm italic opacity-90 leading-relaxed">"{data.text || 'Ask input...'}"</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-[10px] bg-orange-500/20 text-orange-200 border border-orange-500/30 px-2 py-0.5 rounded uppercase font-bold">{data.inputType || 'Text'}</span>
          {data.inputType === 'Text' && <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded">{data.textInputType || 'Text'}</span>}
          {data.inputType === 'Media' && data.mediaInputTypes?.map((m: string) => <span key={m} className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded">{m}</span>)}
        </div>
        <div className="space-y-2">
          {data.ifUnresponsive && (<div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">On Timeout</span><div id={`h-${node.id}-unresponsive`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'unresponsive')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'unresponsive')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-slate-600 rounded-full cursor-pointer hover:bg-orange-400 hover:scale-125 transition-all touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" /></div>)}
          <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">On Invalid Input</span><div id={`h-${node.id}-invalid`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'invalid')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'invalid')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-red-500 rounded-full cursor-pointer hover:scale-125 transition-all shadow-[0_0_8px_rgba(239,68,68,0.6)] touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" /></div>
          <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">On Valid Input</span><div id={`h-${node.id}-default`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'default')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'default')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-emerald-500 rounded-full cursor-pointer hover:scale-125 transition-all shadow-[0_0_8px_rgba(16,185,129,0.6)] touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" /></div>
        </div>
      </div>
    </NodeContainer>
  );
};


const CUSTOM_HANDLE_NODES = [NodeType.ListMessage, NodeType.QuickReplyMessage, NodeType.AskAnything, NodeType.AskInput, NodeType.CheckCondition, NodeType.SendFlow, NodeType.Switch, NodeType.NewLead, NodeType.TemplateMessage, NodeType.Gmail, NodeType.Smtp, NodeType.Notify];
const CallApiNodeUI: React.FC<NodeUIProps<CallApiData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick }) => {
  const { data } = node;
  const handleDataChange = (key: keyof CallApiData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="cyan" className="group">
      <NodeHeader color="cyan" title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} icon={<CallApiIcon />} />
      <div className="p-2.5 bg-slate-900/95 flex-1 space-y-2">
        <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded border border-slate-800">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${data.method === 'GET' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : data.method === 'POST' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>{data.method || 'GET'}</span>
          <p className="text-xs text-slate-400 truncate flex-1 font-mono">{data.url || 'https://api.example.com'}</p>
        </div>
      </div>
    </NodeContainer>
  );
};

const TemplateMessageNodeUI: React.FC<InteractiveNodeUIProps<TemplateMessageData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node;
  const handleDataChange = (key: keyof TemplateMessageData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="indigo" className="group">
      <NodeHeader color="indigo" title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} icon={<MessageIcon />} />
      <div className="p-2.5 bg-slate-900/95 flex-1 space-y-2">
        {data.templateName ? (
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
            <p className="text-xs font-bold text-slate-300">{data.templateName}</p>
            <p className="text-[10px] text-slate-500 font-mono">{data.language}</p>
          </div>
        ) : (
          <div className="text-slate-500 text-xs italic text-center py-2">Select a template...</div>
        )}

        <div className="space-y-2 pt-1">
          {data.ifUnresponsive && (
            <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">On Timeout</span>
              <div id={`h-${node.id}-unresponsive`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'unresponsive')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'unresponsive')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-slate-600 rounded-full cursor-pointer hover:bg-orange-400 hover:scale-125 transition-all touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" />
            </div>
          )}

          <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">Next Step</span>
            <div id={`h-${node.id}-default`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'default')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'default')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-indigo-500 rounded-full cursor-pointer hover:bg-white hover:scale-125 transition-all touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" />
          </div>
        </div>
      </div>
    </NodeContainer>
  );
};

const ManageTagsNodeUI: React.FC<NodeUIProps<ManageTagsData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick }) => {
  const { data } = node;
  const handleDataChange = (key: keyof ManageTagsData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="teal" className="group">
      <NodeHeader color="teal" title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} icon={<TagIcon className="w-4 h-4" />} />
      <div className="p-2.5 bg-slate-900/95 flex-1 space-y-2">
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
          <p className="text-xs font-bold text-teal-300 uppercase">{data.action === 'remove' ? 'Remove Tags' : 'Add Tags'}</p>
          <div className="flex flex-wrap gap-1">
            {data.tags && data.tags.length > 0 ? (
              data.tags.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-teal-500/20 text-teal-200 border border-teal-500/30">{tag}</span>
              ))
            ) : (
              <span className="text-[10px] text-slate-500 italic">No tags selected</span>
            )}
          </div>
        </div>
      </div>
    </NodeContainer>
  );
};

const ManageGroupsNodeUI: React.FC<NodeUIProps<ManageGroupsData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick }) => {
  const { data } = node;
  const handleDataChange = (key: keyof ManageGroupsData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="blue" className="group">
      <NodeHeader color="blue" title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} icon={<UsersIcon className="w-4 h-4" />} />
      <div className="p-2.5 bg-slate-900/95 flex-1 space-y-2">
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
          <p className="text-xs font-bold text-blue-300 uppercase">{data.action === 'remove' ? 'Remove from Groups' : 'Add to Groups'}</p>
          <div className="flex flex-wrap gap-1">
            {data.groups && data.groups.length > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-200 border border-blue-500/30">{data.groups.length} groups selected</span>
            ) : (
              <span className="text-[10px] text-slate-500 italic">No groups selected</span>
            )}
          </div>
        </div>
      </div>
    </NodeContainer>
  );
};

const NewLeadNodeUI: React.FC<InteractiveNodeUIProps<NewLeadData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node;
  const handleDataChange = (key: keyof NewLeadData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="teal" className="group">
      <NodeHeader color="teal" title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} icon={<UsersIcon className="w-4 h-4" />} />
      <div className="p-2.5 bg-slate-900/95 flex-1 space-y-2">
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 italic">Checks if phone number exists in DB.</p>
        </div>
        <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle">
          <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wide">New Lead</span>
          <div id={`h-${node.id}-new`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'new')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'new')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-emerald-500 rounded-full cursor-pointer hover:scale-125 transition-all touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
        </div>
        <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle">
          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">Existing Contact</span>
          <div id={`h-${node.id}-existing`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'existing')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'existing')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-slate-500 rounded-full cursor-pointer hover:scale-125 transition-all touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" />
        </div>
      </div>
    </NodeContainer>
  );
};

const SelectKVInput: React.FC<{ value: string, onChange: (val: string) => void, options: { label: string, value: string }[] }> = ({ value, onChange, options }) => (
  <div className="relative">
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none appearance-none cursor-pointer" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
      <option value="" disabled>Select...</option>
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div>
  </div>
);

import { pipelineService } from '../services/pipelineService';

const DynamicField: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string, value: string }[];
  placeholder?: string;
  loading?: boolean;
}> = ({ label, value, onChange, options, placeholder, loading }) => {
  const [mode, setMode] = useState<'select' | 'text'>('select');

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-[10px] uppercase font-bold text-slate-400">{label}</label>
        <button
          onClick={() => setMode(mode === 'select' ? 'text' : 'select')}
          className="text-[10px] text-brand-400 hover:text-brand-300 underline decoration-dotted"
        >
          {mode === 'select' ? 'Use Variable' : 'Select List'}
        </button>
      </div>

      {mode === 'select' ? (
        loading ? <div className="text-xs text-slate-500 animate-pulse">Loading...</div> :
          <SelectKVInput value={value} onChange={onChange} options={options} />
      ) : (
        <TextInput value={value} onChange={onChange} placeholder={placeholder || "{{variable}}"} />
      )}
    </div>
  );
};

const ContactPipelineNodeUI: React.FC<NodeUIProps<ContactPipelineData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick }) => {
  const { data } = node;
  const [pipelineName, setPipelineName] = useState<string>(data.pipelineId);
  const [stageName, setStageName] = useState<string>(data.stageId);

  React.useEffect(() => {
    let mounted = true;
    const resolveNames = async () => {
      if (!data.pipelineId || data.pipelineId.includes('{{')) {
        if (mounted) {
          setPipelineName(data.pipelineId || '');
          setStageName(data.stageId || '');
        }
        return;
      }
      try {
        const pipelines = await pipelineService.getPipelines();
        const p = pipelines.find(p => p.id === data.pipelineId);
        if (!mounted) return;
        setPipelineName(p ? p.name : data.pipelineId);

        if (data.stageId && !data.stageId.includes('{{')) {
          const stages = await pipelineService.getPipelineStages(data.pipelineId);
          const s = stages.find(s => s.id === data.stageId);
          if (mounted) setStageName(s ? s.name : data.stageId);
        } else {
          if (mounted) setStageName(data.stageId || '');
        }
      } catch (e) { }
    };
    resolveNames();
    return () => { mounted = false; };
  }, [data.pipelineId, data.stageId]);

  return (
    <NodeContainer color="blue" className="group">
      <NodeHeader color="blue" title={data.label} onTitleSave={(t) => onUpdateNode(node.id, { ...data, label: t })} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} icon={<BookmarkIcon className="w-4 h-4" />} />
      <div className="p-2.5 bg-slate-900/95 flex-1 space-y-2 cursor-pointer">
        <div className="space-y-1">
          <span className="font-bold text-slate-500 uppercase block text-[10px]">Pipeline</span>
          <div className="text-xs text-slate-300 truncate font-medium">{pipelineName || <span className="text-slate-500 italic">Not Selected</span>}</div>
        </div>
        <div className="space-y-1">
          <span className="font-bold text-slate-500 uppercase block text-[10px]">Stage</span>
          <div className="text-xs text-slate-300 truncate font-medium">{stageName || <span className="text-slate-500 italic">Not Selected</span>}</div>
        </div>

        {(data.outputVariableName) && (
          <div className="pt-2 border-t border-slate-800">
            <span className="font-bold text-slate-500 uppercase block text-[10px]">Output Variable</span>
            <code className="text-[10px] text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">{data.outputVariableName}</code>
          </div>
        )}

        <div className="pt-2">
          <button className="w-full py-2 text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium">
            <SettingsIcon className="w-3 h-3" />
            Configure Settings
          </button>
        </div>
      </div>
    </NodeContainer>
  );
};

const GmailNodeUI: React.FC<InteractiveNodeUIProps<GmailData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node;
  const handleDataChange = (key: keyof GmailData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });

  return (
    <NodeContainer color="rose" className="group">
      <NodeHeader color="rose" title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} icon={<GmailIcon className="w-4 h-4" />} />
      <div className="p-2.5 bg-slate-900/95 flex-1 space-y-2">
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2 cursor-pointer hover:border-slate-600 transition-colors">
          <div className="space-y-1">
            <span className="font-bold text-slate-500 uppercase block text-[10px]">To</span>
            <div className="text-xs text-slate-300 truncate font-mono">{data.to || <span className="text-slate-600 italic">Configure recipient</span>}</div>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-slate-500 uppercase block text-[10px]">Subject</span>
            <div className="text-xs text-slate-300 truncate font-medium">{data.subject || <span className="text-slate-600 italic">No subject</span>}</div>
          </div>
          {!data.connectionId && (
            <div className="pt-2 border-t border-slate-800 text-xs text-rose-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              Connection Required
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle">
            <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-wide">On Sent</span>
            <div id={`h-${node.id}-true`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'true')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'true')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-emerald-500 rounded-full cursor-pointer hover:scale-125 transition-all shadow-[0_0_8px_rgba(16,185,129,0.6)] touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" />
          </div>

          <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle">
            <span className="text-rose-500 text-[10px] font-bold uppercase tracking-wide">On Failure</span>
            <div id={`h-${node.id}-false`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'false')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'false')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-rose-500 rounded-full cursor-pointer hover:scale-125 transition-all shadow-[0_0_8px_rgba(244,63,94,0.6)] touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" />
          </div>
        </div>
      </div>
    </NodeContainer>
  );
};

const SmtpNodeUI: React.FC<InteractiveNodeUIProps<SmtpData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node;
  const handleDataChange = (key: keyof SmtpData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });

  return (
    <NodeContainer color="slate" className="group">
      <NodeHeader color="slate" title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} icon={<MessageIcon className="w-4 h-4" />} />
      <div className="p-2.5 bg-slate-900/95 flex-1 space-y-2">
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2 cursor-pointer hover:border-slate-600 transition-colors">
          <div className="space-y-1">
            <span className="font-bold text-slate-500 uppercase block text-[10px]">To</span>
            <div className="text-xs text-slate-300 truncate font-mono">{data.to || <span className="text-slate-600 italic">Configure recipient</span>}</div>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-slate-500 uppercase block text-[10px]">Subject</span>
            <div className="text-xs text-slate-300 truncate font-medium">{data.subject || <span className="text-slate-600 italic">No subject</span>}</div>
          </div>
          {!data.connectionId && (
            <div className="pt-2 border-t border-slate-800 text-xs text-rose-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              Connection Required
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle">
            <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-wide">On Sent</span>
            <div id={`h-${node.id}-true`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'true')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'true')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-emerald-500 rounded-full cursor-pointer hover:scale-125 transition-all shadow-[0_0_8px_rgba(16,185,129,0.6)] touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" />
          </div>

          <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle">
            <span className="text-rose-500 text-[10px] font-bold uppercase tracking-wide">On Failure</span>
            <div id={`h-${node.id}-false`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'false')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'false')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-rose-500 rounded-full cursor-pointer hover:scale-125 transition-all shadow-[0_0_8px_rgba(244,63,94,0.6)] touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" />
          </div>
        </div>
      </div>
    </NodeContainer>
  );
};

const NotifyNodeUI: React.FC<InteractiveNodeUIProps<NotifyData>> = ({ node, onUpdateNode, onDeleteNode, onDuplicateNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node;
  const handleDataChange = (key: keyof NotifyData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });

  return (
    <NodeContainer color="amber" className="group">
      <NodeHeader color="amber" title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onDuplicate={() => onDuplicateNode(node.id)} onSettingsClick={onSettingsClick} icon={<UsersIcon className="w-4 h-4" />} />
      <div className="p-2.5 bg-slate-900/95 flex-1 space-y-2">
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2 cursor-pointer hover:border-slate-600 transition-colors">
          <div className="space-y-1">
            <span className="font-bold text-slate-500 uppercase block text-[10px]">Notify Numbers</span>
            <div className="text-xs text-slate-300 truncate font-mono">{data.mobileNumbers || <span className="text-slate-600 italic">No numbers</span>}</div>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-slate-500 uppercase block text-[10px]">Type</span>
            <div className="text-xs text-slate-300 font-medium">{data.notificationType || 'Text'}</div>
          </div>
          {data.notificationType === 'Template' && data.templateName && (
            <div className="space-y-1 pt-1 border-t border-slate-800">
              <span className="font-bold text-slate-500 uppercase block text-[10px]">Template</span>
              <div className="text-xs text-slate-300 truncate font-medium">{data.templateName}</div>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle">
            <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-wide">On Sent</span>
            <div id={`h-${node.id}-true`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'true')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'true')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-emerald-500 rounded-full cursor-pointer hover:scale-125 transition-all shadow-[0_0_8px_rgba(16,185,129,0.6)] touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" />
          </div>

          <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-800 group/handle">
            <span className="text-rose-500 text-[10px] font-bold uppercase tracking-wide">On Failure</span>
            <div id={`h-${node.id}-false`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'false')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'false')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-rose-500 rounded-full cursor-pointer hover:scale-125 transition-all shadow-[0_0_8px_rgba(244,63,94,0.6)] touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" />
          </div>
        </div>
      </div>
    </NodeContainer>
  );
};

const NodeComponent: React.FC<NodeProps> = ({ node, isConnecting, connectingSourceNodeId, onNodeDragStart, onNodeTouchStart, onUpdateNode, onDeleteNode, onDuplicateNode, onSourceHandleMouseDown, onSourceHandleTouchStart, onNodeSettingsClick, onNodeClick, onNodeMouseUp }) => {
  const dragStartPos = React.useRef({ x: 0, y: 0 });
  const nodeStyles = { left: `${node.position.x}px`, top: `${node.position.y}px` };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    onNodeDragStart(e, node.id);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    onNodeTouchStart(e, node.id);
  };

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    const clientX = 'clientX' in e ? e.clientX : (e as any).changedTouches?.[0]?.clientX;
    const clientY = 'clientY' in e ? e.clientY : (e as any).changedTouches?.[0]?.clientY;

    if (clientX !== undefined && clientY !== undefined) {
      const dx = Math.abs(clientX - dragStartPos.current.x);
      const dy = Math.abs(clientY - dragStartPos.current.y);
      // If moved more than 5 pixels, treat as drag and don't open settings
      if (dx > 5 || dy > 5) return;
    }
    
    onNodeClick(node.id);
  };

  const renderNodeUI = () => {
    const props = { node: node as any, onUpdateNode: onUpdateNode as any, onDeleteNode, onDuplicateNode, onSettingsClick: () => onNodeSettingsClick(node.id), onSourceHandleMouseDown, onSourceHandleTouchStart };
    switch (node.type) { case NodeType.OnMessage: return <OnMessageNodeUI {...props} />; case NodeType.MediaMessage: return <MediaMessageNodeUI {...props} />; case NodeType.SetWebhook: return <SetWebhookNodeUI {...props} />; case NodeType.WriteAttribute: return <WriteAttributeNodeUI {...props} />; case NodeType.AskAnything: return <AskAnythingNodeUI {...props} />; case NodeType.AskInput: return <AskInputNodeUI {...props} />; case NodeType.ListMessage: return <ListMessageNodeUI {...props} />; case NodeType.CTAMessage: return <CTAMessageNodeUI {...props} />; case NodeType.QuickReplyMessage: return <QuickReplyMessageNodeUI {...props} />; case NodeType.CheckCondition: return <CheckConditionNodeUI {...props} />; case NodeType.Switch: return <SwitchNodeUI {...props} />; case NodeType.SendFlow: return <SendFlowNodeUI {...props} />; case NodeType.CallApi: return <CallApiNodeUI {...props} />; case NodeType.TemplateMessage: return <TemplateMessageNodeUI {...props} />; case NodeType.ManageTags: return <ManageTagsNodeUI {...props} />; case NodeType.ManageGroups: return <ManageGroupsNodeUI {...props} />; case NodeType.NewLead: return <NewLeadNodeUI {...props} />; case NodeType.ContactPipeline: return <ContactPipelineNodeUI {...props} />; case NodeType.Gmail: return <GmailNodeUI {...props} />; case NodeType.Smtp: return <SmtpNodeUI {...props} />; case NodeType.Notify: return <NotifyNodeUI {...props} />; default: return <GenericNodeUI {...props} />; }
  }
  const isConnectionSource = connectingSourceNodeId === node.id;
  return (
    <div id={node.id} data-node-id={node.id} className={`absolute transition-transform duration-200 ease-out ${isConnectionSource ? 'z-50 scale-105' : ''} ${isConnecting ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'} touch-none select-none`} style={nodeStyles} onMouseDown={handleMouseDown} onTouchStart={handleTouchStart} onClick={handleClick} onMouseUp={(e) => { onNodeMouseUp(node.id); }}>
      {renderNodeUI()}
      {!CUSTOM_HANDLE_NODES.includes(node.type) && (<div id={`h-${node.id}-default`} className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-slate-400 rounded-full border-2 border-slate-900 hover:bg-white hover:border-brand-500 hover:scale-125 transition-all cursor-pointer touch-none shadow-md" onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'default')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'default')} />)}
      {node.type !== NodeType.OnMessage && (<div id={`h-${node.id}-target`} onMouseUp={(e) => { e.stopPropagation(); onNodeMouseUp(node.id); }} className={`absolute -left-1.5 top-[2rem] -translate-y-1/2 w-3 h-3 rounded-full border-2 border-slate-900 transition-all z-10 ${isConnecting ? 'bg-white scale-150 shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse' : 'bg-slate-600'}`} />)}
    </div>
  );
};

export default NodeComponent;
