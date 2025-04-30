import React, { useState, useEffect } from 'react';
import { getDatabase, ref as dbRef, onValue } from "firebase/database";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const MonthlyStats = () => {
  const [monthlyData, setMonthlyData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataYear, setDataYear] = useState(new Date().getFullYear());

  // Helper function to format month names
  const formatMonth = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'short' });
  };

  // Helper function to get current month's data
  const getCurrentMonthData = (data) => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return data.find(d => d.month === currentMonthKey) || {
      month: currentMonthKey,
      totalPrints: 0,
      colorPrints: 0,
      bwPrints: 0,
      revenue: 0,
      xeroxPrints: 0,
      usbPrints: 0,
      qrPrints: 0
    };
  };

  // Helper function to ensure all months are present
  const fillMissingMonths = (data, year) => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthNum = String(i + 1).padStart(2, '0');
      return `${year}-${monthNum}`;
    });

    const filledData = months.map(monthKey => {
      const existingData = data.find(d => d.month === monthKey) || {
        month: monthKey,
        totalPrints: 0,
        colorPrints: 0,
        bwPrints: 0,
        revenue: 0,
        xeroxPrints: 0,
        usbPrints: 0,
        qrPrints: 0
      };
      return {
        ...existingData,
        displayMonth: formatMonth(monthKey)
      };
    });

    return filledData;
  };

  useEffect(() => {
    const db = getDatabase();
    const completedPrintsRef = dbRef(db, 'completedPrints');

    const unsubscribe = onValue(completedPrintsRef, (snapshot) => {
      if (snapshot.exists()) {
        const prints = snapshot.val();
        // Get the year from the first print job's timestamp
        const firstPrint = Object.values(prints)[0];
        const firstDate = new Date(parseInt(firstPrint.completedAt) || parseInt(firstPrint.createdAt));
        const year = firstDate.getFullYear();
        setDataYear(year);
        
        const monthlyStats = processMonthlyData(prints, year);
        const filledMonthlyStats = fillMissingMonths(monthlyStats, year);
        setMonthlyData(filledMonthlyStats);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const processMonthlyData = (prints, year) => {
    const monthlyStats = {};

    // Process each print job
    Object.values(prints).forEach(print => {
      const timestamp = parseInt(print.completedAt) || parseInt(print.createdAt);
      const date = new Date(timestamp);
      
      // Only process data for the specified year
      if (date.getFullYear() === year) {
        const monthKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyStats[monthKey]) {
          monthlyStats[monthKey] = {
            month: monthKey,
            totalPrints: 0,
            colorPrints: 0,
            bwPrints: 0,
            revenue: 0,
            xeroxPrints: 0,
            usbPrints: 0,
            qrPrints: 0
          };
        }

        // Update statistics
        const totalPages = print.totalPages || 0;
        const copies = print.copies || 1;
        const price = print.price || 0;

        monthlyStats[monthKey].totalPrints += totalPages * copies;
        monthlyStats[monthKey].revenue += price * copies;
        
        if (print.isColor) {
          monthlyStats[monthKey].colorPrints += totalPages * copies;
        } else {
          monthlyStats[monthKey].bwPrints += totalPages * copies;
        }

        // Count by source
        switch (print.source) {
          case 'xerox':
            monthlyStats[monthKey].xeroxPrints += totalPages * copies;
            break;
          case 'usb':
            monthlyStats[monthKey].usbPrints += totalPages * copies;
            break;
          case 'qr':
            monthlyStats[monthKey].qrPrints += totalPages * copies;
            break;
          default:
            monthlyStats[monthKey].xeroxPrints += totalPages * copies;
        }
      }
    });

    return Object.values(monthlyStats);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-48">
      <span className="loading loading-spinner loading-lg"></span>
    </div>;
  }

  // Get the current month's data for the overview cards
  const currentMonthData = monthlyData.find(d => d.month === `${dataYear}-04`) || {
    totalPrints: 0,
    colorPrints: 0,
    bwPrints: 0,
    revenue: 0,
    xeroxPrints: 0,
    usbPrints: 0,
    qrPrints: 0
  };

  // Prepare data for Chart.js
  const chartData = {
    labels: monthlyData.map(d => d.displayMonth),
    datasets: [
      {
        label: 'Xerox',
        data: monthlyData.map(d => d.xeroxPrints),
        backgroundColor: '#3b82f6',
      },
      {
        label: 'USB',
        data: monthlyData.map(d => d.usbPrints),
        backgroundColor: '#10b981',
      },
      {
        label: 'QR',
        data: monthlyData.map(d => d.qrPrints),
        backgroundColor: '#f59e0b',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        grid: {
          display: true,
          drawBorder: false,
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-4">
        Monthly Statistics ({dataYear})
      </h2>
      
      {/* Monthly Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat bg-base-100 shadow rounded-lg">
          <div className="stat-title">Total Revenue</div>
          <div className="stat-value text-primary">₱{currentMonthData.revenue.toFixed(2)}</div>
          <div className="stat-desc">Current Month</div>
        </div>
        <div className="stat bg-base-100 shadow rounded-lg">
          <div className="stat-title">Total Prints</div>
          <div className="stat-value">{currentMonthData.totalPrints}</div>
          <div className="stat-desc">{currentMonthData.colorPrints} color, {currentMonthData.bwPrints} B&W</div>
        </div>
        <div className="stat bg-base-100 shadow rounded-lg">
          <div className="stat-title">Print Sources</div>
          <div className="stat-value">
            {currentMonthData.xeroxPrints + currentMonthData.usbPrints + currentMonthData.qrPrints}
          </div>
          <div className="stat-desc">
            Xerox: {currentMonthData.xeroxPrints}, 
            USB: {currentMonthData.usbPrints}, 
            QR: {currentMonthData.qrPrints}
          </div>
        </div>
      </div>

      {/* Combined Monthly Chart */}
      <div className="bg-base-100 shadow-xl rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Monthly Print Distribution</h3>
        <div className="h-[400px]">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

export default MonthlyStats; 