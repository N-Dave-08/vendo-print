import React, { useState } from "react";
import MiniNav from "../components/MiniNav";
import { Mail, Phone, MessageSquare, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";

function FAQItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border-b last:border-b-0">
      <button
        className="w-full py-4 px-6 flex justify-between items-center focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium text-left">{question}</span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      
      {isOpen && (
        <div className="px-6 pb-4">
          <p className="text-gray-600">{answer}</p>
        </div>
      )}
    </div>
  );
}

function Help() {
  const faqs = [
    {
      question: "How do I upload and print a document?",
      answer: "You can upload documents through the Print page. Supported file formats include PDF, Word documents, Excel spreadsheets, PowerPoint presentations, and common image formats. After uploading, you'll be able to select print options and preview your document before printing."
    },
    {
      question: "How does the coin system work?",
      answer: "VendoPrint uses a virtual coin system. Each print job costs a certain number of coins depending on the number of pages, whether it's color or black and white, and other factors. You can add coins to your account through the Top Up page."
    },
    {
      question: "Can I print from my USB drive?",
      answer: "Yes! You can print directly from a USB drive by accessing the USB Print page. Insert your USB drive into the designated slot on the physical kiosk, and your files will appear on screen for you to select and print."
    },
    {
      question: "What if my print job fails?",
      answer: "If your print job fails for any reason, your coins will not be deducted. You'll receive an error message explaining what went wrong. Common issues include paper jams, empty paper trays, or low toner levels. If the problem persists, please contact support."
    },
    {
      question: "How long are my uploaded files stored?",
      answer: "For privacy and security reasons, your uploaded files are automatically deleted after 24 hours. If you need to print the same document again, you'll need to re-upload it."
    },
    {
      question: "Can I cancel a print job?",
      answer: "You can cancel a print job before finalizing it in the print preview. However, once you've confirmed the print job and coins have been deducted, it cannot be cancelled as the job is sent immediately to the printer."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-6">
      <MiniNav title="Help & Support" />
      
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Contact Support</h2>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="p-2 bg-primary-50 rounded-full mr-3">
                  <Mail className="text-primary" size={18} />
                </div>
                <div>
                  <h3 className="font-medium">Email</h3>
                  <p className="text-sm text-gray-600">support@vendoprint.com</p>
                  <p className="text-xs text-gray-500 mt-1">Response within 24 hours</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="p-2 bg-primary-50 rounded-full mr-3">
                  <Phone className="text-primary" size={18} />
                </div>
                <div>
                  <h3 className="font-medium">Phone</h3>
                  <p className="text-sm text-gray-600">+1 (123) 456-7890</p>
                  <p className="text-xs text-gray-500 mt-1">Mon-Fri, 9am-5pm</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="p-2 bg-primary-50 rounded-full mr-3">
                  <MessageSquare className="text-primary" size={18} />
                </div>
                <div>
                  <h3 className="font-medium">Live Chat</h3>
                  <p className="text-sm text-gray-600">Available in-app</p>
                  <p className="text-xs text-gray-500 mt-1">24/7 support</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-primary-50 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <HelpCircle className="text-primary mr-2" size={20} />
              <h2 className="text-lg font-semibold">Need more help?</h2>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              Check out our comprehensive user guide for detailed instructions on using VendoPrint.
            </p>
            <button className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary-dark">
              Download User Guide
            </button>
          </div>
        </div>
        
        <div className="md:col-span-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
            </div>
            
            <div className="divide-y">
              {faqs.map((faq, index) => (
                <FAQItem
                  key={index}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
            
            <div className="p-6 bg-gray-50">
              <p className="text-sm text-gray-600">
                Can't find what you're looking for? <a href="#" className="text-primary hover:underline">Submit a support ticket</a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Help; 