import React, { useState } from "react";
import MiniNav from "../components/MiniNav";
import { useAuth } from "../contexts/AuthContext";
import { CreditCard, Wallet, Database, BarChart4 } from "lucide-react";

function TopupOption({ title, description, amount, icon: Icon, selected, onClick }) {
  return (
    <div 
      className={`border rounded-lg p-6 cursor-pointer transition-all ${
        selected 
          ? "border-primary bg-primary-50 ring-2 ring-primary" 
          : "border-gray-200 hover:border-primary"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center">
        <div className={`p-3 rounded-full bg-primary text-white mr-4`}>
          <Icon size={24} />
        </div>
        <div>
          <h3 className="text-lg font-medium">{title}</h3>
          <p className="text-gray-500 text-sm">{description}</p>
        </div>
        <div className="ml-auto">
          <span className="text-xl font-bold">{amount} coins</span>
        </div>
      </div>
    </div>
  );
}

function PaymentMethodOption({ id, title, icon: Icon, selected, onClick }) {
  return (
    <div 
      className={`border rounded-lg p-4 cursor-pointer transition-all ${
        selected 
          ? "border-primary bg-primary-50 ring-2 ring-primary" 
          : "border-gray-200 hover:border-primary"
      }`}
      onClick={() => onClick(id)}
    >
      <div className="flex items-center">
        <div className={`p-2 rounded-full ${selected ? "bg-primary" : "bg-gray-100"} mr-3`}>
          <Icon size={20} className={selected ? "text-white" : "text-gray-600"} />
        </div>
        <div>
          <h3 className="font-medium">{title}</h3>
        </div>
      </div>
    </div>
  );
}

function PaymentMethod({ method, selectedAmount, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [error, setError] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    // Simulate payment processing
    try {
      setTimeout(() => {
        setLoading(false);
        onComplete(selectedAmount);
      }, 1500);
    } catch (error) {
      setError("Payment failed. Please try again.");
      setLoading(false);
    }
  };

  if (method === "cash") {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-medium mb-4">Cash Payment</h3>
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md mb-6">
          <p>Please insert {selectedAmount / 10} pesos into the machine to receive {selectedAmount} coins.</p>
        </div>
        <button
          onClick={() => onComplete(selectedAmount)}
          className="w-full py-3 bg-primary text-white rounded-md hover:bg-primary-dark"
        >
          I've Inserted Cash
        </button>
      </div>
    );
  }
  
  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium mb-4">Card Payment</h3>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
          <input
            type="text"
            placeholder="1234 5678 9012 3456"
            className="w-full p-2 border border-gray-300 rounded-md"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            required
          />
        </div>
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
            <input
              type="text"
              placeholder="MM/YY"
              className="w-full p-2 border border-gray-300 rounded-md"
              value={cardExpiry}
              onChange={(e) => setCardExpiry(e.target.value)}
              required
            />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
            <input
              type="text"
              placeholder="123"
              className="w-full p-2 border border-gray-300 rounded-md"
              value={cardCvc}
              onChange={(e) => setCardCvc(e.target.value)}
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
        >
          {loading ? "Processing..." : `Pay ${selectedAmount / 10} pesos`}
        </button>
      </form>
    </div>
  );
}

function Topup() {
  const { user } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState(50);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  
  const topupOptions = [
    { 
      id: 1, 
      title: "Basic", 
      description: "Good for a few prints",
      amount: 50, 
      icon: CreditCard 
    },
    { 
      id: 2, 
      title: "Standard", 
      description: "Most popular option",
      amount: 100, 
      icon: Wallet 
    },
    { 
      id: 3, 
      title: "Premium", 
      description: "For frequent printing",
      amount: 200, 
      icon: Database 
    },
    { 
      id: 4, 
      title: "Ultimate", 
      description: "Best value for money",
      amount: 500, 
      icon: BarChart4 
    }
  ];
  
  const handleTopupComplete = (amount) => {
    setSuccess(true);
    // In a real app, you would call an API to update the user's balance
    // and refresh the user data
  };
  
  if (success) {
    return (
      <div className="max-w-4xl mx-auto py-6">
        <MiniNav title="Top Up Balance" />
        
        <div className="mt-6 bg-white rounded-lg shadow-md p-10 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Top Up Successful!</h2>
          <p className="text-gray-600 mb-6">
            {selectedAmount} coins have been added to your account.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto py-6">
      <MiniNav title="Top Up Balance" />
      
      <div className="mt-6 bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Add Coins</h2>
          <div className="text-sm bg-gray-100 px-3 py-1 rounded-full">
            Current Balance: <span className="font-bold">{user?.coins || 0} coins</span>
          </div>
        </div>
        
        {step === 1 && (
          <>
            <div className="space-y-4 mb-6">
              {topupOptions.map((option) => (
                <TopupOption
                  key={option.id}
                  title={option.title}
                  description={option.description}
                  amount={option.amount}
                  icon={option.icon}
                  selected={selectedAmount === option.amount}
                  onClick={() => setSelectedAmount(option.amount)}
                />
              ))}
            </div>
            
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4">Choose Payment Method</h3>
              <div className="grid grid-cols-2 gap-4">
                <PaymentMethodOption
                  id="cash"
                  title="Cash"
                  icon={Wallet}
                  selected={paymentMethod === "cash"}
                  onClick={setPaymentMethod}
                />
                <PaymentMethodOption
                  id="card"
                  title="Credit Card"
                  icon={CreditCard}
                  selected={paymentMethod === "card"}
                  onClick={setPaymentMethod}
                />
              </div>
            </div>
            
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
              >
                Continue
              </button>
            </div>
          </>
        )}
        
        {step === 2 && (
          <>
            <div className="bg-gray-50 p-4 rounded-md mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Selected Package</p>
                  <p className="font-medium">{topupOptions.find(o => o.amount === selectedAmount)?.title || "Custom"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-medium">{selectedAmount} coins</p>
                </div>
              </div>
            </div>
            
            <PaymentMethod
              method={paymentMethod}
              selectedAmount={selectedAmount}
              onComplete={handleTopupComplete}
            />
            
            <div className="mt-4">
              <button
                onClick={() => setStep(1)}
                className="text-primary hover:underline text-sm"
              >
                ← Back to options
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Topup; 