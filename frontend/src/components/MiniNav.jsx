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
    <div className="navbar bg-base-100 border-b">
      <div className="flex-none">
        {showBackButton && (
          <button
            onClick={handleBack}
            className="btn btn-ghost btn-circle"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="flex-1">
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
    </div>
  );
}

export default MiniNav; 