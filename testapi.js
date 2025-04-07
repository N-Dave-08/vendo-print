import fetch from 'node-fetch';

async function testUsbDrivesApi() {
  try {
    console.log('Testing USB drives API...');
    const response = await fetch('http://localhost:5000/api/usb-drives');
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('USB drives data:', JSON.stringify(data, null, 2));
    } else {
      console.error('Error response:', response.statusText);
    }
  } catch (error) {
    console.error('Error testing API:', error.message);
  }
}

testUsbDrivesApi(); 