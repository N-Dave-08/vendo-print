import React, { useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const M_Qrcode = ({ onClick, size = 200 }) => {
  // Use the network IP address to ensure it works from mobile devices
  const qrUrl = useMemo(() => {
    // Hardcode the network IP address that's visible to other devices
    return `http://192.168.1.19:5173/file-upload`;
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div
        className="card card-bordered border-primary p-2 bg-base-100 shadow-xl cursor-pointer hover:scale-105 transition-transform w-56 h-56 flex items-center justify-center"
        onClick={onClick}
      >
        <QRCodeCanvas
          value={qrUrl}
          size={size}
          level="H" // Highest error correction level
          includeMargin={true} // Add quiet zone margin
        />
      </div>
      <div className="mt-4 text-center">
        <p className="text-sm text-base-content opacity-70">Scan to upload files</p>
      </div>
    </div>
  );
};

export default M_Qrcode;
