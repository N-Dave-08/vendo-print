import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import Layout from "./components/usb/Layout";
import Printer from "./components/Printer"; 
import Xerox from "./Pages/Xerox"; 
import Settings from "./Pages/Admin"; 
import Usb from "./Pages/Usb"; 
import QRUpload from "./Pages/Qr_Files";
import FileUpload from "./components/qr/file_upload";

// Initialize GroupDocs license
if (window.GroupDocsViewer) {
  window.GroupDocsViewer.licenseKey = 'YOUR_LICENSE_KEY'; // Replace with your actual license key
}

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/printer" replace />} />
        <Route path="/" element={<Layout />}>
          <Route path="/printer" element={<Printer />} />
          <Route path="/xerox" element={<Xerox />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/usb" element={<Usb />} /> 
          <Route path ="/qr" element = {<QRUpload />} />
          <Route path ="/file-upload" element = {<FileUpload />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;