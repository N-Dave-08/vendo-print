import React, { useState, useEffect } from 'react';
import { getDatabase, ref as dbRef, get, set, onValue } from "firebase/database";
import M_Password from '../components/M_Password';
import SetPricing from '../components/admin/SetPricing';

const Admin = () => {
  const [showModal, setShowModal] = useState(true);
  const [paperCount, setPaperCount] = useState(82);
  const [salesData, setSalesData] = useState({
    xerox: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 },
    usb: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 },
    qr: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 }
  });
  const [pricing, setPricing] = useState({
    colorPrice: 12,
    bwPrice: 10
  });

  // Fetch pricing settings
  useEffect(() => {
      const db = getDatabase();
    const pricingRef = dbRef(db, 'pricing');
    
    const unsubscribe = onValue(pricingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setPricing({
          colorPrice: data.colorPrice || 12,
          bwPrice: data.bwPrice || 10
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time data subscription
  useEffect(() => {
    const db = getDatabase();
    const uploadedFilesRef = dbRef(db, 'uploadedFiles');
    
    const unsubscribe = onValue(uploadedFilesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newSalesData = {
          xerox: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 },
          usb: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 },
          qr: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 }
        };

        // Process each file entry
        Object.values(data).forEach(file => {
          // Skip if file is not ready
          if (file.status !== "ready") return;

          // Determine the source (qr, usb, or xerox)
          let source = file.uploadSource || 'xerox';
          if (file.uploadedFrom === 'usb') {
            source = 'usb';
          }

          const pages = file.totalPages || 1;
          let totalPrice = 0;
          let colorPageCount = 0;
          let bwPageCount = 0;

          // Calculate price and page counts based on color analysis
          if (file.colorAnalysis) {
            // Use the direct counts from colorAnalysis if available
            colorPageCount = file.colorAnalysis.coloredPageCount || 0;
            bwPageCount = file.colorAnalysis.blackAndWhitePageCount || 0;

            // Calculate prices based on the actual page counts
            totalPrice = (colorPageCount * pricing.colorPrice) + (bwPageCount * pricing.bwPrice);
          } else if (file.colorAnalysis?.pageAnalysis) {
            // Fallback to page-by-page analysis if available
            file.colorAnalysis.pageAnalysis.forEach(page => {
              if (page.hasColor) {
                colorPageCount++;
                totalPrice += pricing.colorPrice;
              } else {
                bwPageCount++;
                totalPrice += pricing.bwPrice;
              }
            });
          } else {
            // If no color analysis available, use legacy logic
            if (file.isColor) {
              colorPageCount = pages;
              totalPrice = pages * pricing.colorPrice;
            } else {
              bwPageCount = pages;
              totalPrice = pages * pricing.bwPrice;
            }
          }

          // Multiply by copies if specified
          const copies = file.copies || 1;
          totalPrice *= copies;
          colorPageCount *= copies;
          bwPageCount *= copies;

          // Update sales data
          if (newSalesData[source]) {
            newSalesData[source].total += totalPrice;
            newSalesData[source].papers += (colorPageCount + bwPageCount);
            newSalesData[source].colorPages += colorPageCount;
            newSalesData[source].bwPages += bwPageCount;
            newSalesData[source].details['Colored'] += colorPageCount * pricing.colorPrice;
            newSalesData[source].details['Blk/wht'] += bwPageCount * pricing.bwPrice;
          }
        });

        setSalesData(newSalesData);
      }
    });

    return () => unsubscribe();
  }, [pricing]); // Add pricing as dependency to recalculate when prices change

  // Initialize paperCount in Firebase if it doesn't exist
  useEffect(() => {
    const db = getDatabase();
    const paperRef = dbRef(db, 'paperCount');
    
    const unsubscribe = onValue(paperRef, (snapshot) => {
      if (!snapshot.exists()) {
        // Initialize with 100 papers if not set
        set(paperRef, 100);
        setPaperCount(100);
      } else {
        setPaperCount(snapshot.val());
      }
    });

    return () => unsubscribe();
  }, []);

  const handleReset = async () => {
    try {
      const db = getDatabase();
      await set(dbRef(db, 'paperCount'), 100);
      setPaperCount(100);
    } catch (error) {
      console.error("Error resetting paper count:", error);
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear all files data? This action cannot be undone.')) {
      try {
        const db = getDatabase();
        await set(dbRef(db, 'uploadedFiles'), null);
        setSalesData({
          xerox: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 },
          usb: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 },
          qr: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 }
        });
      } catch (error) {
        console.error("Error clearing files data:", error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-6">
      {showModal && <M_Password closeModal={() => setShowModal(false)} />}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold text-primary">Admin Dashboard</h1>
      </div>

        {/* Paper Status Card */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <h2 className="card-title text-2xl">Paper Inventory</h2>
              <button className="btn btn-primary" onClick={handleReset}>Reset</button>
            </div>
            <div className="flex items-center gap-4">
              <div className="radial-progress text-primary" style={{ "--value": (paperCount), "--size": "8rem" }}>
                {paperCount}/100
              </div>
              <div className="stats shadow">
                <div className="stat">
                  <div className="stat-title">Current Stock</div>
                  <div className="stat-value">{paperCount}</div>
                  <div className="stat-desc">sheets remaining</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(salesData).map(([key, data]) => (
            <div key={key} className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title capitalize">{key} Sales</h2>
                <div className="stats stats-vertical shadow">
                  <div className="stat">
                    <div className="stat-title">Papers Used</div>
                    <div className="stat-value text-primary">{data.papers}</div>
                    <div className="stat-desc">
                      {data.colorPages} color, {data.bwPages} B&W
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Total Amount</div>
                    <div className="stat-value">₱{data.total.toFixed(2)}</div>
                  </div>
                </div>
                <div className="divider"></div>
                <div className="space-y-2">
                  {Object.entries(data.details).map(([type, amount]) => (
                    <div key={type} className="flex justify-between items-center">
                      <span className="text-base-content/80">{type}</span>
                      <span className="font-semibold">₱{amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing Settings */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Price Settings</h2>
            <SetPricing />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
