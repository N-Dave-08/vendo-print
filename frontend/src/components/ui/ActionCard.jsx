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
            <div className="card bg-base-100 border-primary border-4 shadow-xl hover:shadow-2xl">
                <div className="card-body justify-center items-center py-12">
                    <figure className="mb-2">
                        {typeof icon === 'string' ? (
                            // For traditional image source
                            <img 
                              src={icon} 
                              alt={alt || label} 
                              className="w-28 h-28 transition-transform group-hover:scale-110" 
                            />
                        ) : (
                            // For Lucide icon components
                            React.createElement(icon, {
                                className: `w-28 h-28 ${iconColor} transition-transform group-hover:scale-110`,
                                strokeWidth: 1.5,
                                "aria-hidden": "true"
                            })
                        )}
                    </figure>
                    <div className="card-title mt-2 justify-center text-primary">
                        {label}
                    </div>
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
        <div 
            className="cursor-pointer" 
            onClick={onClick}
            role="button"
            tabIndex={0}
            aria-label={label}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick && onClick(e);
                }
            }}
        >
            {cardContent}
        </div>
    );
};

export default ActionCard;