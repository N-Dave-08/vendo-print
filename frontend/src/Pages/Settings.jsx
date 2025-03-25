import React, { useState } from "react";
import MiniNav from "../components/MiniNav";
import { useAuth } from "../contexts/AuthContext";
import { User, Bell, Shield, Printer, LogOut } from "lucide-react";

function SettingsSection({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Settings() {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState({
    emailReceipts: true,
    printNotifications: true,
    lowBalance: true,
    marketing: false
  });
  
  const [defaultPrinter, setDefaultPrinter] = useState("EPSON L120 Series");
  const [defaultColor, setDefaultColor] = useState("bw");
  
  const handleNotificationChange = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  const handleLogout = () => {
    logout();
    // Will be redirected by the auth context
  };
  
  return (
    <div className="max-w-4xl mx-auto py-6">
      <MiniNav title="Settings" />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-primary-50 rounded-full flex items-center justify-center mb-2">
                <User size={40} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold">{user?.name || "User"}</h2>
              <p className="text-gray-500 text-sm">{user?.email || "user@example.com"}</p>
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm text-gray-500">Account Balance</p>
              <p className="text-xl font-bold">{user?.coins || 0} coins</p>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
        
        <div className="md:col-span-2 space-y-6">
          <SettingsSection title="Account Settings">
            <div className="p-5 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Email Address</h3>
                  <p className="text-sm text-gray-500">{user?.email || "user@example.com"}</p>
                </div>
                <button className="text-primary hover:underline text-sm">
                  Change
                </button>
              </div>
            </div>
            
            <div className="p-5">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Password</h3>
                  <p className="text-sm text-gray-500">Last changed 3 months ago</p>
                </div>
                <button className="text-primary hover:underline text-sm">
                  Change
                </button>
              </div>
            </div>
          </SettingsSection>
          
          <SettingsSection title="Notifications">
            <div className="divide-y">
              <div className="p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Email Receipts</h3>
                  <p className="text-sm text-gray-500">Receive a receipt via email after each print job</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={notifications.emailReceipts}
                    onChange={() => handleNotificationChange("emailReceipts")}
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary"></div>
                </label>
              </div>
              
              <div className="p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Print Notifications</h3>
                  <p className="text-sm text-gray-500">Receive notifications about print job status</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={notifications.printNotifications}
                    onChange={() => handleNotificationChange("printNotifications")}
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary"></div>
                </label>
              </div>
              
              <div className="p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Low Balance Alerts</h3>
                  <p className="text-sm text-gray-500">Get notified when your balance is low</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={notifications.lowBalance}
                    onChange={() => handleNotificationChange("lowBalance")}
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary"></div>
                </label>
              </div>
              
              <div className="p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Marketing Communications</h3>
                  <p className="text-sm text-gray-500">Receive updates and promotions</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={notifications.marketing}
                    onChange={() => handleNotificationChange("marketing")}
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </SettingsSection>
          
          <SettingsSection title="Print Preferences">
            <div className="p-5 border-b">
              <h3 className="font-medium mb-2">Default Printer</h3>
              <select
                className="w-full p-2 border border-gray-300 rounded-md"
                value={defaultPrinter}
                onChange={(e) => setDefaultPrinter(e.target.value)}
              >
                <option value="EPSON L120 Series">EPSON L120 Series</option>
                <option value="HP DeskJet 3630">HP DeskJet 3630</option>
                <option value="Canon PIXMA MG3620">Canon PIXMA MG3620</option>
              </select>
            </div>
            
            <div className="p-5">
              <h3 className="font-medium mb-2">Default Color Setting</h3>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="colorSetting"
                    value="color"
                    checked={defaultColor === "color"}
                    onChange={() => setDefaultColor("color")}
                    className="mr-2"
                  />
                  Color
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="colorSetting"
                    value="bw"
                    checked={defaultColor === "bw"}
                    onChange={() => setDefaultColor("bw")}
                    className="mr-2"
                  />
                  Black & White
                </label>
              </div>
            </div>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}

export default Settings; 