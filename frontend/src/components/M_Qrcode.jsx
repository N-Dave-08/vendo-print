import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const M_Qrcode = () => {
  const qrUrl = `http://192.168.1.14:5173/file-upload`;

  return (
    <div className="flex flex-col items-center">

      <div className="w-56 h-56 bg-white flex items-center justify-center mt-4 rounded-lg shadow-lg border-2 border-[#31304D] p-2">
        <QRCodeCanvas value={qrUrl} size={200} />
      </div>
    </div>
  );
};

export default M_Qrcode;
