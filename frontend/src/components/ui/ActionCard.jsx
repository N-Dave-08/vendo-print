import React from 'react';
import { Link } from 'react-router-dom';

/**
 * ActionCard - A reusable card component with an icon and label
 * 
 * @param {Object} props
 * @param {string|Component} props.icon - Image source URL or Lucide icon component
 * @param {string} props.alt - Alt text for the icon (used only with image source)
 * @param {string} props.label - Text label to display below the icon
 * @param {string} props.to - Path to navigate to (if using as a Link)
 * @param {function} props.onClick - Click handler (if using as a button)
 * @param {string} props.iconColor - Color class for Lucide icons (default is text-primary)
 * @param {string} props.className - Additional classes to apply to the component
 */
const ActionCard = ({ 
  icon, 
  alt, 
  label, 
  to, 
  onClick, 
  iconColor = "text-primary",
  className = ""
}) => {
    const cardContent = (
        <div className={`group hover:scale-105 transition-transform duration-300 ${className}`}>
            <div className="card bg-base-100 hover:bg-base-200 border-2 border-primary shadow-lg hover:shadow-xl transition-all">
                <div className="card-body items-center justify-center py-8">
                    <figure className="mb-4">
                        {typeof icon === 'string' ? (
                            // For traditional image source
                            <img 
                              src={icon} 
                              alt={alt || label} 
                              className="w-24 h-24 transition-transform group-hover:scale-110" 
                            />
                        ) : (
                            // For Lucide icon components
                            React.createElement(icon, {
                                className: `w-24 h-24 ${iconColor} transition-transform group-hover:scale-110`,
                                strokeWidth: 1.5,
                                "aria-hidden": "true"
                            })
                        )}
                    </figure>
                    <h3 className="card-title text-primary text-xl">
                        {label}
                    </h3>
                </div>
            </div>
        </div>
    );

    // If 'to' prop is provided, render as Link, otherwise as a clickable div
    if (to) {
        return (
            <Link 
                to={to} 
                className="block" 
                aria-label={`Go to ${label}`}
            >
                {cardContent}
            </Link>
        );
    }

    return (
        <button 
            className="w-full" 
            onClick={onClick}
            aria-label={label}
        >
            {cardContent}
        </button>
    );
};

export default ActionCard;