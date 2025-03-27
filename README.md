# VendoPrint

A comprehensive printing solution that supports multiple printing methods including USB, Bluetooth, QR code, and Xerox scanning. Built with React and Node.js.

## Features

- **Multiple Printing Methods**
  - USB Printing
  - Bluetooth Printing
  - QR Code Printing
  - Xerox Scanning & Printing
- **Smart Pricing System**
  - Automatic price calculation based on:
    - Page size
    - Color/Black & White
    - Number of copies
    - Page orientation
- **Admin Dashboard**
  - Set pricing rules
  - Monitor print jobs
  - Manage system settings
- **Coin Management System**
  - Real-time coin balance tracking
  - Automatic coin deduction
  - Top-up functionality

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Windows OS (for printer functionality)
- Printer with USB/Bluetooth connectivity
- Scanner (for Xerox functionality)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/N-Dave-08/vendo-print.git
cd vendo-print
```

2. Install dependencies:

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
```

3. Set up environment variables:
   - Create `.env` file in the root directory
   - Create `.env` file in the backend directory
   - Add necessary environment variables (see `.env.example`)

## Running the Application

1. Start the backend server:

```bash
# From the root directory
npm start
```

2. Start the frontend development server:

```bash
# From the frontend directory
npm run dev
```

3. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

## Project Structure

```
vendo-print/
├── backend/
│   ├── controller/
│   ├── printer/
│   ├── routes/
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── Pages/
│   │   └── utils/
│   └── package.json
└── package.json
```

## API Endpoints

- `/api/printers` - Get available printers
- `/api/xerox/preview` - Get scanned document preview
- `/api/xerox/check-scanner` - Check scanner availability
- `/api/xerox/print` - Print scanned document
- `/api/usb/print` - Print from USB
- `/api/bluetooth/print` - Print via Bluetooth
- `/api/qr/print` - Print from QR code

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Managing Changes Between Laptops

### Pushing Changes from Source Laptop

1. Commit your changes:

```bash
git add .
git commit -m "Your commit message"
```

2. Push to the remote repository:

```bash
git push origin <branch-name>
```

### Fetching Changes on Target Laptop

1. Fetch and pull changes:

```bash
git fetch origin
git pull origin <branch-name>
```

### Managing Work in Progress

If you have ongoing changes on the target laptop:

1. Stash your current changes:

```bash
# Save changes with a description
git stash save "your message here"

# Or stash all changes including untracked files
git stash -u
```

2. View stashed changes:

```bash
git stash list
```

3. Pull the new changes:

```bash
git pull origin <branch-name>
```

4. Reapply your stashed changes:

```bash
# Apply most recent stash and keep it in the list
git stash apply

# Or apply and remove the stash
git stash pop

# Apply specific stash
git stash apply stash@{n}
```

5. Resolve any conflicts if they occur

### Additional Stash Commands

- Show stash contents: `git stash show`
- Remove specific stash: `git stash drop stash@{n}`
- Clear all stashes: `git stash clear`

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.
