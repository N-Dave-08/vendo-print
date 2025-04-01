# VendoPrint

VendoPrint is a digital printing kiosk application that allows users to upload and print documents from various sources including USB drives and QR codes.

## Setup Guide

### Prerequisites

- Node.js (v14 or newer)
- npm
- LibreOffice (for DOCX to PDF conversion with preserved formatting)

### LibreOffice Installation

For proper DOCX to PDF conversion with preserved formatting, you need to install LibreOffice:

#### Windows

1. Download LibreOffice from the [official website](https://www.libreoffice.org/download/download/)
2. Run the installer and select "Typical" installation
3. After installation, add LibreOffice to your system PATH:
   - Right-click on "This PC" or "My Computer" and select "Properties"
   - Click on "Advanced system settings"
   - Click the "Environment Variables" button
   - In the "System variables" section, find the "Path" variable and click "Edit"
   - Click "New" and add the path to the LibreOffice program directory:
     - Typically: `C:\Program Files\LibreOffice\program`
   - Click "OK" on all dialogs to save changes
4. Verify installation by opening Command Prompt and typing:
   ```
   where soffice
   ```
   You should see the path to the LibreOffice executable

#### macOS

1. Download LibreOffice from the [official website](https://www.libreoffice.org/download/download/)
2. Open the downloaded .dmg file and drag LibreOffice to the Applications folder
3. Open Terminal and create a symlink to make LibreOffice accessible from the command line:
   ```
   sudo ln -s /Applications/LibreOffice.app/Contents/MacOS/soffice /usr/local/bin/soffice
   ```
4. Verify installation by opening Terminal and typing:
   ```
   which soffice
   ```
   You should see `/usr/local/bin/soffice`

#### Linux

1. Install LibreOffice using your package manager:
   - Ubuntu/Debian: `sudo apt-get install libreoffice`
   - Fedora: `sudo dnf install libreoffice`
   - Arch Linux: `sudo pacman -S libreoffice-still`
2. Verify installation by opening Terminal and typing:
   ```
   which soffice
   ```
   You should see the path to the LibreOffice executable

### Setting Up the Project

1. Clone the repository
2. Install dependencies:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. Start the backend server:

```bash
cd backend
node server.js
```

4. Start the frontend development server:

```bash
cd frontend
npm run dev
```

5. Access the application at `http://localhost:5173`

## Features

- Upload files from USB drives
- Scan and upload documents via QR code
- DOCX to PDF conversion with preserved formatting
- Print preview with page range selection
- Multiple printer support

## Troubleshooting

### DOCX Conversion Issues

If you experience issues with DOCX to PDF conversion:

1. Make sure LibreOffice is properly installed
2. Verify that `soffice` command is available in your PATH
   - Test by running `where soffice` (Windows) or `which soffice` (Mac/Linux) in your terminal
3. If using Windows, try running LibreOffice as administrator once to ensure it has proper permissions
4. Check the backend server logs for any specific errors related to LibreOffice
5. If LibreOffice is not available, the system will fall back to a simplified text-based conversion, but formatting will be limited

### Backend Server Connection Problems

If the frontend cannot connect to the backend:

1. Make sure the backend server is running on port 5000
2. Check that your firewall is not blocking connections to port 5000
3. Verify that the backend server logs show successful startup
4. If using a different port, update the frontend code accordingly

### File Upload Problems

If file uploads fail:

1. Check that your Firebase configuration is correct
2. Ensure you have proper storage permissions in Firebase
3. Verify network connectivity

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.
