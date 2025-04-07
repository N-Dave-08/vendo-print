import React, { useState } from "react";
import MiniNav from "../components/MiniNav";
import { useAuth } from "../contexts/AuthContext";
import { User, Bell, Shield, Printer, LogOut } from "lucide-react";

function SettingsSection({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="card bg-base-100 shadow-sm overflow-hidden">
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
    <div className="container mx-auto py-6 px-4">
      <MiniNav title="Settings" />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="md:col-span-1">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body items-center text-center">
              <div className="avatar placeholder">
                <div className="bg-primary/10 text-primary rounded-full w-24">
                  <User size={32} />
                </div>
              </div>
              <h2 className="card-title mt-2">{user?.name || "User"}</h2>
              <p className="text-base-content/60 text-sm">{user?.email || "user@example.com"}</p>
              
              <div className="divider my-2"></div>
              
              <div className="w-full">
                <p className="text-sm text-base-content/60">Account Balance</p>
                <p className="text-2xl font-bold text-primary">{user?.coins || 0} coins</p>
              </div>
              
              <button
                onClick={handleLogout}
                className="btn btn-error btn-outline w-full gap-2 mt-4"
              >
                <LogOut size={16} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-2 space-y-6">
          <SettingsSection title="Account Settings">
            <div className="p-4 border-b border-base-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Email Address</h3>
                  <p className="text-sm text-base-content/60">{user?.email || "user@example.com"}</p>
                </div>
                <button className="btn btn-sm btn-ghost text-primary">
                  Change
                </button>
              </div>
            </div>
            
            <div className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Password</h3>
                  <p className="text-sm text-base-content/60">Last changed 3 months ago</p>
                </div>
                <button className="btn btn-sm btn-ghost text-primary">
                  Change
                </button>
              </div>
            </div>
          </SettingsSection>
          
          <SettingsSection title="Notifications">
            <div className="divide-y divide-base-200">
              <div className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Email Receipts</h3>
                  <p className="text-sm text-base-content/60">Receive a receipt via email after each print job</p>
                </div>
                <label className="swap">
                  <input 
                    type="checkbox" 
                    checked={notifications.emailReceipts}
                    onChange={() => handleNotificationChange("emailReceipts")}
                  />
                  <div className="swap-off bg-base-300 border-2 border-base-300 w-14 h-7 rounded-full"></div>
                  <div className="swap-on bg-primary border-2 border-primary w-14 h-7 rounded-full"></div>
                </label>
              </div>
              
              <div className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Print Notifications</h3>
                  <p className="text-sm text-base-content/60">Receive notifications about print job status</p>
                </div>
                <label className="swap">
                  <input 
                    type="checkbox" 
                    checked={notifications.printNotifications}
                    onChange={() => handleNotificationChange("printNotifications")}
                  />
                  <div className="swap-off bg-base-300 border-2 border-base-300 w-14 h-7 rounded-full"></div>
                  <div className="swap-on bg-primary border-2 border-primary w-14 h-7 rounded-full"></div>
                </label>
              </div>
              
              <div className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Low Balance Alerts</h3>
                  <p className="text-sm text-base-content/60">Get notified when your balance is low</p>
                </div>
                <label className="swap">
                  <input 
                    type="checkbox" 
                    checked={notifications.lowBalance}
                    onChange={() => handleNotificationChange("lowBalance")}
                  />
                  <div className="swap-off bg-base-300 border-2 border-base-300 w-14 h-7 rounded-full"></div>
                  <div className="swap-on bg-primary border-2 border-primary w-14 h-7 rounded-full"></div>
                </label>
              </div>
              
              <div className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Marketing Communications</h3>
                  <p className="text-sm text-base-content/60">Receive updates and promotions</p>
                </div>
                <label className="swap">
                  <input 
                    type="checkbox" 
                    checked={notifications.marketing}
                    onChange={() => handleNotificationChange("marketing")}
                  />
                  <div className="swap-off bg-base-300 border-2 border-base-300 w-14 h-7 rounded-full"></div>
                  <div className="swap-on bg-primary border-2 border-primary w-14 h-7 rounded-full"></div>
                </label>
              </div>
            </div>
          </SettingsSection>
          
          <SettingsSection title="Print Preferences">
            <div className="p-4 border-b border-base-200">
              <h3 className="font-medium mb-2">Default Printer</h3>
              <select
                className="select select-bordered w-full"
                value={defaultPrinter}
                onChange={(e) => setDefaultPrinter(e.target.value)}
              >
                <option value="EPSON L120 Series">EPSON L120 Series</option>
                <option value="HP DeskJet 3630">HP DeskJet 3630</option>
                <option value="Canon PIXMA MG3620">Canon PIXMA MG3620</option>
              </select>
            </div>
            
            <div className="p-4">
              <h3 className="font-medium mb-2">Default Color Setting</h3>
              <div className="flex gap-4">
                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="radio"
                    name="colorSetting"
                    value="color"
                    checked={defaultColor === "color"}
                    onChange={() => setDefaultColor("color")}
                    className="radio radio-primary"
                  />
                  <span className="label-text">Color</span>
                </label>
                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="radio"
                    name="colorSetting"
                    value="bw"
                    checked={defaultColor === "bw"}
                    onChange={() => setDefaultColor("bw")}
                    className="radio radio-primary"
                  />
                  <span className="label-text">Black & White</span>
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