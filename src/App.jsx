import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import {
  Users,
  Coffee,
  CheckCircle,
  Plus,
  Trash2,
  UserPlus,
  X,
  ChevronLeft,
  History,
  Minus,
  ArrowLeft,
  IndianRupee
} from 'lucide-react';

// --- Configuration & Data ---

// Flattened Menu Data
const ALL_MENU_ITEMS = [
  { id: 101, name: 'Kachori', price: 20.00, category: 'Snacks' },
  { id: 102, name: 'Mirchi Bada', price: 20.00, category: 'Snacks' },
  { id: 103, name: 'Dahi Bade', price: 10.00, category: 'Snacks' },
  { id: 301, name: 'Chai', price: 10.00, category: 'Drinks' },
  { id: 401, name: 'Lays Chips', price: 10.00, category: 'Packaged' },
  { id: 402, name: 'Balaji Chips', price: 10.00, category: 'Packaged' },
];

const INITIAL_TABLES = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  customers: [] // Array of { id: timestamp, name: 'Guest 1', orders: [] }
}));

// --- Components ---

export default function RestaurantPOS() {
  // DB State - Default to undefined to distinguish "loading" from "empty"
  const tables = useLiveQuery(() => db.diningTables.toArray());
  const orderHistory = useLiveQuery(() => db.history.orderBy('id').reverse().toArray());
  const menuItems = useLiveQuery(() => db.menuItems.toArray());
  const [error, setError] = useState(null);

  // Local UI State
  const [activeTableId, setActiveTableId] = useState(null);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'order', 'history'

  // Custom Confirmation Modal State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  });

  // Menu Management State
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);

  // Initialize DB
  useEffect(() => {
    const initDb = async () => {
      try {
        const count = await db.diningTables.count();
        if (count === 0) {
          // Use bulkPut instead of bulkAdd to avoid "key already exists" errors
          await db.diningTables.bulkPut(INITIAL_TABLES);
          console.log("Initialized tables");
        }

        // Initialize menu items if empty
        const menuCount = await db.menuItems.count();
        if (menuCount === 0) {
          await db.menuItems.bulkAdd(ALL_MENU_ITEMS);
          console.log("Initialized menu items");
        }
      } catch (err) {
        console.error("Failed to initialize DB:", err);
        setError(err.message);
      }
    };
    initDb();
  }, []);

  // --- Derived State ---
  const activeTable = useMemo(() =>
    tables?.find(t => t.id === activeTableId),
    [tables, activeTableId]);

  const activeCustomer = activeTable?.customers[activeCustomerIndex];

  // --- Helper for Custom Confirm Dialog ---
  const showConfirm = (title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel') => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          onConfirm();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          resolve(false);
        },
        confirmText,
        cancelText
      });
    });
  };

  // --- Actions ---

  const handleTableClick = (tableId) => {
    setActiveTableId(tableId);
    setView('order');

    // Automatically add the first customer if table is empty
    const table = tables?.find(t => t.id === tableId);
    if (table && table.customers.length === 0) {
      addCustomer(tableId);
    } else {
      setActiveCustomerIndex(0);
    }
  };

  const addCustomer = async (tableId = activeTableId) => {
    const table = tables?.find(t => t.id === tableId);
    if (!table) return;

    const newCustomerNumber = table.customers.length + 1;
    const updatedTable = {
      ...table,
      customers: [
        ...table.customers,
        {
          id: Date.now(),
          name: `Seat ${newCustomerNumber}`,
          orders: []
        }
      ]
    };

    await db.diningTables.put(updatedTable);

    // Switch to the new customer immediately if we are in order view
    if (activeTableId === tableId) {
      setActiveCustomerIndex(table.customers.length);
    }
  };

  // Adds item or increments quantity (Logic for the Plus button on Menu Card)
  const addItemToOrder = async (item, e) => {
    if (e) e.stopPropagation();
    if (!activeTable || !activeCustomer) return;

    const newCustomers = [...activeTable.customers];
    const customer = newCustomers[activeCustomerIndex];

    const existingItemIndex = customer.orders.findIndex(o => o.id === item.id);

    if (existingItemIndex >= 0) {
      const updatedOrders = [...customer.orders];
      updatedOrders[existingItemIndex] = {
        ...updatedOrders[existingItemIndex],
        qty: updatedOrders[existingItemIndex].qty + 1
      };
      newCustomers[activeCustomerIndex] = { ...customer, orders: updatedOrders };
    } else {
      newCustomers[activeCustomerIndex] = {
        ...customer,
        orders: [...customer.orders, { ...item, qty: 1 }]
      };
    }

    await db.diningTables.put({ ...activeTable, customers: newCustomers });
  };

  // Decrements quantity (Logic for the Minus button on Menu Card)
  const decreaseItemQuantity = async (itemId, e) => {
    if (e) e.stopPropagation();
    if (!activeTable || !activeCustomer) return;

    const newCustomers = [...activeTable.customers];
    const customer = newCustomers[activeCustomerIndex];
    const existingItemIndex = customer.orders.findIndex(o => o.id === itemId);

    if (existingItemIndex >= 0) {
      const updatedOrders = [...customer.orders];
      if (updatedOrders[existingItemIndex].qty > 1) {
        updatedOrders[existingItemIndex] = {
          ...updatedOrders[existingItemIndex],
          qty: updatedOrders[existingItemIndex].qty - 1
        };
      } else {
        // If qty is 1, remove it
        updatedOrders.splice(existingItemIndex, 1);
      }
      newCustomers[activeCustomerIndex] = { ...customer, orders: updatedOrders };
      await db.diningTables.put({ ...activeTable, customers: newCustomers });
    }
  };

  // Completely removes item (Logic for Trash button on Left Panel)
  const deleteItem = async (itemIndex) => {
    const customer = activeTable.customers[activeCustomerIndex];
    const item = customer.orders[itemIndex];

    showConfirm(
      'Remove Item',
      `Remove ${item.name} from order?`,
      async () => {
        const newCustomers = [...activeTable.customers];
        const customer = newCustomers[activeCustomerIndex];
        const updatedOrders = [...customer.orders];
        updatedOrders.splice(itemIndex, 1);
        newCustomers[activeCustomerIndex] = { ...customer, orders: updatedOrders };
        await db.diningTables.put({ ...activeTable, customers: newCustomers });
      },
      'Remove',
      'Cancel'
    );
  };

  const removeCustomer = async (index, e) => {
    e.stopPropagation();
    const customerName = activeTable.customers[index].name;

    showConfirm(
      'Remove Customer',
      `Remove ${customerName} and their orders?`,
      async () => {
        const newCustomers = activeTable.customers.filter((_, i) => i !== index);
        await db.diningTables.put({ ...activeTable, customers: newCustomers });
        setActiveCustomerIndex(0);
      },
      'Remove',
      'Cancel'
    );
  };

  // --- Payment Logic ---

  const addToHistory = async (customer, tableId) => {
    const total = calculateCustomerTotal(customer);
    if (total === 0) return;

    const record = {
      date: new Date().toLocaleString(),
      tableId: tableId,
      customerName: customer.name,
      items: customer.orders,
      total: total
    };
    await db.history.add(record);
  };

  const payForSeat = async (customerIndex) => {
    const customer = activeTable.customers[customerIndex];
    if (calculateCustomerTotal(customer) === 0) return;

    showConfirm(
      'Confirm Payment',
      `Confirm payment of ₹${calculateCustomerTotal(customer).toFixed(2)} for ${customer.name}?`,
      async () => {
        await addToHistory(customer, activeTableId);
        const newCustomers = [...activeTable.customers];
        newCustomers[customerIndex] = { ...newCustomers[customerIndex], orders: [] };

        await db.diningTables.put({ ...activeTable, customers: newCustomers });
      },
      'Pay Now',
      'Cancel'
    );
  };

  const payForTable = async () => {
    const total = calculateTableTotal(activeTable);
    if (total === 0) return;

    showConfirm(
      'Confirm Payment',
      `Confirm FULL TABLE payment of ₹${total.toFixed(2)}?`,
      async () => {
        for (const cust of activeTable.customers) {
          await addToHistory(cust, activeTableId);
        }
        await db.diningTables.put({ ...activeTable, customers: [] });
        setShowPaymentModal(false);
        setActiveTableId(null);
        setView('dashboard');
      },
      'Pay Now',
      'Cancel'
    );
  };

  // --- Calculations ---

  const calculateCustomerTotal = (customer) => {
    return customer.orders.reduce((sum, item) => sum + (item.price * item.qty), 0);
  };

  const calculateTableTotal = (table) => {
    if (!table) return 0;
    return table.customers.reduce((sum, cust) => sum + calculateCustomerTotal(cust), 0);
  };

  // --- Helper to get Qty for Menu Card ---
  const getItemQty = (itemId) => {
    if (!activeCustomer) return 0;
    const item = activeCustomer.orders.find(o => o.id === itemId);
    return item ? item.qty : 0;
  };

  // --- Keyboard Shortcuts (Feature #34) ---
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Alt/Option + H: Go to History  
      if ((e.altKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setView('history');
      }
      // Alt/Option + D: Go to Dashboard
      if ((e.altKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        setActiveTableId(null);
        setView('dashboard');
      }
      // Alt/Option + M: Open Menu Management
      if ((e.altKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        setView('menu');
      }
      // ESC: Close modals
      if (e.key === 'Escape') {
        setShowPaymentModal(false);
        setShowMenuModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // --- Menu Management Functions (Feature #7) ---
  const addMenuItem = async (menuItem) => {
    await db.menuItems.add(menuItem);
    setShowMenuModal(false);
    setEditingMenuItem(null);
  };

  const updateMenuItem = async (id, updates) => {
    await db.menuItems.update(id, updates);
    setShowMenuModal(false);
    setEditingMenuItem(null);
  };

  const deleteMenuItem = async (id) => {
    showConfirm(
      'Delete Item',
      'Are you sure you want to delete this menu item?',
      async () => {
        await db.menuItems.delete(id);
      },
      'Delete',
      'Cancel'
    );
  };

  // --- Cloud Sync Features (Feature #38) ---
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Auto-backup to localStorage every 5 minutes
  useEffect(() => {
    const backupData = async () => {
      try {
        const allTables = await db.diningTables.toArray();
        const allHistory = await db.history.toArray();
        const allMenuItems = await db.menuItems.toArray();

        const backup = {
          tables: allTables,
          history: allHistory,
          menuItems: allMenuItems,
          timestamp: new Date().toISOString()
        };

        localStorage.setItem('restaurantPOS_backup', JSON.stringify(backup));
        setLastSyncTime(new Date());
      } catch (err) {
        console.error('Backup failed:', err);
      }
    };

    // Initial backup
    backupData();

    // Auto-backup every 5 minutes
    const interval = setInterval(backupData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Export data
  const exportData = async () => {
    try {
      setIsSyncing(true);
      const allTables = await db.diningTables.toArray();
      const allHistory = await db.history.toArray();
      const allMenuItems = await db.menuItems.toArray();

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        tables: allTables,
        history: allHistory,
        menuItems: allMenuItems
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `restaurant-pos-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Import data
  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      try {
        setIsSyncing(true);
        const file = e.target.files[0];
        const text = await file.text();
        const data = JSON.parse(text);

        if (!confirm(`Import data from ${new Date(data.exportDate).toLocaleString()}? This will replace all current data!`)) {
          setIsSyncing(false);
          return;
        }

        await db.diningTables.clear();
        await db.history.clear();
        await db.menuItems.clear();

        await db.diningTables.bulkAdd(data.tables);
        await db.history.bulkAdd(data.history);
        await db.menuItems.bulkAdd(data.menuItems);

        setLastSyncTime(new Date());
        alert('Data imported successfully!');
        window.location.reload();
      } catch (err) {
        console.error('Import failed:', err);
        alert('Import failed: ' + err.message);
      } finally {
        setIsSyncing(false);
      }
    };
    input.click();
  };

  // --- Render Views ---

  // Error State
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600 p-4">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">Database Error</h3>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading State (Waiting for DB connection)
  if (tables === undefined || orderHistory === undefined || menuItems === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Connecting to Database...</p>
        </div>
      </div>
    );
  }

  // Initializing State (DB connected but empty, waiting for population)
  if (tables.length === 0 || menuItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Initializing Data...</p>
        </div>
      </div>
    );
  }

  // Menu Item Edit/Add Modal Component
  const MenuItemModal = ({ item, onSave, onClose }) => {
    const [formData, setFormData] = useState(item || { name: '', price: 0, category: 'Snacks' });

    const handleSubmit = (e) => {
      e.preventDefault();
      if (item) {
        updateMenuItem(item.id, formData);
      } else {
        addMenuItem(formData);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
          <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
            <h3 className="text-xl font-bold">{item ? 'Edit' : 'Add'} Menu Item</h3>
            <button onClick={onClose}><X /></button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Item Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Price (₹)</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option>Snacks</option>
                <option>Drinks</option>
                <option>Packaged</option>
                <option>Main Course</option>
                <option>Desserts</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200">
                Cancel
              </button>
              <button type="submit" className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">
                {item ? 'Update' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderMenu = () => {
    const categories = [...new Set(menuItems.map(item => item.category))];

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <div className="bg-slate-800 text-white p-4 flex items-center justify-between shadow-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('dashboard')} className="p-2 hover:bg-slate-700 rounded-full">
              <ArrowLeft />
            </button>
            <h2 className="text-xl font-bold">Menu Management</h2>
          </div>
          <button
            onClick={() => setShowMenuModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium"
          >
            <Plus size={18} /> Add Item
          </button>
        </div>

        <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
          {categories.map(category => {
            const items = menuItems.filter(item => item.category === category);

            return (
              <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-4">
                  <h3 className="font-bold text-slate-800">{category}</h3>
                  <p className="text-sm text-slate-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-orange-300">
                      <div>
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-sm text-emerald-600 font-semibold">₹{item.price.toFixed(2)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingMenuItem(item);
                            setShowMenuModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteMenuItem(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {showMenuModal && (
          <MenuItemModal
            item={editingMenuItem}
            onClose={() => {
              setShowMenuModal(false);
              setEditingMenuItem(null);
            }}
          />
        )}
      </div>
    );
  };

  const renderHistory = () => {
    // Group orders by date
    const groupedByDate = orderHistory.reduce((acc, order) => {
      const dateKey = order.date.split(',')[0]; // Extract date part
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(order);
      return acc;
    }, {});

    // Calculate overall statistics
    const totalRevenue = orderHistory.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = orderHistory.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get unique items and their quantities
    const itemStats = orderHistory.reduce((acc, order) => {
      order.items.forEach(item => {
        if (!acc[item.name]) {
          acc[item.name] = { count: 0, revenue: 0 };
        }
        acc[item.name].count += item.qty;
        acc[item.name].revenue += item.price * item.qty;
      });
      return acc;
    }, {});

    const topItems = Object.entries(itemStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <div className="bg-slate-800 text-white p-4 flex items-center gap-4 shadow-md sticky top-0 z-10">
          <button onClick={() => setView('dashboard')} className="p-2 hover:bg-slate-700 rounded-full">
            <ArrowLeft />
          </button>
          <h2 className="text-xl font-bold">Sales History</h2>
        </div>

        <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
          {orderHistory.length === 0 ? (
            <div className="text-center text-slate-400 mt-20">
              <Coffee size={64} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg">No sales yet</p>
              <p className="text-sm">Sales history will appear here</p>
            </div>
          ) : (
            <>
              {/* Summary Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="text-slate-500 text-sm font-medium mb-1">Total Revenue</div>
                  <div className="text-3xl font-bold text-emerald-600">₹{totalRevenue.toFixed(2)}</div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="text-slate-500 text-sm font-medium mb-1">Total Orders</div>
                  <div className="text-3xl font-bold text-slate-800">{totalOrders}</div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="text-slate-500 text-sm font-medium mb-1">Avg Order Value</div>
                  <div className="text-3xl font-bold text-blue-600">₹{avgOrderValue.toFixed(2)}</div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="text-slate-500 text-sm font-medium mb-1">Days Tracked</div>
                  <div className="text-3xl font-bold text-orange-600">{Object.keys(groupedByDate).length}</div>
                </div>
              </div>

              {/* Top Selling Items */}
              {topItems.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Top Selling Items</h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {topItems.map(([name, stats], idx) => (
                      <div key={name} className="flex flex-col items-center text-center p-3 bg-slate-50 rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold mb-2">
                          #{idx + 1}
                        </div>
                        <div className="font-semibold text-slate-700 text-sm mb-1">{name}</div>
                        <div className="text-xs text-slate-500">{stats.count} sold</div>
                        <div className="text-xs font-bold text-emerald-600">₹{stats.revenue.toFixed(0)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Day-wise Order Groups */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Day-wise Sales</h3>
                {Object.entries(groupedByDate).map(([date, orders]) => {
                  const dayTotal = orders.reduce((sum, order) => sum + order.total, 0);
                  const dayOrderCount = orders.length;

                  return (
                    <div key={date} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      {/* Day Header */}
                      <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-slate-800">{date}</h4>
                          <p className="text-sm text-slate-500">{dayOrderCount} order{dayOrderCount !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-emerald-600">₹{dayTotal.toFixed(2)}</div>
                        </div>
                      </div>

                      {/* Day Orders */}
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs">
                          <tr>
                            <th className="p-3">Time</th>
                            <th className="p-3">Table</th>
                            <th className="p-3">Guest</th>
                            <th className="p-3">Items</th>
                            <th className="p-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {orders.map(order => (
                            <tr key={order.id} className="hover:bg-slate-50">
                              <td className="p-3 text-sm text-slate-600">
                                {order.date.split(',')[1]?.trim() || order.date}
                              </td>
                              <td className="p-3 font-bold text-slate-700 text-sm">T-{order.tableId}</td>
                              <td className="p-3 text-slate-700 text-sm">{order.customerName}</td>
                              <td className="p-3 text-xs text-slate-500">
                                {order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
                              </td>
                              <td className="p-3 text-right font-bold text-emerald-600">₹{order.total.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <div className="min-h-screen bg-slate-100 p-6">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Snack Point POS</h1>
          <p className="text-slate-500">Fast Billing System</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <button
            onClick={exportData}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg shadow-sm border border-blue-200 hover:bg-blue-100 font-medium text-sm disabled:opacity-50"
            title="Export data to file"
          >
            📥 Export
          </button>
          <button
            onClick={importData}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg shadow-sm border border-purple-200 hover:bg-purple-100 font-medium text-sm disabled:opacity-50"
            title="Import data from file"
          >
            📤 Import
          </button>
          <button
            onClick={() => setView('menu')}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 font-medium"
          >
            <Coffee size={18} /> Menu
          </button>
          <button
            onClick={() => setView('history')}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 font-medium"
          >
            <History size={18} /> History
          </button>
          {lastSyncTime && (
            <div className="text-xs text-slate-400 hidden lg:block" title={`Last backup: ${lastSyncTime.toLocaleTimeString()}`}>
              💾 Auto-saved
            </div>
          )}
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-slate-600">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {tables.map(table => {
          const total = calculateTableTotal(table);
          // Only consider table occupied if there are customers WITH orders
          const customersWithOrders = table.customers.filter(c => c.orders.length > 0);
          const isOccupied = customersWithOrders.length > 0;
          const customerCount = customersWithOrders.length;

          return (
            <button
              key={table.id}
              onClick={() => handleTableClick(table.id)}
              className={`
                relative h-40 rounded-2xl shadow-sm border-2 transition-all transform active:scale-95 flex flex-col items-center justify-center gap-2
                ${isOccupied
                  ? 'bg-white border-orange-500 shadow-orange-100'
                  : 'bg-white border-slate-200 hover:border-emerald-400'}
              `}
            >
              <div className={`
                  absolute top-3 right-3 w-3 h-3 rounded-full 
                  ${isOccupied ? 'bg-orange-500 animate-pulse' : 'bg-emerald-400'}
              `} />

              <span className="text-2xl font-bold text-slate-700">Table {table.id}</span>

              {isOccupied ? (
                <div className="text-center">
                  <span className="block text-lg font-bold text-orange-600">₹{total.toFixed(2)}</span>
                  <span className="text-xs text-slate-400 flex items-center justify-center gap-1">
                    <Users size={12} /> {customerCount} Guest{customerCount !== 1 ? 's' : ''}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-slate-400">Empty</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (view === 'menu') return renderMenu();
  if (view === 'history') return renderHistory();
  if (view === 'dashboard' || activeTableId === null) return renderDashboard();

  // --- Order View ---

  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-50 overflow-hidden">

      {/* LEFT: Order Summary & Guests */}
      <div className="w-full md:w-1/3 bg-white border-r border-slate-200 flex flex-col h-full shadow-xl z-10">

        {/* Header */}
        <div className="p-4 bg-slate-800 text-white flex justify-between items-center shrink-0">
          <button
            onClick={() => { setActiveTableId(null); setView('dashboard'); }}
            className="flex items-center gap-1 text-slate-300 hover:text-white"
          >
            <ChevronLeft size={20} /> Tables
          </button>
          <h2 className="text-xl font-bold">Table {activeTableId}</h2>
          <div className="w-20 text-right font-mono text-lg text-emerald-400">₹{calculateTableTotal(activeTable).toFixed(0)}</div>
        </div>

        {/* Guest Tabs */}
        <div className="flex overflow-x-auto bg-slate-100 border-b border-slate-200 p-1 gap-1 shrink-0 no-scrollbar">
          {activeTable.customers.map((cust, idx) => (
            <button
              key={cust.id}
              onClick={() => setActiveCustomerIndex(idx)}
              className={`
                flex items-center gap-2 px-4 py-3 rounded-t-lg min-w-[100px] text-sm font-semibold transition-colors relative group
                ${activeCustomerIndex === idx
                  ? 'bg-white text-slate-800 shadow-[0_-2px_5px_rgba(0,0,0,0.05)] border-t-2 border-orange-500'
                  : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}
              `}
            >
              <span className="truncate max-w-[80px]">{cust.name}</span>
              {activeTable.customers.length > 1 && (
                <X
                  size={14}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 absolute top-1 right-1"
                  onClick={(e) => removeCustomer(idx, e)}
                />
              )}
            </button>
          ))}
          <button
            onClick={() => addCustomer()}
            className="flex items-center justify-center px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 ml-1"
          >
            <UserPlus size={18} />
          </button>
        </div>

        {/* Order List (LEFT SIDE) */}
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {activeCustomer ? (
            activeCustomer.orders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
                <Coffee size={48} className="opacity-20" />
                <p>No items yet</p>
                <p className="text-xs">Select items from the menu</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeCustomer.orders.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 animate-in slide-in-from-left-2 duration-100">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-200 text-slate-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                        {item.qty}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{item.name}</span>
                        <span className="text-xs text-slate-400">₹{item.price} x {item.qty}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700 w-16 text-right">₹{item.price * item.qty}</span>
                      {/* DELETE BUTTON */}
                      <button
                        onClick={() => deleteItem(idx)}
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="p-4 text-center text-slate-500">Select a guest or add one</div>
          )}
        </div>

        {/* Action Bar */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-end mb-4">
            <span className="text-sm text-slate-500">Seat Total</span>
            <span className="text-2xl font-bold text-slate-800">
              ₹{activeCustomer ? calculateCustomerTotal(activeCustomer).toFixed(2) : '0.00'}
            </span>
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={!activeCustomer || calculateTableTotal(activeTable) === 0}
            className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-lg shadow-orange-200 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <IndianRupee size={20} /> PAY / BILL
          </button>
        </div>
      </div>

      {/* RIGHT: Menu Grid (FLATTENED + CONTROLS) */}
      <div className="w-full md:w-2/3 flex flex-col bg-slate-50 h-full p-4 overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
          {menuItems.map(item => {
            const qty = getItemQty(item.id);

            return (
              <div
                key={item.id}
                onClick={() => qty === 0 && addItemToOrder(item)}
                className={`
                    relative bg-white p-4 h-32 rounded-2xl border shadow-sm transition-all flex flex-col justify-between items-start text-left select-none
                    ${qty > 0
                    ? 'border-orange-500 shadow-orange-100 ring-1 ring-orange-500'
                    : 'border-slate-200 hover:border-orange-400 hover:shadow-md cursor-pointer active:scale-95'}
                  `}
              >
                <span className="font-bold text-slate-700 leading-tight text-lg">{item.name}</span>

                <div className="w-full flex justify-between items-end mt-2">
                  <span className="text-slate-500 text-md font-medium">₹{item.price}</span>

                  {qty > 0 ? (
                    /* QUANTITY CONTROLS ON SELECTING SIDE */
                    <div className="flex items-center bg-orange-50 rounded-full border border-orange-200">
                      <button
                        onClick={(e) => decreaseItemQuantity(item.id, e)}
                        className="w-8 h-8 flex items-center justify-center text-orange-600 hover:bg-orange-100 rounded-l-full active:bg-orange-200"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-6 text-center font-bold text-orange-700">{qty}</span>
                      <button
                        onClick={(e) => addItemToOrder(item, e)}
                        className="w-8 h-8 flex items-center justify-center text-orange-600 hover:bg-orange-100 rounded-r-full active:bg-orange-200"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
                      <Plus size={20} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold">Billing Table {activeTableId}</h3>
              <button onClick={() => setShowPaymentModal(false)}><X /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              <div className="space-y-4">
                {/* Split Bill Cards */}
                {activeTable.customers.map((cust, idx) => {
                  const custTotal = calculateCustomerTotal(cust);
                  if (custTotal === 0 && cust.orders.length === 0) return null;

                  return (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                      <div className="flex-1 w-full">
                        <div className="flex justify-between font-bold text-slate-700 mb-2">
                          <span className="flex items-center gap-2"><Users size={16} /> {cust.name}</span>
                          <span className="text-lg">₹{custTotal.toFixed(2)}</span>
                        </div>
                        <div className="text-sm text-slate-500 pl-6 border-l-2 border-slate-100">
                          {cust.orders.map((o, i) => (
                            <span key={i} className="inline-block mr-3 bg-slate-100 px-2 rounded-md mb-1">
                              {o.qty}x {o.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => payForSeat(idx)}
                        className="px-6 py-3 bg-white border-2 border-emerald-500 text-emerald-600 font-bold rounded-lg hover:bg-emerald-50 active:scale-95 transition-all whitespace-nowrap w-full md:w-auto"
                      >
                        Pay {cust.name} Only
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 bg-white border-t border-slate-200 shrink-0">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xl font-bold text-slate-600">GRAND TOTAL</span>
                <span className="text-4xl font-black text-slate-800">
                  ₹{calculateTableTotal(activeTable).toFixed(2)}
                </span>
              </div>
              <button
                onClick={payForTable}
                className="w-full py-5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 text-xl"
              >
                <CheckCircle size={24} /> PAY FULL TABLE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 bg-slate-800 text-white">
              <h3 className="text-xl font-bold">{confirmDialog.title}</h3>
            </div>

            <div className="p-6">
              <p className="text-slate-700 text-lg">{confirmDialog.message}</p>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3 justify-end">
              <button
                onClick={confirmDialog.onCancel}
                className="px-6 py-3 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 active:scale-95 transition-all"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-200"
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
