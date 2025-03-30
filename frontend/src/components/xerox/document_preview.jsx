import React from "react";

const DocumentPreview = ({ filePreviewUrl }) => {
    return (
        <div className="w-full h-full bg-white rounded-lg shadow-md p-4">
            <h3 className="text-xl font-bold text-[#31304D] mb-4">Document Preview</h3>
            <div className="w-full h-[500px] border-2 border-dashed border-gray-300 rounded-lg overflow-hidden flex items-center justify-center">
                {filePreviewUrl ? (
                    <img
                        src={filePreviewUrl}
                        alt="Document Preview"
                        className="max-w-full max-h-full object-contain"
                    />
                ) : (
                    <div className="text-gray-500 text-center">
                        <p>No document preview available</p>
                        <p className="text-sm mt-2">Scan a document to see preview</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentPreview;
