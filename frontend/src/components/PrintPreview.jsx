import React, { useState, useEffect, useRef } from "react";
import { X, Printer, Download, Check } from "lucide-react";

// Add styles to clean up the preview
const previewStyles = {
  container: {
    backgroundColor: '#fff',
    margin: '0',
    padding: '0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  previewArea: {
    flex: 1,
    overflow: 'auto',
    padding: '0',
    margin: '0',
    backgroundColor: '#fff'
  }
};

const PrintPreview = ({
  fileName,
  fileUrl,
  fileToUpload,
  copies,
  pageSize,
  isColor,
  orientation,
  pageOption,
  customRange,
  onClose,
  isPrinting
}) => {
  const [loading, setLoading] = useState(true);
  const [printSuccess, setPrintSuccess] = useState(false);
  const viewerRef = useRef(null);

  useEffect(() => {
    const loadViewer = async () => {
      setLoading(true);
      try {
        // Convert file to base64 for GroupDocs
        const base64File = await fileToBase64(fileToUpload);
        
        // Initialize GroupDocs Viewer with enhanced settings
        const viewer = new window.GroupDocsViewer({
          documentPath: base64File,
          element: viewerRef.current,
          viewerStyle: {
            backgroundColor: "#ffffff",
            height: "100%",
            width: "100%",
            border: "none",
            padding: "20px"
          },
          watermarkText: "",
          showHeader: false,
          showFooter: false,
          showToolbar: false,
          showZoom: true,
          defaultZoom: 1.0,
          zoomLevels: [0.5, 0.75, 1, 1.25, 1.5, 2],
          width: "100%",
          height: "100%",
          zoom: true,
          pageView: "ScrollView",
          showPaging: true,
          pageBorderWidth: 1,
          pageBorderColor: "#e5e7eb",
          pageMargin: 10,
          fitWidth: true,
          showDownload: false,
          showPrint: false,
          showSearch: false,
          printWithWatermark: false,
          printAnnotations: false,
          enableContextMenu: false,
          scrollView: true,
          preloadPagesCount: 3,
          renderOnlyVisible: true
        });

        // Load the document
        await viewer.load();
        
        // Set optimal zoom after loading
        viewer.setZoom('PageFit');
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading viewer:", error);
        setLoading(false);
      }
    };

    loadViewer();
  }, [fileToUpload]);

  const fileToBase64 = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const handlePrint = async () => {
    try {
      // Use GroupDocs print function
      const viewer = viewerRef.current.viewer;
      await viewer.print({
        paperSize: pageSize === 'Letter 8.5 x 11' ? 'Letter' : 'A4',
        orientation: orientation.toLowerCase(),
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        printBackground: true,
        pageRanges: pageOption === 'custom' ? customRange : '',
        copies: copies,
        color: isColor
      });

      setPrintSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error("Error printing document:", error);
      alert("Error printing document. Please try again later.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white w-full h-full flex flex-col" style={{ margin: 0, padding: 0 }}>
        <div className="flex-1 overflow-auto m-0 p-0" style={{ margin: 0, padding: 0 }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            <div className="h-full m-0 p-0" style={{ margin: 0, padding: 0 }}>
              {printSuccess ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 text-green-500">
                    <Check size={64} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Print Job Sent!</h3>
                  <p className="text-gray-600">Your document has been sent to the printer.</p>
                </div>
              ) : (
                <div ref={viewerRef} style={{ 
                  height: '100vh', 
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '20px'
                }} />
              )}
            </div>
          )}
        </div>
        
        <div className="fixed bottom-4 right-4 flex gap-2">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700"
          >
            <X size={20} />
          </button>
          
          {!printSuccess && (
            <>
              <button
                onClick={() => {
                  const viewer = viewerRef.current.viewer;
                  viewer.download();
                }}
                disabled={loading}
                className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50"
              >
                <Download size={20} />
              </button>
              
              <button
                onClick={handlePrint}
                disabled={loading || isPrinting}
                className="p-2 rounded-full bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
              >
                <Printer size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrintPreview; 