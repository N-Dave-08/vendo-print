import React, { useState, useEffect } from 'react';
import { getDatabase, ref as dbRef, get, set, onValue, push } from "firebase/database";
import M_Password from '../components/M_Password';

const Admin = () => {
  const [showModal, setShowModal] = useState(true);
  const [paperCount, setPaperCount] = useState(100);
  const [salesData, setSalesData] = useState({
    xerox: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 },
    usb: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 },
    qr: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 }
  });
  const [pricing] = useState({
    colorPrice: 12,
    bwPrice: 10
  });

  // Real-time data subscription for print jobs
  useEffect(() => {
    const db = getDatabase();
    const completedPrintsRef = dbRef(db, 'completedPrints');
    const paperRef = dbRef(db, 'paperCount');

    const completedPrintsUnsubscribe = onValue(completedPrintsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newSalesData = {
          xerox: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 },
          usb: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 },
          qr: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 }
        };

        // Process each completed print
        Object.values(data).forEach(job => {
          // Determine the source based on the upload method
          let source = job.source || 'xerox'; // Default to xerox if source is not specified
          
          if (!['xerox', 'usb', 'qr'].includes(source)) {
            source = 'xerox'; // Map unknown sources to xerox
          }

          const pages = job.totalPages || 1;
          const copies = job.copies || 1;
          const totalPapersUsed = pages * copies;
          let totalPrice = 0;
          let colorPageCount = 0;
          let bwPageCount = 0;

          // Calculate price and page counts based on color analysis
          if (job.colorAnalysis) {
            colorPageCount = job.colorAnalysis.coloredPageCount || 0;
            bwPageCount = job.colorAnalysis.blackAndWhitePageCount || 0;
            totalPrice = (colorPageCount * pricing.colorPrice) + (bwPageCount * pricing.bwPrice);
          } else {
            // If no color analysis, check if it's a color print
            if (job.isColor) {
              colorPageCount = pages;
              bwPageCount = 0;
              totalPrice = pages * pricing.colorPrice;
            } else {
              colorPageCount = 0;
              bwPageCount = pages;
              totalPrice = pages * pricing.bwPrice;
            }
          }

          // Update the sales data for this source
          newSalesData[source].total += totalPrice;
          newSalesData[source].papers += totalPapersUsed;
          newSalesData[source].colorPages += colorPageCount * copies;
          newSalesData[source].bwPages += bwPageCount * copies;
          newSalesData[source].details['Colored'] += colorPageCount * pricing.colorPrice * copies;
          newSalesData[source].details['Blk/wht'] += bwPageCount * pricing.bwPrice * copies;
        });

        setSalesData(newSalesData);

        // Calculate remaining paper count
        const totalPapersUsed = Object.values(newSalesData).reduce((total, data) => total + data.papers, 0);
        const remainingPapers = Math.max(100 - totalPapersUsed, 0);
        set(paperRef, remainingPapers);
        setPaperCount(remainingPapers);
      }
    });

    // Paper count subscription
    const paperCountUnsubscribe = onValue(paperRef, (snapshot) => {
      if (!snapshot.exists()) {
        // Initialize with 100 papers if not set
        set(paperRef, 100);
        setPaperCount(100);
      } else {
        setPaperCount(snapshot.val());
      }
    });

    return () => {
      completedPrintsUnsubscribe();
      paperCountUnsubscribe();
    };
  }, [pricing]);

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
    if (window.confirm('Are you sure you want to clear all sales data? This action cannot be undone.')) {
      try {
        const db = getDatabase();
        await set(dbRef(db, 'completedPrints'), null);
        setSalesData({
          xerox: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 },
          usb: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 },
          qr: { total: 0, details: { 'Blk/wht': 0, 'Colored': 0 }, papers: 0, colorPages: 0, bwPages: 0 }
        });
        // Reset paper count when clearing data
        await set(dbRef(db, 'paperCount'), 100);
        setPaperCount(100);
      } catch (error) {
        console.error("Error clearing sales data:", error);
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
          <button className="btn btn-error" onClick={handleClearData}>
            Clear All Data
          </button>
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
                  <div className="flex justify-between items-center">
                    <span className="text-base-content/80">Colored</span>
                    <span className="font-semibold">₱{data.details['Colored'].toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base-content/80">Blk/wht</span>
                    <span className="font-semibold">₱{data.details['Blk/wht'].toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Admin;
