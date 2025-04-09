import React from "react";

const PageOrientation = ({ orientation, setOrientation }) => {
  return (
    <div className="mt-6">
      <p className="text-2xl font-bold text-primary mb-4">Orientation</p>
      <div className="flex gap-6">
        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="radio"
            name="orientation"
            value="Portrait"
            checked={orientation === "Portrait"}
            onChange={(e) => setOrientation(e.target.value)}
            className="radio radio-primary"
          />
          <span className="label-text text-lg">Portrait</span>
        </label>
        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="radio"
            name="orientation"
            value="Landscape"
            checked={orientation === "Landscape"}
            onChange={(e) => setOrientation(e.target.value)}
            className="radio radio-primary"
          />
          <span className="label-text text-lg">Landscape</span>
        </label>
      </div>
    </div>
  );
};

export default PageOrientation;
