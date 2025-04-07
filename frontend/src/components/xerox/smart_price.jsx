import React, { useEffect } from "react";

// Updated to match how it's used in Xerox.jsx
const SmartPriceToggle = ({
    isEnabled, 
    onChange,
    onToggle,
    copies = 1,
    totalPages = 1,
    isColor = false
}) => {
    useEffect(() => {
        // Calculate price whenever relevant props change
        const basePrice = isColor ? 12 : 10;
        const price = basePrice * copies * totalPages;
        
        // If onChange is provided for price updates, call it
        if (typeof onChange === 'function') {
            onChange(price);
        }
    }, [copies, totalPages, isColor, onChange]);

    // Handle toggle changes
    const handleToggleChange = (e) => {
        const isChecked = e.target.checked;
        
        // Support both old and new APIs
        if (typeof onChange === 'function' && typeof onToggle !== 'function') {
            // Old API - onChange is used for the toggle state
            onChange(isChecked);
        }
        
        if (typeof onToggle === 'function') {
            // New API - onToggle is used for the toggle state
            onToggle(isChecked);
        }
    };

    return (
        <div className="flex items-center gap-4 w-full">
            <div className="form-control">
                <label className="label cursor-pointer">
                    <span className="label-text mr-2">Enable smart pricing</span>
                    <input 
                        type="checkbox" 
                        className="toggle toggle-primary" 
                        checked={isEnabled}
                        onChange={handleToggleChange}
                    />
                </label>
                <p className="text-xs text-base-content/70">
                    Smart pricing optimizes cost based on document content
                </p>
            </div>
        </div>
    );
}

export default SmartPriceToggle;
