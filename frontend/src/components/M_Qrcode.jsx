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
        className="w-56 h-56 bg-white flex items-center justify-center mt-4 rounded-lg shadow-lg border-2 border-[#31304D] p-2 cursor-pointer transform transition-transform hover:scale-105"
        onClick={onClick}
      >
        <QRCodeCanvas
          value={qrUrl}
          size={size}
          level="H" // Highest error correction level
          includeMargin={true} // Add quiet zone margin
        />
      </div>

    </div>
  );
};

export default M_Qrcode;
