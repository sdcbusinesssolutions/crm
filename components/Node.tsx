
import React, { useState, KeyboardEvent, ReactNode } from 'react';
import { Node, NodeType, AnyNodeData, OnMessageData, MediaMessageData, SetWebhookData, ListMessageData, CTAMessageData, QuickReplyMessageData, AskAnythingData, CheckConditionData, WriteAttributeData, MediaType } from '../types';
import { MessageIcon, ImageFileIcon, WebhookIcon, TimingIcon, ListIcon, QuickReplyIcon, CtaIcon, GsheetIcon, CodeIcon, AskLocationIcon, TrashIcon, EditIcon, SettingsIcon, ConditionIcon, BookmarkIcon, SetWebhookIcon, TriggerIcon } from './icons';

interface NodeProps { node: Node; isConnecting: boolean; connectingSourceNodeId: string | null; onNodeDragStart: (e: React.MouseEvent, nodeId: string) => void; onNodeTouchStart: (e: React.TouchEvent, nodeId: string) => void; onUpdateNode: (nodeId: string, data: AnyNodeData) => void; onDeleteNode: (nodeId: string) => void; onSourceHandleMouseDown: (e: React.MouseEvent, nodeId: string, handleId: string) => void; onSourceHandleTouchStart: (e: React.TouchEvent, nodeId: string, handleId: string) => void; onNodeSettingsClick: (nodeId: string) => void; onNodeClick: (nodeId: string) => void; onNodeMouseUp: (nodeId: string) => void; }
interface NodeUIProps<T extends AnyNodeData> { node: Node & { data: T }; onUpdateNode: (nodeId: string, data: T) => void; onDeleteNode: (nodeId: string) => void; onSettingsClick: () => void; }
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
  return <div className={`relative bg-slate-900 text-slate-200 w-[320px] rounded-xl shadow-lg transition-all duration-300 border-l-[3px] border-y border-r border-y-slate-800 border-r-slate-800 ${styles.border} ${styles.shadow} ${selected ? 'ring-2 ring-white/20 scale-[1.01] shadow-2xl' : 'hover:shadow-xl hover:translate-y-[-2px]'} ${className} touch-none overflow-hidden flex flex-col`}>{children}</div>;
};

const NodeHeader: React.FC<{ title: string; onTitleSave: (newTitle: string) => void; onDelete: () => void; onSettingsClick: () => void; icon?: React.ReactNode; color: NodeColor; }> = ({ title, onTitleSave, onDelete, onSettingsClick, icon, color }) => {
  const [isEditing, setIsEditing] = useState(false); const [currentTitle, setCurrentTitle] = useState(title); const styles = getColorStyles(color);
  const handleSave = () => { if (currentTitle.trim()) onTitleSave(currentTitle.trim()); else setCurrentTitle(title); setIsEditing(false); };
  return (
    <div className={`flex justify-between items-center px-4 py-3 ${styles.headerBg} select-none`}>
      {isEditing ? (
        <input type="text" value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} onBlur={handleSave} onKeyDown={(e) => e.key === 'Enter' && handleSave()} autoFocus className="font-semibold text-sm bg-white/20 border border-white/30 rounded px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-white/40 w-full shadow-inner" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} />
      ) : (
        <div className="flex items-center space-x-3 overflow-hidden"><div className={`p-1.5 rounded-lg bg-black/20 text-white shadow-sm`}>{icon}</div><h3 className="font-bold text-sm text-white truncate drop-shadow-sm tracking-wide">{title}</h3></div>
      )}
      <div className="flex items-center space-x-1 pl-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button onMouseDown={e => e.stopPropagation()} onClick={(e) => { onSettingsClick(); e.stopPropagation(); }} className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-md transition-all"><SettingsIcon className="w-4 h-4" /></button>
        <button onMouseDown={e => e.stopPropagation()} onClick={(e) => { setIsEditing(true); e.stopPropagation(); }} className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-md transition-all"><EditIcon className="w-4 h-4" /></button>
        <button onMouseDown={e => e.stopPropagation()} onClick={(e) => { onDelete(); e.stopPropagation(); }} className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-md transition-all"><TrashIcon className="w-4 h-4" /></button>
      </div>
      <div className="flex md:hidden items-center space-x-1 pl-2"><button onMouseDown={e => e.stopPropagation()} onClick={(e) => { onSettingsClick(); e.stopPropagation(); }} className="p-1.5 text-white/80"><SettingsIcon className="w-4 h-4" /></button></div>
    </div>
  );
};

