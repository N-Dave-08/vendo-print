// Add DOCX to PDF conversion endpoint
router.post('/convert-docx', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get the uploaded file path
    const inputFilePath = req.file.path;
    console.log('Converting file:', inputFilePath);

    try {
      // Ensure the file exists and is readable
      await fs.promises.access(inputFilePath, fs.constants.R_OK);

      // Convert DOCX to PDF with progress tracking
      const outputFilePath = await convertDocxToPdf(inputFilePath, (progress, message) => {
        console.log(`Conversion progress: ${progress}% - ${message}`);
      });

      // Verify the output file exists and is not empty
      const stats = await fs.promises.stat(outputFilePath);
      if (stats.size === 0) {
        throw new Error('Conversion produced an empty file');
      }

      // Send the converted PDF file
      res.sendFile(outputFilePath, {}, async (err) => {
        if (err) {
          console.error('Error sending file:', err);
          // Only clean up files if sending failed
          await cleanupTempFiles([inputFilePath, outputFilePath]);
          return;
        }
        // Clean up temporary files after successful send
        setTimeout(async () => {
          await cleanupTempFiles([inputFilePath, outputFilePath]);
        }, 1000); // Give a small delay to ensure file is sent
      });
    } catch (error) {
      // Clean up the input file if conversion fails
      await cleanupTempFiles(inputFilePath);
      throw error;
    }
  } catch (error) {
    console.error('Error in DOCX to PDF conversion:', error);
    res.status(500).json({ 
      message: `Conversion failed: ${error.message}`,
      details: error.stack
    });
  }
}); 