import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

function MiniNav({ title, onBack, showBackButton = true }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 border-b">
      {showBackButton && (
        <button
          onClick={handleBack}
          className="p-2 rounded-full hover:bg-gray-100"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
      )}
      <h2 className="text-xl font-semibold">{title}</h2>
    </div>
  );
}

export default MiniNav; 