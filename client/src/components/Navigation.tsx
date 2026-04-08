import React from 'react';

// Premium Icons for Navigation

const MinusIcon = () => (
   <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M18 12H6" />
   </svg>
);

const PlusIconLocal = () => (
   <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
   </svg>
);

const FitIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
);

interface NavigationProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  className?: string;
}

const Navigation: React.FC<NavigationProps> = ({ zoom, onZoomIn, onZoomOut, onFitView, className }) => {
  return (
    <div className={`flex items-center gap-1.5 p-1 rounded-lg z-10 w-fit ${className || ''}`}>
      
      {/* ZOOM OUT (-) */}
      <button 
        onClick={onZoomOut}
        className="p-1 px-1.5 text-gray-500 hover:text-white hover:bg-slate-800 rounded-md transition-all flex items-center justify-center border border-slate-700/10 hover:border-slate-700/50"
        title="Zoom Out"
      >
        <MinusIcon />
      </button>

      {/* ZOOM PERCENTAGE DISPLAY */}
      <div className="px-2 text-[11px] text-gray-300 font-mono select-none font-extrabold leading-none tracking-tighter min-w-[3.5rem] text-center">
        {Math.round(zoom * 100)}%
      </div>
      
      {/* ZOOM IN (+) */}
      <button 
        onClick={onZoomIn}
        className="p-1 px-1.5 text-gray-500 hover:text-white hover:bg-slate-800 rounded-md transition-all flex items-center justify-center border border-slate-700/10 hover:border-slate-700/50"
        title="Zoom In"
      >
        <PlusIconLocal />
      </button>

      <div className="w-px h-3 bg-slate-700/50 mx-0.5"></div>
      
      {/* FIT ENTIRE FLOW IN VIEW */}
      <button 
        onClick={onFitView}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-800 rounded-md transition-all flex items-center justify-center"
        title="Fit All Nodes in View"
      >
        <FitIcon />
      </button>
    </div>
  );
};

export default Navigation;
