import { getDatabase, ref, set } from "firebase/database";
// import { uploadToCloudinary } from "../cloudinarry/cloudinarry_config.js";
import { realtimeDb,storage } from "../firebase/firebase-config.js";

  // Add data to Realtime Database
  export const addData = async (req, res) => {
    try {
        console.log("Incoming request body:", req.body);
        const { filename, fileContent } = req.body;

        if (!filename || !fileContent) {
            console.error("Missing filename or file content:", { filename, fileContent });
            return res.status(400).json({ error: "Filename and file content are required!" });
        }

        const timestamp = Date.now();
        const newRef = ref(realtimeDb, `files/${timestamp}`);

        await set(newRef, { filename, fileContent });

        console.log("File uploaded successfully!");
        res.status(200).json({ success: true, message: "File uploaded successfully!" });
    } catch (error) {
        console.error("Error in addData function:", error.message);
        res.status(500).json({ error: error.message });
    }
};



  // Get data from Realtimes Database
  export const getData = async (req, res) => {
    try {
        const dbRef = ref(realtimeDb, "files"); 
        const snapshot = await get(dbRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            res.status(200).json(data);
        } else {
            res.status(404).json({ message: "No files found!" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



// Upload file to Cloudinary// Upload file to Cloudinary
// export const uploadFile = async (req, res) => {
//   try {
//     console.log("Incoming request to upload file...");

//     if (!req.file) {
//       console.error("No file uploaded!");
//       return res.status(400).json({ error: "No file uploaded!" });
//     }

//     console.log("File received:", {
//       originalName: req.file.originalname,
//       mimeType: req.file.mimetype,
//       size: req.file.size,
//       path: req.file.path,
//     });

//     // Upload file to Cloudinary
//     const cloudinaryResult = await uploadToCloudinary(req.file.path);
    
//     // 🔍 Fix: Properly log the Cloudinary response
//     console.log("Cloudinary upload result:", JSON.stringify(cloudinaryResult, null, 2));

//     // Save Cloudinary file URL in Firebase Realtime Database
//     const timestamp = Date.now();
//     const fileMetadataRef = ref(realtimeDb, `files/${timestamp}`);

//     await set(fileMetadataRef, { filename: req.file.originalname, url: cloudinaryResult.url });

//     console.log("File metadata saved to Firebase:", {
//       filename: req.file.originalname,
//       cloudinaryUrl: cloudinaryResult.url,
//     });

//     // 🔍 Fix: Return JSON response properly
//     return res.status(200).json({
//       success: true,
//       url: cloudinaryResult.url,
//       message: "File uploaded successfully!",
//     });

//   } catch (error) {
//     console.error("Upload error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// };

export const fetchFilesFromRealtimeDatabase = () => {
  const filesRef = dbRef(realtimeDb, "files");
  onValue(filesRef, (snapshot) => {
    if (snapshot.exists()) {
      const filesData = snapshot.val();
      const filesArray = Object.values(filesData);
      console.log("Fetched files:", filesArray);
    } else {
      console.log("No files found.");
    }
  });
};