const FieldWrapper: React.FC<{ label: string, children: ReactNode }> = ({ label, children }) => (<div className="mb-3 last:mb-0"><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{label}</label>{children}</div>);
const TextInput: React.FC<{ value: string, onChange: (val: string) => void, placeholder?: string }> = ({ value, onChange, placeholder }) => (<input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} />);
const TextareaInput: React.FC<{ value: string, onChange: (val: string) => void, placeholder?: string, rows?: number }> = ({ value, onChange, placeholder, rows = 3 }) => (<textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none resize-none leading-relaxed" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} />);
const SelectInput: React.FC<{ value: string, onChange: (val: string) => void, options: string[] }> = ({ value, onChange, options }) => (<div className="relative"><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none appearance-none cursor-pointer" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>{options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select><div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></div></div>);

const OnMessageNodeUI: React.FC<NodeUIProps<OnMessageData>> = ({ node, onUpdateNode, onDeleteNode, onSettingsClick }) => {
  const [keywordInput, setKeywordInput] = useState(''); const data = node.data;
  const handleDataChange = (key: keyof OnMessageData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  const removeKeyword = (idx: number) => handleDataChange('keywords', data.keywords.filter((_, i) => i !== idx));
  const addKeywords = (newKws: string[]) => { const unique = newKws.map(k => k.trim()).filter(k => k && !data.keywords.includes(k)); if (unique.length > 0) handleDataChange('keywords', [...data.keywords, ...unique]); };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === ',' || e.key === 'Enter') { e.preventDefault(); addKeywords(keywordInput.split(',')); setKeywordInput(''); } };
  return (
    <NodeContainer color="pink" className="group">
      <NodeHeader color="pink" icon={<TriggerIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-4 space-y-4 bg-slate-900/95 flex-1">
        <FieldWrapper label="Message Type"><SelectInput value={data.messageType} onChange={val => handleDataChange('messageType', val)} options={['Text', 'Image', 'Audio', 'Video', 'Document']} /></FieldWrapper>
        <FieldWrapper label="Keywords"><div onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} className="w-full p-2 border border-slate-800 bg-slate-950 rounded-lg flex flex-wrap items-center gap-2 min-h-[42px]">{data.keywords.map((k, i) => (<div key={i} className="bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">{k}<button onClick={() => removeKeyword(i)} className="hover:text-white">×</button></div>))}<input type="text" value={keywordInput} onChange={e => setKeywordInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Add..." className="flex-grow bg-transparent focus:outline-none text-slate-400 text-sm min-w-[60px]" /></div></FieldWrapper>
      </div>
    </NodeContainer>
  );
}

const MediaMessageNodeUI: React.FC<NodeUIProps<MediaMessageData>> = ({ node, onUpdateNode, onDeleteNode, onSettingsClick }) => {
  const { data } = node; const handleDataChange = (key: keyof MediaMessageData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="purple" className="group">
      <NodeHeader color="purple" icon={<ImageFileIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-4 space-y-4 bg-slate-900/95 flex-1"><FieldWrapper label="Media Type"><SelectInput value={data.mediaType} onChange={val => handleDataChange('mediaType', val as MediaType)} options={Object.values(MediaType)} /></FieldWrapper><FieldWrapper label="URL"><TextInput value={data.url} onChange={val => handleDataChange('url', val)} placeholder="https://..." /></FieldWrapper></div>
    </NodeContainer>
  );
}

const GenericNodeUI: React.FC<NodeUIProps<AnyNodeData>> = ({ node, onUpdateNode, onDeleteNode, onSettingsClick }) => {
  const { data, type } = node; const handleDataChange = (key: string, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  let icon = <SettingsIcon />; let color: NodeColor = 'slate';
  if (type === NodeType.TextMessage) { icon = <MessageIcon />; color = 'blue'; } else if (type === NodeType.Webhook) { icon = <WebhookIcon />; color = 'amber'; } else if (type === NodeType.Timing) { icon = <TimingIcon />; color = 'slate'; } else if (type === NodeType.AskLocation) { icon = <AskLocationIcon />; color = 'teal'; } else if (type === NodeType.Code) { icon = <CodeIcon />; color = 'indigo'; } else if (type === NodeType.Gsheet) { icon = <GsheetIcon />; color = 'emerald'; }
  const renderFields = () => {
    switch (type) { case NodeType.TextMessage: return <FieldWrapper label="Message Text"><TextareaInput value={data.message} onChange={val => handleDataChange('message', val)} placeholder="Hello!" /></FieldWrapper>; case NodeType.Webhook: return <FieldWrapper label="Event Type"><TextInput value={data.eventType} onChange={val => handleDataChange('eventType', val)} placeholder="e.g. user_signup" /></FieldWrapper>; case NodeType.Timing: return <div className="text-center text-xs text-slate-400 py-3 bg-slate-950 rounded-lg border border-slate-800">Waits for <span className="font-bold text-white">{data.delayValue || 1} {data.delayUnit || 'Minutes'}</span></div>; case NodeType.AskLocation: return <FieldWrapper label="Prompt Text"><TextInput value={data.text} onChange={val => handleDataChange('text', val)} placeholder="Share location..." /></FieldWrapper>; default: return <p className="text-slate-500 text-xs italic p-2 text-center">Configure via Settings</p>; }
  }
  return (
    <NodeContainer color={color} className="group">
      <NodeHeader color={color} icon={icon} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-4 space-y-4 bg-slate-900/95 flex-1">{renderFields()}</div>
    </NodeContainer>
  );
}

const SetWebhookNodeUI: React.FC<NodeUIProps<SetWebhookData>> = ({ node, onUpdateNode, onDeleteNode, onSettingsClick }) => {
  const { data } = node; const handleDataChange = (key: keyof SetWebhookData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="cyan" className="group">
      <NodeHeader color="cyan" title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onSettingsClick={onSettingsClick} icon={<SetWebhookIcon />} />
      <div className="p-4 space-y-3 bg-slate-900/95 flex-1"><div className="flex items-center space-x-2 bg-slate-950 p-3 rounded-lg border border-slate-800"><span className="font-mono font-bold text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">{data.method}</span><p className="text-slate-400 truncate text-xs font-mono flex-1 opacity-90">{data.url || '/endpoint'}</p></div></div>
    </NodeContainer>
  );
};

const WriteAttributeNodeUI: React.FC<NodeUIProps<WriteAttributeData>> = ({ node, onUpdateNode, onDeleteNode, onSettingsClick }) => {
  const { data } = node; const handleDataChange = (key: keyof WriteAttributeData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="teal" className="group">
      <NodeHeader color="teal" title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onSettingsClick={onSettingsClick} icon={<BookmarkIcon />} />
      <div className="p-4 bg-slate-900/95 flex-1"><div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3 text-center"><p className="text-xs text-teal-300 font-medium">Updates Contact Attributes</p></div></div>
    </NodeContainer>
  );
};

const AskAnythingNodeUI: React.FC<InteractiveNodeUIProps<AskAnythingData>> = ({ node, onUpdateNode, onDeleteNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node; const handleDataChange = (key: keyof AskAnythingData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="orange" className="group">
      <NodeHeader color="orange" icon={<MessageIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-4 bg-slate-900/95 flex-1">
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 mb-4"><p className="text-slate-300 whitespace-pre-wrap text-sm italic opacity-90 leading-relaxed">"{data.text || 'Ask a question...'}"</p></div>
        <div className="space-y-3">
          {data.ifUnresponsive && (<div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-2.5 rounded-lg border border-slate-800 group/handle"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">On Timeout</span><div id={`h-${node.id}-unresponsive`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'unresponsive')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'unresponsive')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-slate-600 rounded-full cursor-pointer hover:bg-orange-400 hover:scale-125 transition-all touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" /></div>)}
          <div className="relative flex items-center justify-between bg-slate-800/50 px-3 py-2.5 rounded-lg border border-slate-800 group/handle"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">On Answer</span><div id={`h-${node.id}-default`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'default')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'default')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-emerald-500 rounded-full cursor-pointer hover:scale-125 transition-all shadow-[0_0_8px_rgba(16,185,129,0.6)] touch-none absolute -right-1.5 top-1/2 -translate-y-1/2 ring-2 ring-slate-900" /></div>
        </div>
      </div>
    </NodeContainer>
  );
};

const ListMessageNodeUI: React.FC<InteractiveNodeUIProps<ListMessageData>> = ({ node, onUpdateNode, onDeleteNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node; const handleDataChange = (key: keyof ListMessageData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="violet" className="group">
      <NodeHeader color="violet" icon={<ListIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-4 space-y-3 bg-slate-900/95 flex-1">
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800"><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Body</p><p className="text-slate-300 text-xs leading-relaxed line-clamp-3">{data.body || "..."}</p></div>
        <div className="w-full py-2 bg-violet-500/10 rounded-lg border border-dashed border-violet-500/30 text-center text-xs text-violet-300 font-bold">{data.buttonText || "Menu Button"}</div>
        <div className="space-y-2 pt-1">{data.sections?.map((section) => (<div key={section.id} className="space-y-2"><p className="text-[10px] font-bold text-slate-500 uppercase pl-1">{section.title}</p>{section.items.map((item) => (<div key={item.id} className="relative flex items-center justify-between bg-slate-800/50 px-3 py-2.5 rounded-lg border border-slate-700 hover:border-violet-500/40 transition-colors group/item"><span className="text-xs font-medium text-slate-300">{item.title}</span><div id={`h-${node.id}-${item.id}`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, item.id)} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, item.id)} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-violet-400 rounded-full cursor-pointer hover:scale-125 transition-transform shadow-sm absolute -right-1.5 top-1/2 -translate-y-1/2 border-2 border-slate-900 touch-none" /></div>))}</div>))}</div>
      </div>
    </NodeContainer>
  );
};

const CheckConditionNodeUI: React.FC<InteractiveNodeUIProps<CheckConditionData>> = ({ node, onUpdateNode, onDeleteNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node; const handleDataChange = (key: keyof CheckConditionData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="rose" className="group">
      <NodeHeader color="rose" icon={<ConditionIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-4 space-y-3 bg-slate-900/95 flex-1">
        {data.conditions.map((condition, index) => (<div key={condition.id} className="relative flex items-center justify-between bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 rounded-lg"><span className="text-xs font-bold text-rose-200 truncate pr-4">{condition.name || `Condition ${index + 1}`}</span><div id={`h-${node.id}-${condition.id}`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, condition.id)} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, condition.id)} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-rose-500 rounded-full cursor-pointer hover:scale-125 transition-transform absolute -right-1.5 top-1/2 -translate-y-1/2 border-2 border-slate-900 touch-none shadow-[0_0_5px_rgba(244,63,94,0.5)]" /></div>))}
        <div className="relative flex items-center justify-between bg-slate-800/50 border border-slate-700 px-3 py-2.5 rounded-lg mt-4"><span className="text-xs font-bold text-slate-500">False / Fallback</span><div id={`h-${node.id}-default`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'default')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'default')} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-slate-500 rounded-full cursor-pointer hover:scale-125 transition-transform absolute -right-1.5 top-1/2 -translate-y-1/2 border-2 border-slate-900 touch-none" /></div>
      </div>
    </NodeContainer>
  );
};

const CTAMessageNodeUI: React.FC<NodeUIProps<CTAMessageData>> = ({ node, onUpdateNode, onDeleteNode, onSettingsClick }) => {
  const { data } = node; const handleDataChange = (key: keyof CTAMessageData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="cyan" className="group">
      <NodeHeader color="cyan" icon={<CtaIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-4 space-y-3 bg-slate-900/95 flex-1">
        {data.headerType !== 'None' && (<div className="bg-slate-950 h-10 rounded-lg flex items-center justify-center border border-slate-800 text-slate-500"><span className="text-[10px] font-bold uppercase">{data.headerType} Header</span></div>)}
        <p className="text-sm text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 leading-relaxed">{data.body || "Message Body"}</p>
        <div className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-center py-2.5 rounded-lg font-bold text-sm cursor-pointer hover:bg-cyan-500/20 transition-colors">{data.displayText || 'Call To Action'}</div>
      </div>
    </NodeContainer>
  );
};

const QuickReplyMessageNodeUI: React.FC<InteractiveNodeUIProps<QuickReplyMessageData>> = ({ node, onUpdateNode, onDeleteNode, onSettingsClick, onSourceHandleMouseDown, onSourceHandleTouchStart }) => {
  const { data } = node; const handleDataChange = (key: keyof QuickReplyMessageData, value: any) => onUpdateNode(node.id, { ...data, [key]: value });
  return (
    <NodeContainer color="emerald" className="group">
      <NodeHeader color="emerald" icon={<QuickReplyIcon />} title={data.label} onTitleSave={(t) => handleDataChange('label', t)} onDelete={() => onDeleteNode(node.id)} onSettingsClick={onSettingsClick} />
      <div className="p-4 space-y-3 bg-slate-900/95 flex-1">
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800"><p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{data.body || "Quick reply question..."}</p></div>
        <div className="space-y-2">{data.buttons.map((button) => (<div key={button.id} className="relative flex items-center justify-center px-4 py-2.5 bg-emerald-500/10 text-emerald-400 font-semibold rounded-lg border border-emerald-500/20 text-xs hover:bg-emerald-500/20 transition-colors">{button.title}<div id={`h-${node.id}-${button.id}`} onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, button.id)} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, button.id)} onClick={(e) => e.stopPropagation()} className="w-3 h-3 bg-emerald-500 rounded-full cursor-pointer hover:scale-125 transition-transform absolute -right-1.5 top-1/2 -translate-y-1/2 border-2 border-slate-900 shadow-sm touch-none" /></div>))}</div>
      </div>
    </NodeContainer>
  );
}

const CUSTOM_HANDLE_NODES = [NodeType.ListMessage, NodeType.QuickReplyMessage, NodeType.AskAnything, NodeType.CheckCondition];

const NodeComponent: React.FC<NodeProps> = ({ node, isConnecting, connectingSourceNodeId, onNodeDragStart, onNodeTouchStart, onUpdateNode, onDeleteNode, onSourceHandleMouseDown, onSourceHandleTouchStart, onNodeSettingsClick, onNodeClick, onNodeMouseUp }) => {
  const nodeStyles = { left: `${node.position.x}px`, top: `${node.position.y}px` };
  const renderNodeUI = () => {
    const props = { node: node as any, onUpdateNode: onUpdateNode as any, onDeleteNode, onSettingsClick: () => onNodeSettingsClick(node.id), onSourceHandleMouseDown, onSourceHandleTouchStart };
    switch (node.type) { case NodeType.OnMessage: return <OnMessageNodeUI {...props} />; case NodeType.MediaMessage: return <MediaMessageNodeUI {...props} />; case NodeType.SetWebhook: return <SetWebhookNodeUI {...props} />; case NodeType.WriteAttribute: return <WriteAttributeNodeUI {...props} />; case NodeType.AskAnything: return <AskAnythingNodeUI {...props} />; case NodeType.ListMessage: return <ListMessageNodeUI {...props} />; case NodeType.CTAMessage: return <CTAMessageNodeUI {...props} />; case NodeType.QuickReplyMessage: return <QuickReplyMessageNodeUI {...props} />; case NodeType.CheckCondition: return <CheckConditionNodeUI {...props} />; default: return <GenericNodeUI {...props} />; }
  }
  const isConnectionSource = connectingSourceNodeId === node.id;
  return (
    <div id={node.id} data-node-id={node.id} className={`absolute transition-transform duration-200 ease-out ${isConnectionSource ? 'z-50 scale-105' : ''} ${isConnecting ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'} touch-none select-none`} style={nodeStyles} onMouseDown={(e) => onNodeDragStart(e, node.id)} onTouchStart={(e) => onNodeTouchStart(e, node.id)} onClick={(e) => { e.stopPropagation(); onNodeClick(node.id); }} onMouseUp={(e) => { onNodeMouseUp(node.id); }}>
      {renderNodeUI()}
      {!CUSTOM_HANDLE_NODES.includes(node.type) && (<div id={`h-${node.id}-default`} className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-slate-400 rounded-full border-2 border-slate-900 hover:bg-white hover:border-brand-500 hover:scale-125 transition-all cursor-pointer touch-none shadow-md" onMouseDown={(e) => onSourceHandleMouseDown(e, node.id, 'default')} onTouchStart={(e) => onSourceHandleTouchStart(e, node.id, 'default')} />)}
      {node.type !== NodeType.OnMessage && (<div id={`h-${node.id}-target`} onMouseUp={(e) => { e.stopPropagation(); onNodeMouseUp(node.id); }} className={`absolute -left-1.5 top-[2rem] -translate-y-1/2 w-3 h-3 rounded-full border-2 border-slate-900 transition-all z-10 ${isConnecting ? 'bg-white scale-150 shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse' : 'bg-slate-600'}`} />)}
    </div>
  );
};

export default NodeComponent;
