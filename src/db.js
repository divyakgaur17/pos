import Dexie from 'dexie';

export const db = new Dexie('RestaurantPOS');
db.version(3).stores({
    diningTables: 'id',
    history: '++id, date, tableId',
    menuItems: '++id, name, category',
    settings: 'key' // For storing app settings like lastSync, cloudEnabled, etc.
});
