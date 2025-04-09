import { getDatabase, ref as dbRef, remove } from 'firebase/database';
import { getStorage, ref as storageRef, deleteObject } from 'firebase/storage';

export const deleteFile = async (fileId, fileUrl) => {
  try {
    const db = getDatabase();
    const storage = getStorage();

    // First try to delete from storage if URL exists
    if (fileUrl) {
      try {
        // Extract the path from the full URL
        const urlParts = fileUrl.split('/o/')[1];
        if (urlParts) {
          const path = decodeURIComponent(urlParts.split('?')[0]);
          const fileRef = storageRef(storage, path);
          await deleteObject(fileRef).catch(error => {
            // Ignore not found errors as the file might have been already deleted
            if (error.code !== 'storage/object-not-found') {
              throw error;
            }
          });
        }
      } catch (error) {
        console.error('Error deleting file from storage:', error);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Then delete from database
    const fileRef = dbRef(db, `files/${fileId}`);
    await remove(fileRef);
    
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}; 