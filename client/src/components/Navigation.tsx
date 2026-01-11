
import React from 'react';

// Simple Icons for Navigation Bar to ensure consistent small size (12px/0.75rem)

const MinusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 12H6" />
  </svg>
);

const PlusIconLocal = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const FitIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
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
    <div className={`flex items-center gap-0.5 bg-gray-800/90 backdrop-blur-md border border-gray-700/50 p-0.5 rounded-md shadow-xl z-10 w-fit ${className || 'absolute bottom-8 left-8'}`}>
      <button 
        onClick={onZoomOut}
        className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors flex items-center justify-center"
        title="Zoom Out"
      >
        <MinusIcon />
      </button>
      
      <div className="w-[2.2rem] text-center text-[10px] text-gray-300 font-mono select-none font-bold leading-none">
        {Math.round(zoom * 100)}%
      </div>

      <button 
        onClick={onZoomIn}
        className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors flex items-center justify-center"
        title="Zoom In"
      >
        <PlusIconLocal />
      </button>
      
      <div className="w-px h-3 bg-gray-700/50 mx-0.5"></div>
      
      <button 
        onClick={onFitView}
        className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors flex items-center justify-center"
        title="Fit View (Reset)"
      >
        <FitIcon />
      </button>
    </div>
  );
};

export default Navigation;
