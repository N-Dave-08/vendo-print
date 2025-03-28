// Test script to debug printer capabilities issue
import { getPrinterCapabilities } from './backend/printer/printer_controller.js';

const printerName = 'EPSON L3210 Series';

async function testPrinterCapabilities() {
    try {
        console.log(`Testing printer capabilities for: ${printerName}`);
        const capabilities = await getPrinterCapabilities(printerName);
        console.log('Success! Capabilities:', JSON.stringify(capabilities, null, 2));
    } catch (error) {
        console.error('Error getting printer capabilities:', error);
    }
}

testPrinterCapabilities(); 