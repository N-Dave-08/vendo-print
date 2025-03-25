import React from "react";

const DocumentPreview = ({ fileUrl, fileName }) => {

  const fileExtension = fileName?.split(".").pop().toLowerCase();


  const googleDocsViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
    fileUrl
  )}&embedded=true`;

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 w-full">
      <h2 className="text-xl font-bold mb-4 text-[#31304D]">
        {fileName || "Document Preview"}
      </h2>


      <div className="w-full h-full overflow-y-auto flex justify-center rounded-lg shadow-md p-4">


        {["jpg", "jpeg", "png", "gif"].includes(fileExtension) && (
          <img
            src={fileUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
          />
        )}

     
        {["pdf", "docx", "xlsx", "pptx", "doc", "xls", "ppt"].includes(
          fileExtension
        ) && (
          <iframe
            src={googleDocsViewerUrl}
            className="w-full h-[80vh]"
            title="Document Preview"
          />
        )}
      </div>
    </div>
  );
};

export default DocumentPreview;
