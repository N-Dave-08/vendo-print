import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { getDatabase, ref as dbRef, get } from "firebase/database";
import M_Password from '../components/M_Password';
import SetPricing from '../components/admin/SetPricing';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Admin = () => {
  const [showModal, setShowModal] = useState(true);
  const [weeklyCoins, setWeeklyCoins] = useState([]);
  const [weeklyPrints, setWeeklyPrints] = useState([]);
  const [weekLabels, setWeekLabels] = useState([]);

  // Helper function to get week number
  const getWeekNumber = (date) => {
    const d = new Date(date);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDays = (d - startOfYear) / (24 * 60 * 60 * 1000);
    return Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
  };

  useEffect(() => {
    const fetchData = async () => {
      const db = getDatabase();

      // Fetch Coins Data
      const coinsSnapshot = await get(dbRef(db, 'files'));
      const weeklyCoinsMap = {};
      if (coinsSnapshot.exists()) {
        Object.values(coinsSnapshot.val()).forEach(entry => {
          if (entry.timestamp && entry.finalPrice) {
            const week = `Week ${getWeekNumber(entry.timestamp)}`;
            weeklyCoinsMap[week] = (weeklyCoinsMap[week] || 0) + entry.finalPrice;
          }
        });
      }

      // Fetch Print Counts
      const printsSnapshot = await get(dbRef(db, 'files'));
      const weeklyPrintsMap = {};
      if (printsSnapshot.exists()) {
        Object.values(printsSnapshot.val()).forEach(print => {
          if (print.timestamp && print.totalPages) {
            const week = `Week ${getWeekNumber(print.timestamp)}`;
            weeklyPrintsMap[week] = (weeklyPrintsMap[week] || 0) + print.totalPages;
          }
        });
      }

      // Set State
      const weeks = [
        ...new Set([
          ...Object.keys(weeklyCoinsMap),
          ...Object.keys(weeklyPrintsMap),
        ]),
      ].sort();

      setWeekLabels(weeks);
      setWeeklyCoins(weeks.map((week) => weeklyCoinsMap[week] || 0));
      setWeeklyPrints(weeks.map((week) => weeklyPrintsMap[week] || 0));
    };

    fetchData();
    // Optional: kung gusto mong mag-refresh weekly:
    const interval = setInterval(fetchData, 7 * 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Chart Data
  const lineData = {
    labels: weekLabels.length ? weekLabels : ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Weekly Coins',
        data: weeklyCoins,
        borderColor: '#31304D',
        backgroundColor: 'rgba(49, 48, 77, 0.2)',
        pointBackgroundColor: '#31304D',
        pointBorderColor: '#31304D',
      },
    ],
  };

  const barData = {
    labels: weekLabels.length ? weekLabels : ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Weekly Prints',
        data: weeklyPrints,
        backgroundColor: '#31304D',
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { borderDash: [5, 5] } },
    },
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Password Modal */}
      {showModal && <M_Password closeModal={() => setShowModal(false)} />}

      {/* Page Title */}
      <h1 className="text-4xl font-bold text-[#31304D] mb-6 text-center lg:text-left">
        Admin
      </h1>

      {/* Set Pricing Card */}
      <div>
        <SetPricing />
      </div>

      {/* Charts Section */}
      <div className="flex flex-col lg:flex-row w-full gap-6">
        {/* Weekly Coins Chart */}
        <div className="bg-white shadow-lg rounded-2xl p-6 w-full lg:w-1/2 h-auto border-4 border-[#31304D]">
          <h2 className="text-2xl font-semibold text-[#31304D] text-center mb-4">
            Weekly Coins
          </h2>
          <div className="w-full h-60">
            <Line data={lineData} options={options} />
          </div>
        </div>

        {/* Weekly Prints Chart */}
        <div className="bg-white shadow-lg rounded-2xl p-6 w-full lg:w-1/2 h-auto border-4 border-[#31304D]">
          <h2 className="text-2xl font-semibold text-[#31304D] text-center mb-4">
            Weekly Prints
          </h2>
          <div className="w-full h-60">
            <Bar data={barData} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
