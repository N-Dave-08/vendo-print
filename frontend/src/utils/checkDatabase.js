import { getDatabase, ref, get } from 'firebase/database';

export const checkDatabaseStructure = async () => {
  const db = getDatabase();
  
  try {
    // Check files collection
    const filesSnapshot = await get(ref(db, 'files'));
    console.log('Files Collection:', filesSnapshot.exists() ? filesSnapshot.val() : 'Does not exist');

    // Check paperCount
    const paperCountSnapshot = await get(ref(db, 'paperCount'));
    console.log('Paper Count:', paperCountSnapshot.exists() ? paperCountSnapshot.val() : 'Does not exist');
    
    // Check pricing
    const pricingSnapshot = await get(ref(db, 'pricing'));
    console.log('Pricing:', pricingSnapshot.exists() ? pricingSnapshot.val() : 'Does not exist');

  } catch (error) {
    console.error('Error checking database structure:', error);
  }
}; 