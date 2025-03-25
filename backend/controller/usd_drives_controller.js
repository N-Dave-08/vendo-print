// import drivelist from "drivelist";
// import fs from "fs";
// import path from "path";

// const UsbList = async (req, res) => {
//   try {
//     // Get all connected drives
//     const drives = await drivelist.list();

//     // Find a removable USB drive
//     const usbDrive = drives.find(
//       (drive) => drive.isRemovable && drive.mountpoints.length > 0
//     );

//     if (!usbDrive) {
//       return res.status(404).json({ error: "No USB drive detected" });
//     }

//     // Get the first mountpoint (path to the drive)
//     const usbPath = usbDrive.mountpoints[0].path;

//     // Read files in the USB directory
//     fs.readdir(usbPath, async (err, files) => {
//       if (err) {
//         return res.status(500).json({ error: "Failed to read USB drive" });
//       }

//       // Filter files for specific extensions
//       const allowedExtensions = [".pdf", ".docx", ".jpg", ".png"];
//       const filteredFiles = files.filter((file) =>
//         allowedExtensions.includes(path.extname(file).toLowerCase())
//       );

//       // Map filtered files to include their Base64 content
//       const filesWithContent = await Promise.all(
//         filteredFiles.map(async (file) => {
//           try {
//             const filePath = path.join(usbPath, file);
//             const fileContent = fs.readFileSync(filePath, { encoding: "base64" });
//             return { filename: file, fileContent }; // Return filename and Base64 content
//           } catch (readError) {
//             console.error(`Error reading file: ${file}`, readError.message);
//             return null; // Skip files that cannot be read
//           }
//         })
//       );

//       // Filter out null values (in case of errors reading some files)
//       const validFiles = filesWithContent.filter((file) => file !== null);

//       res.json(validFiles);  
//     });
//   } catch (error) {
//     res.status(500).json({ error: "Error detecting USB drive" });
//   }
// };

// export default UsbList;
