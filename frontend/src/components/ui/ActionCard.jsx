import React from 'react';
import { Link } from 'react-router-dom';

/**
 * ActionCard - A reusable card component with an icon and label
 * 
 * @param {Object} props
 * @param {string} props.icon - Image source for the icon
 * @param {string} props.alt - Alt text for the icon
 * @param {string} props.label - Text label to display below the icon
 * @param {string} props.to - Path to navigate to (if using as a Link)
 * @param {function} props.onClick - Click handler (if using as a button)
 */
const ActionCard = ({ icon, alt, label, to, onClick }) => {
    const cardContent = (
        <div className="flex flex-col items-center transition-transform hover:scale-105">
            <div className="w-full h-56 bg-white flex items-center justify-center rounded-xl border-4 border-[#31304D] shadow-lg hover:shadow-xl">
                <img src={icon} alt={alt} className="w-28 h-28" />
            </div>
            <p className="text-2xl font-bold text-[#31304D] mt-3">{label}</p>
        </div>
    );

    // If 'to' prop is provided, render as Link, otherwise as a clickable div
    if (to) {
        return <Link to={to}>{cardContent}</Link>;
    }

    return (
        <div className="cursor-pointer" onClick={onClick}>
            {cardContent}
        </div>
    );
};

export default ActionCard;