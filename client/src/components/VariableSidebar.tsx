import React, { useState, useMemo } from 'react';
import { NodeVariables } from '../utils/flowVariables';
import { ChevronDownIcon, ChevronRightIcon, SearchIcon } from './icons';

interface VariableSidebarProps {
    availableVariables: NodeVariables[];
    onVariableClick?: (token: string) => void;
}

const VariableSidebar: React.FC<VariableSidebarProps> = ({ availableVariables, onVariableClick }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: prev[category] === undefined ? false : !prev[category] // Default expanded
        }));
    };

    const isCategoryExpanded = (category: string) => {
        return expandedCategories[category] !== false; // Default expanded
    };

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => ({
            ...prev,
            [nodeId]: prev[nodeId] === undefined ? false : !prev[nodeId] // Default expanded
        }));
    };

    const isNodeExpanded = (nodeId: string) => {
        return expandedNodes[nodeId] !== false; // Default expanded
    };

    // Filter variables based on search
    const filteredVariables = useMemo(() => {
        return availableVariables.map(node => ({
            ...node,
            variables: node.variables.filter(v =>
                v.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                v.key.toLowerCase().includes(searchQuery.toLowerCase())
            )
        })).filter(node => node.variables.length > 0);
    }, [availableVariables, searchQuery]);

    // Group by category
    const groupedVariables = useMemo(() => {
        const groups: Record<string, NodeVariables[]> = {};
        filteredVariables.forEach(node => {
            const category = node.category || 'Other';
            if (!groups[category]) groups[category] = [];
            groups[category].push(node);
        });
        return groups;
    }, [filteredVariables]);

    // Sort categories to put System Variables first
    const sortedCategories = useMemo(() => {
        return Object.keys(groupedVariables).sort((a, b) => {
            if (a === 'System Variables') return -1;
            if (b === 'System Variables') return 1;
            return a.localeCompare(b);
        });
    }, [groupedVariables]);

    const handleDragStart = (e: React.DragEvent, nodeId: string, variableKey: string) => {
        const token = `{{${nodeId}.${variableKey}}}`;
        e.dataTransfer.setData('application/vnd.flow.variable', token);
        e.dataTransfer.setData('text/plain', token);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleClick = (nodeId: string, variableKey: string) => {
        if (onVariableClick) {
            const token = `{{${nodeId}.${variableKey}}}`;
            onVariableClick(token);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-slate-900 border-r border-slate-800">
            {/* Header & Search */}
            <div className="p-4 border-b border-slate-800 space-y-3 shrink-0">
                <div>
                    <h3 className="font-bold text-white text-sm uppercase tracking-wider">Available Variables</h3>
                    <p className="text-xs text-slate-500 mt-1">Drag or tap to insert.</p>
                </div>
                <div className="relative">
                    <SearchIcon className="absolute left-2.5 top-2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search variables..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-800 text-sm text-slate-200 pl-9 pr-3 py-1.5 rounded-md border border-slate-700 focus:outline-none focus:border-brand-500 transition-colors placeholder-slate-600"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
                {sortedCategories.length === 0 && (
                    <div className="text-center py-8 text-slate-600 text-xs italic">
                        {searchQuery ? 'No matching variables found.' : 'No variables available.'}
                    </div>
                )}

                {sortedCategories.map(category => (
                    <div key={category} className="space-y-1">
                        {/* Category Header */}
                        <button
                            onClick={() => toggleCategory(category)}
                            className="w-full flex items-center justify-between px-2 py-1.5 bg-slate-800/40 hover:bg-slate-800/60 rounded-md transition-colors text-left group"
                        >
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-slate-300 transition-colors">{category}</span>
                            {isCategoryExpanded(category) ? <ChevronDownIcon className="w-3.5 h-3.5 text-slate-600" /> : <ChevronRightIcon className="w-3.5 h-3.5 text-slate-600" />}
                        </button>

                        {/* Nodes in Category */}
                        {isCategoryExpanded(category) && (
                            <div className="space-y-2 pl-1">
                                {groupedVariables[category].map(node => (
                                    <div key={node.nodeId} className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/50">
                                        <button
                                            onClick={() => toggleNode(node.nodeId)}
                                            className="w-full flex items-center justify-between p-2 bg-slate-800/80 hover:bg-slate-800 transition-colors text-left"
                                        >
                                            <span className="text-xs font-bold text-slate-300 truncate flex-1 mr-2" title={node.nodeLabel}>{node.nodeLabel}</span>
                                            {isNodeExpanded(node.nodeId) ? <ChevronDownIcon className="w-4 h-4 text-slate-500" /> : <ChevronRightIcon className="w-4 h-4 text-slate-500" />}
                                        </button>

                                        {isNodeExpanded(node.nodeId) && (
                                            <div className="p-1 space-y-0.5 bg-slate-900/30">
                                                {node.variables.map(variable => (
                                                    <div
                                                        key={variable.key}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, node.nodeId, variable.key)}
                                                        onClick={() => handleClick(node.nodeId, variable.key)}
                                                        className="group flex items-center gap-2 px-2 py-1.5 hover:bg-brand-900/20 rounded cursor-grab active:cursor-grabbing transition-colors select-none"
                                                        title={variable.description}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getTypeColor(variable.type)}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs text-slate-300 font-medium truncate group-hover:text-brand-300 transition-colors">{variable.label}</p>
                                                            <p className="text-[10px] text-slate-600 font-mono truncate group-hover:text-brand-500/70 transition-colors">{variable.key}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const getTypeColor = (type: string) => {
    switch (type) {
        case 'string': return 'bg-emerald-400';
        case 'number': return 'bg-blue-400';
        case 'boolean': return 'bg-purple-400';
        case 'object': return 'bg-orange-400';
        case 'array': return 'bg-pink-400';
        default: return 'bg-slate-400';
    }
};

export default VariableSidebar;
