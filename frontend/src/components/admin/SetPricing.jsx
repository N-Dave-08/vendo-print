import React, { useState, useEffect } from 'react';
import { getDatabase, ref as dbRef, set, onValue } from "firebase/database";

const SetPricing = () => {
  const [colorPrice, setColorPrice] = useState('');
  const [bwPrice, setBwPrice] = useState('');
  const db = getDatabase();

  // Basahin ang pricing settings mula sa Firebase
  useEffect(() => {
    const pricingRef = dbRef(db, 'pricing');
    const unsubscribe = onValue(pricingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setColorPrice(data.colorPrice || '');
        setBwPrice(data.bwPrice || '');
      }
    });
    return () => unsubscribe();
  }, [db]);

  const handleSave = () => {
    const pricingRef = dbRef(db, 'pricing');
    set(pricingRef, { 
      colorPrice: Number(colorPrice), 
      bwPrice: Number(bwPrice)
    })
      .then(() => alert('Pricing saved successfully!'))
      .catch((err) => alert('Error saving pricing: ' + err.message));
  };

  return (
    <div className="bg-white shadow-lg rounded-2xl p-6 w-full mb-6 border-4 border-[#31304D]">
      <h2 className="text-2xl font-semibold text-[#31304D] text-center mb-4">Set Pricing</h2>
      <div className="flex flex-col space-y-4">
        <div>
          <label className="text-lg font-semibold text-[#31304D]">
            Color Price per Page (₱):
          </label>
          <input
            type="number"
            value={colorPrice}
            onChange={(e) => setColorPrice(e.target.value)}
            className="border border-[#31304D] rounded-lg p-2 ml-2"
          />
        </div>
        <div>
          <label className="text-lg font-semibold text-[#31304D]">
            Black &amp; White Price per Page (₱):
          </label>
          <input
            type="number"
            value={bwPrice}
            onChange={(e) => setBwPrice(e.target.value)}
            className="border border-[#31304D] rounded-lg p-2 ml-2"
          />
        </div>
        <button
          onClick={handleSave}
          className="mt-4 w-32 py-2 bg-[#31304D] text-white rounded-lg"
        >
          Save Pricing
        </button>
      </div>
    </div>
  );
};

export default SetPricing;
