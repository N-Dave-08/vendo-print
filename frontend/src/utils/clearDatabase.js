import { getDatabase, ref as dbRef, remove, get } from 'firebase/database';
import { getStorage, ref as storageRef, deleteObject } from 'firebase/storage';

export const clearFilesData = async () => {
  try {
    const db = getDatabase();
    const storage = getStorage();
    const filesRef = dbRef(db, 'files');

    // First get all files to know what to delete from storage
    const snapshot = await get(filesRef);
    if (snapshot.exists()) {
      const files = snapshot.val();
      
      // Delete each file from storage first
      const deletePromises = Object.values(files).map(async (file) => {
        if (file.fileUrl) {
          try {
            // Extract the path from the full URL
            const urlParts = file.fileUrl.split('/o/')[1];
            if (urlParts) {
              const path = decodeURIComponent(urlParts.split('?')[0]);
              const fileRef = storageRef(storage, path);
              await deleteObject(fileRef).catch(error => {
                // Ignore not found errors as the file might have been already deleted
                if (error.code !== 'storage/object-not-found') {
                  console.error('Error deleting file from storage:', error);
                }
              });
            }
          } catch (error) {
            console.error('Error processing file URL:', error);
          }
        }
      });

      // Wait for all storage deletions to complete
      await Promise.all(deletePromises);
    }

    // Then delete the database entries
    await remove(filesRef);
    console.log('Successfully cleared all files data');
    return true;
  } catch (error) {
    console.error('Error clearing files data:', error);
    return false;
  }
}; 