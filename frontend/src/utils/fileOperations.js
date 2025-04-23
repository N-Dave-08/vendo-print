import { getDatabase, ref as dbRef, remove } from 'firebase/database';
import { getStorage, ref as storageRef, deleteObject } from 'firebase/storage';
import { storage, realtimeDb } from '../../firebase/firebase_config';

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

/**
 * Delete a file from both Firebase storage and database
 * @param {string} fileId - The ID of the file in the database
 * @param {string} fileUrl - The URL of the file in storage
 * @returns {Promise<void>}
 */
export const deleteUploadedFile = async (fileId, fileUrl) => {
  try {
    // Remove from database first
    await remove(dbRef(realtimeDb, `uploadedFiles/${fileId}`));

    // Then try to remove from storage if URL exists
    if (fileUrl) {
      try {
        const fileUrlObj = new URL(fileUrl);
        const pathFromUrl = decodeURIComponent(fileUrlObj.pathname.split('/o/')[1].split('?')[0]);
        const fileRef = storageRef(storage, pathFromUrl);
        await deleteObject(fileRef).catch(error => {
          // Ignore not found errors as the file might have been already deleted
          if (error.code !== 'storage/object-not-found') {
            console.error('Error deleting from storage:', error);
          }
        });
      } catch (storageError) {
        console.error('Error with storage deletion:', storageError);
        // Continue since we already deleted from database
      }
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
}; 