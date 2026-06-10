const { useState, useEffect, useRef } = React;

window.App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orderSubTab, setOrderSubTab] = useState('semua');
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [botStatus, setBotStatus] = useState({ status: 'disconnected', qr: null });

  // Toast State & Helper
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  // Data Stores
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [blockedNumbers, setBlockedNumbers] = useState([]);
  const [media, setMedia] = useState([]);
  const [mediaSearch, setMediaSearch] = useState('');
  const [debouncedMediaSearch, setDebouncedMediaSearch] = useState('');
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaPagination, setMediaPagination] = useState({ total: 0, page: 1, limit: 12 });
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSubTab, setMediaSubTab] = useState('color_stock');
  const [stockColors, setStockColors] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ company: [], reseller: [], services: [], escalationKeywords: '' });

  // Live Chat States
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [chatSearch, setChatSearch] = useState('');

  // Filter & Loaders
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productPagination, setProductPagination] = useState({ total: 0, page: 1, limit: 9 });
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Product Form holds all fields including complex variants & wholesale tiers
  const [productForm, setProductForm] = useState({
    id: '',
    name: '',
    category: '',
    sub_category: '',
    description: '',
    price_retail: '',
    price_reseller: '',
    color: '',
    size: '',
    material: '',
    weight: '',
    stock: '',
    image: '',
    status: 'Tersedia',
    variants: [],
    wholesale_tiers: []
  });


  const [uploadingImage, setUploadingImage] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);

  // Stock confirmation modal states
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedConfirmOrder, setSelectedConfirmOrder] = useState(null);
  const [confirmForm, setConfirmForm] = useState({ productId: '', quantity: 1, total: 0, remark: '' });

  // Automatic final price calculation for completed orders
  useEffect(() => {
    if (confirmForm.productId) {
      const selectedProd = products.find(p => p.id === confirmForm.productId);
      if (selectedProd) {
        const qty = parseInt(confirmForm.quantity) || 0;
        const newTotal = selectedProd.price_retail * qty;
        setConfirmForm(prev => ({ ...prev, total: newTotal }));
      }
    }
  }, [confirmForm.productId, confirmForm.quantity, products]);

  // Settings Edit State
  const [editingSetting, setEditingSetting] = useState(null);
  const [settingValue, setSettingValue] = useState('');

  const chatEndRef = useRef(null);
  const imgInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const logTerminalRef = useRef(null);

  // Notification Audio
  const notificationSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-120.wav'));

  // Toggle Theme
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (darkMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  // Sound notification trigger
  const playNotification = () => {
    try {
      notificationSound.current.play();
    } catch (e) { }
  };

  // Fetch dynamic settings editor lists
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const d = await res.json();
      if (d.success) setSettings(d.data);
    } catch (e) { }
  };

  // Initial Fetch Loops
  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const d = await res.json();
      setBotStatus(d);
    } catch (e) { }
  };

  const fetchProducts = async (pageToFetch = productPage) => {
    setProductsLoading(true);
    try {
      const catQuery = productCategory ? `&category=${productCategory}` : '';
      const res = await fetch(`/api/products?search=${debouncedProductSearch}${catQuery}&page=${pageToFetch}&limit=9`);
      const d = await res.json();
      if (d.success) {
        setProducts(d.data);
        if (d.pagination) {
          setProductPagination(d.pagination);
        }
      }
    } catch (e) {
    } finally {
      // Small timeout to give smooth skeleton experience
      setTimeout(() => setProductsLoading(false), 300);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const d = await res.json();
      if (d.success) setCustomers(d.data);
    } catch (e) { }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const d = await res.json();
      if (d.success) setOrders(d.data);
    } catch (e) { }
  };

  const fetchComplaints = async () => {
    try {
      const res = await fetch('/api/complaints');
      const d = await res.json();
      if (d.success) setComplaints(d.data);
    } catch (e) { }
  };

  const fetchBlockedNumbers = async () => {
    try {
      const res = await fetch('/api/blocked-numbers');
      const d = await res.json();
      if (d.success) setBlockedNumbers(d.data);
    } catch (e) { }
  };

  const fetchMedia = async (pageToFetch = mediaPage) => {
    setMediaLoading(true);
    try {
      const tagQuery = mediaSubTab ? `&tag=${mediaSubTab}` : '';
      const res = await fetch(`/api/media?search=${debouncedMediaSearch}${tagQuery}&page=${pageToFetch}&limit=12`);
      const d = await res.json();
      if (d.success) {
        setMedia(d.data);
        if (d.pagination) {
          setMediaPagination(d.pagination);
        }
      }
    } catch (e) {
    } finally {
      setTimeout(() => setMediaLoading(false), 200);
    }
  };

  const fetchStockColors = async () => {
    try {
      const res = await fetch('/api/stock-colors');
      const d = await res.json();
      if (d.success) setStockColors(d.data);
    } catch (e) { }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const d = await res.json();
      if (d.success) setLogs(d.data);
    } catch (e) { }
  };

  // Fetch chat messages for active customer
  const loadChatMessages = async (phoneNumber) => {
    try {
      const res = await fetch(`/api/whatsapp/chats/${phoneNumber}`);
      const d = await res.json();
      if (d.success) {
        setChatMessages(d.data);
        fetchCustomers(); // Clear unread count visual indicator
      }
    } catch (e) { }
  };

  const handleClearChatHistory = async (phoneNumber) => {
    if (!confirm('Apakah Anda yakin ingin menghapus seluruh riwayat chat customer ini dari CRM? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      const res = await fetch(`/api/whatsapp/chats/${phoneNumber}`, {
        method: 'DELETE'
      });
      const d = await res.json();
      if (d.success) {
        setChatMessages([]);
        showToast('Riwayat chat berhasil dihapus.');
      }
    } catch (e) {
      showToast('Gagal menghapus riwayat chat.', 'error');
    }
  };

  // Keep activeChat in a Ref so Socket.IO callbacks can always read the latest selected chat
  // without tearing down and rebuilding the WebSocket connection or triggering redundant data fetches.
  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // On Initial Mount only - Connect socket and load starting states (lazy load media on tab switch)
  useEffect(() => {
    fetchBotStatus();
    fetchCustomers();
    fetchOrders();
    fetchComplaints();
    fetchBlockedNumbers();
    fetchLogs();
    fetchSettings();

    // Connect Socket.IO
    const socket = io();

    socket.on('bot_status_update', (status) => {
      setBotStatus(status);
    });

    // Real-time messages update
    socket.on('incoming_message', (msg) => {
      if (activeChatRef.current && msg.phone_number === activeChatRef.current) {
        setChatMessages(prev => [...prev, msg]);
      }
      fetchCustomers();
    });

    socket.on('chat_history_cleared', (data) => {
      if (activeChatRef.current && data.phone_number === activeChatRef.current) {
        setChatMessages([]);
      }
      fetchCustomers();
    });

    // Real-time order update
    socket.on('new_order', (order) => {
      fetchOrders();
      playNotification();
    });

    // Real-time complaint update
    socket.on('new_complaint', (comp) => {
      fetchComplaints();
      playNotification();
    });

    socket.on('customer_updated', () => {
      fetchCustomers();
    });

    socket.on('new_log', (log) => {
      setLogs(prev => [log, ...prev].slice(0, 200));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Debounce search input to prevent firing rapid network requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedProductSearch(productSearch);
    }, 250);
    return () => clearTimeout(handler);
  }, [productSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedMediaSearch(mediaSearch);
    }, 250);
    return () => clearTimeout(handler);
  }, [mediaSearch]);

  // Triggers products fetch when page, debounced search, or category filter updates
  useEffect(() => {
    fetchProducts(productPage);
  }, [productPage, debouncedProductSearch, productCategory]);

  // Lazy load media and stock colors only when Media tab is active to prevent startup lag
  useEffect(() => {
    if (activeTab === 'media') {
      fetchMedia(mediaPage);
    }
  }, [activeTab, mediaPage, debouncedMediaSearch, mediaSubTab]);

  useEffect(() => {
    if (activeTab === 'media' || activeTab === 'products') {
      fetchStockColors();
    }
  }, [activeTab]);

  // Scroll to bottom of chat window
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logs]);

  // ======================== API ACTIONS ========================

  // Manual live chat reply
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!typedMessage.trim() || !activeChat) return;

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: activeChat, message: typedMessage })
      });
      const d = await res.json();
      if (d.success) {
        setTypedMessage('');
        loadChatMessages(activeChat);
      }
    } catch (e) { }
  };

  // Upload live chat media (image or PDF)
  const handleChatMediaUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChat) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('phoneNumber', activeChat);

    try {
      showToast('Mengirim media...', 'info');
      const res = await fetch('/api/whatsapp/send-media', {
        method: 'POST',
        body: formData
      });
      const d = await res.json();
      if (d.success) {
        showToast('Media berhasil terkirim!', 'success');
        if (e.target) e.target.value = ''; // Reset file input
        loadChatMessages(activeChat);
      } else {
        showToast(`Gagal mengirim media: ${d.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showToast(`Error mengirim media: ${err.message}`, 'error');
    }
  };

  // In-line settings editor
  const handleSaveSetting = async () => {
    if (!editingSetting) return;
    try {
      const res = await fetch(`/api/settings/company/${editingSetting.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: settingValue })
      });
      const d = await res.json();
      if (d.success) {
        showToast('Sukses menyimpan informasi perusahaan!');
        setEditingSetting(null);
        fetchSettings();
      }
    } catch (e) { }
  };

  // CRUD Product Actions
  const handleProductFormSubmit = async (e) => {
    e.preventDefault();
    const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
    const method = editingProduct ? 'PUT' : 'POST';

    const colorParsed = typeof productForm.color === 'string'
      ? productForm.color.split(',').map(c => c.trim()).filter(Boolean)
      : productForm.color;

    const sizeParsed = typeof productForm.size === 'string'
      ? productForm.size.split(',').map(s => s.trim()).filter(Boolean)
      : productForm.size;

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productForm,
          color: colorParsed,
          size: sizeParsed
        })
      });
      const d = await res.json();
      if (d.success) {
        setProductModalOpen(false);
        setEditingProduct(null);
        fetchProducts();
        showToast('Produk berhasil disimpan!');
      } else {
        showToast(`Error: ${d.error}`, 'error');
      }
    } catch (e) {
      showToast('Error menyimpan produk.', 'error');
    }
  };

  const handleProductImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/products/upload-image', {
        method: 'POST',
        body: formData
      });
      const d = await res.json();
      if (d.success) {
        const currentImages = productForm.image ? productForm.image.split(',').map(i => i.trim()).filter(Boolean) : [];
        currentImages.push(d.url);
        setProductForm(prev => ({ ...prev, image: currentImages.join(', ') }));
        showToast('Gambar berhasil diunggah!');
      }
    } catch (err) {
      showToast('Error mengunggah gambar.', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleEditProductClick = (p) => {
    setEditingProduct(p);
    setProductForm({
      id: p.id,
      name: p.name,
      category: p.category || '',
      sub_category: p.sub_category || '',
      description: p.description || '',
      price_retail: p.price_retail,
      price_reseller: p.price_reseller,
      color: Array.isArray(p.color) ? p.color.join(', ') : (p.color || ''),
      size: Array.isArray(p.size) ? p.size.join(', ') : (p.size || ''),
      material: p.material || '',
      weight: p.weight || 0,
      stock: p.stock || 0,
      image: p.image || '',
      status: p.status || 'Tersedia',
      variants: Array.isArray(p.variants) ? p.variants : (typeof p.variants === 'string' ? JSON.parse(p.variants || '[]') : []),
      wholesale_tiers: Array.isArray(p.wholesale_tiers) ? p.wholesale_tiers : (typeof p.wholesale_tiers === 'string' ? JSON.parse(p.wholesale_tiers || '[]') : [])
    });
    setProductModalOpen(true);
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) {
        fetchProducts();
        showToast('Produk berhasil dihapus!');
      }
    } catch (e) { }
  };

  // Resolve Complaint & Resume Bot replies
  const handleResolveComplaint = async (id) => {
    try {
      const res = await fetch(`/api/complaints/${id}/resolve`, { method: 'PUT' });
      const d = await res.json();
      if (d.success) {
        showToast('Komplain diselesaikan! Bot CS aktif kembali.');
        fetchComplaints();
        fetchCustomers();
        fetchBlockedNumbers();
      }
    } catch (e) { }
  };

  // Manual Blocks Block/Unblock
  const handleUnblock = async (phone) => {
    try {
      const res = await fetch(`/api/blocked-numbers/${phone}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) {
        showToast('Nomor diunblock! Bot CS aktif kembali.');
        fetchBlockedNumbers();
        fetchCustomers();
      }
    } catch (e) { }
  };

  const handleBlockManual = async () => {
    const phone = prompt('Masukkan nomor WhatsApp yang ingin diblock (contoh: 628xxx@c.us):');
    if (!phone) return;
    const reason = prompt('Masukkan alasan blocking (opsional):');

    try {
      const res = await fetch('/api/blocked-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, reason })
      });
      const d = await res.json();
      if (d.success) {
        showToast('Nomor berhasil diblock dari auto-reply.');
        fetchBlockedNumbers();
        fetchCustomers();
      } else {
        showToast(`Gagal: ${d.error}`, 'error');
      }
    } catch (e) { }
  };

  // Orders Operations
  const handleUpdateOrderStatus = async (id, status) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const d = await res.json();
      if (d.success) {
        fetchOrders();
        showToast(`Status pesanan diubah menjadi ${status}!`);
      }
    } catch (e) { }
  };

  const handleDeleteOrder = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pesanan ini secara permanen dari database?')) return;
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) {
        fetchOrders();
        showToast('Pesanan berhasil dihapus!');
      }
    } catch (e) {
      showToast('Error menghapus pesanan.', 'error');
    }
  };

  const handleDeleteComplaint = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus laporan komplain ini dari database?')) return;
    try {
      const res = await fetch(`/api/complaints/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) {
        fetchComplaints();
        showToast('Laporan komplain berhasil dihapus!');
      }
    } catch (e) {
      showToast('Error menghapus laporan komplain.', 'error');
    }
  };

  const handleUpdateOrderTotal = async (id) => {
    const total = prompt('Masukkan total harga baru (Rp):');
    if (total === null || isNaN(total)) return;

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total })
      });
      const d = await res.json();
      if (d.success) {
        fetchOrders();
        showToast('Total harga pesanan berhasil diperbarui!');
      }
    } catch (e) { }
  };

  const handleConfirmPurchaseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedConfirmOrder) return;

    try {
      const res = await fetch(`/api/orders/${selectedConfirmOrder.id}/confirm-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmForm)
      });
      const d = await res.json();
      if (d.success) {
        setConfirmModalOpen(false);
        setSelectedConfirmOrder(null);
        fetchOrders();
        fetchProducts();
        showToast('Pembelian dikonfirmasi & stok otomatis dipotong!');
      } else {
        showToast(`Gagal: ${d.error}`, 'error');
      }
    } catch (err) {
      showToast('Error mengonfirmasi pesanan.', 'error');
    }
  };

  // Media Gallery Upload
  const handleMediaUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const chosenTag = galleryInputRef.current.tagToUpload || 'general';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tag', chosenTag);

    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData
      });
      const d = await res.json();
      if (d.success) {
        showToast('File media berhasil diupload ke Galeri!');
        fetchMedia();
      }
    } catch (e) { }
  };

  const handleDeleteMedia = async (id) => {
    if (!confirm('Hapus media ini dari galeri?')) return;
    try {
      const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) {
        fetchMedia();
      }
    } catch (e) { }
  };

  const handleCreateStockColor = async (formData) => {
    try {
      const res = await fetch('/api/stock-colors', {
        method: 'POST',
        body: formData
      });
      const d = await res.json();
      if (d.success) {
        showToast('Warna stok berhasil ditambahkan!');
        fetchStockColors();
      } else {
        showToast(d.error || 'Gagal menambahkan warna stok.', 'error');
      }
    } catch (e) {
      showToast('Gagal menambahkan warna stok.', 'error');
    }
  };

  const handleToggleStockColorStatus = async (id, currentReady) => {
    try {
      const res = await fetch(`/api/stock-colors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_ready: !currentReady })
      });
      const d = await res.json();
      if (d.success) {
        showToast('Status warna stok berhasil diperbarui!');
        fetchStockColors();
      }
    } catch (e) { }
  };

  const handleDeleteStockColor = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus warna stok ini?')) return;
    try {
      const res = await fetch(`/api/stock-colors/${id}`, {
        method: 'DELETE'
      });
      const d = await res.json();
      if (d.success) {
        showToast('Warna stok berhasil dihapus.');
        fetchStockColors();
      }
    } catch (e) { }
  };

  const handleSyncKnowledge = async () => {
    try {
      const res = await fetch('/api/stock-colors/sync-knowledge', {
        method: 'POST'
      });
      const d = await res.json();
      if (d.success) {
        showToast('Sinkronisasi wawasan stok warna kain ke AI sukses! 🎉');
      } else {
        showToast(d.error || 'Gagal sinkronisasi wawasan.', 'error');
      }
    } catch (e) {
      showToast('Gagal sinkronisasi wawasan.', 'error');
    }
  };

  // CRM Pinned / Status Updates
  const togglePinCustomer = async (phone, isPinned) => {
    try {
      await fetch(`/api/customers/${phone}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !isPinned })
      });
      fetchCustomers();
    } catch (e) { }
  };

  const handleAssignAdmin = async (phone, adminName) => {
    try {
      await fetch(`/api/customers/${phone}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: adminName })
      });
      fetchCustomers();
    } catch (e) { }
  };

  const handleChangeCustomerStatus = async (phone, status, pausedUntil = undefined) => {
    try {
      const bodyPayload = { status };
      if (pausedUntil !== undefined) bodyPayload.paused_until = pausedUntil;
      await fetch(`/api/customers/${phone}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      fetchCustomers();
    } catch (e) { }
  };

  const handleSendInvoicePdf = async (orderId) => {
    try {
      showToast('Sedang membuat & mengirim PDF Invoice...');
      const res = await fetch('/api/whatsapp/send-pdf/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('PDF Invoice berhasil dikirim ke WhatsApp customer!');
      } else {
        showToast(`Gagal: ${data.error}`, 'error');
      }
    } catch (e) {
      showToast('Error mengirim PDF Invoice.', 'error');
    }
  };

  const handleSendWelcomePdf = async (phoneNumber, resellerLevel) => {
    try {
      showToast('Sedang membuat & mengirim PDF Panduan Reseller...');
      const res = await fetch('/api/whatsapp/send-pdf/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, resellerLevel })
      });
      const data = await res.json();
      if (data.success) {
        showToast('PDF Panduan Reseller berhasil dikirim ke WhatsApp customer!');
      } else {
        showToast(`Gagal: ${data.error}`, 'error');
      }
    } catch (e) {
      showToast('Error mengirim PDF Panduan Reseller.', 'error');
    }
  };

  // Active Chats Filters
  const filteredCustomers = customers.filter(c => {
    return c.phone_number.includes(chatSearch) || (c.name && c.name.toLowerCase().includes(chatSearch.toLowerCase()));
  });

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ==================== MOBILE MENU DRAWER OVERLAY ==================== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Content */}
          <aside className="relative w-64 max-w-xs bg-white dark:bg-darkbg-card border-r border-darkbg-border flex flex-col justify-between h-full shadow-2xl z-10">
            <div className="flex flex-col flex-1 min-h-0">
              {/* Header */}
              <div className="p-6 flex items-center justify-between border-b border-darkbg-border bg-gray-50 dark:bg-gray-800/10">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-500/20">V</div>
                  <h2 className="font-extrabold text-base bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-indigo-400">VUYAMA</h2>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Navigation Menu */}
              <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
                {[
                  { id: 'dashboard', name: 'Dashboard', icon: Icons.Dashboard },
                  { id: 'products', name: 'Products', icon: Icons.Products },
                  { id: 'customers', name: 'Live Chat CRM', icon: Icons.Customers, count: customers.reduce((acc, c) => acc + (c.unread_count || 0), 0) },
                  { id: 'orders', name: 'Orders Board', icon: Icons.Orders, count: orders.filter(o => o.status === 'PENDING').length },
                  { id: 'complaints', name: 'Complaints Queue', icon: Icons.Complaints, count: complaints.filter(c => c.status === 'OPEN').length },
                  { id: 'blocked', name: 'Blocked Bot', icon: Icons.Blocked },
                  { id: 'media', name: 'Media Gallery', icon: Icons.Media },
                  { id: 'logs', name: 'Bot Console', icon: Icons.Logs },
                  { id: 'settings', name: 'Settings Editor', icon: Icons.Settings }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all duration-150 ${activeTab === item.id ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-slate-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-gray-200 hover:bg-brand-50/50 dark:hover:bg-gray-800/40'}`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <item.icon />
                      <span>{item.name}</span>
                    </div>
                    {item.count > 0 && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${activeTab === item.id ? 'bg-white text-brand-600' : 'bg-brand-600 text-white'}`}>
                        {item.count}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-darkbg-border flex items-center justify-between bg-gray-50 dark:bg-gray-800/20">
              <div className="flex items-center space-x-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${botStatus.status === 'connected' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : botStatus.status === 'scanning' ? 'bg-amber-500 shadow-lg shadow-amber-500/20' : 'bg-rose-500 shadow-lg shadow-rose-500/20'}`} />
                <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 capitalize">Bot: {botStatus.status}</span>
              </div>
              <button onClick={toggleDarkMode} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-250">
                {darkMode ? <Icons.Sun /> : <Icons.Moon />}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ==================== LEFT SIDEBAR ==================== */}
      <aside className="w-64 glass border-r border-darkbg-border flex flex-col justify-between shrink-0 hidden md:flex h-full">
        <div className="flex flex-col flex-1 min-h-0">
          {/* BRAND HEADER */}
          <div className="p-6 flex items-center space-x-3 border-b border-darkbg-border">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-500/20">
              V
            </div>
            <div>
              <h1 className="font-extrabold text-lg bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-indigo-400">VUYAMA</h1>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Suite & CRM System</p>
            </div>
          </div>

          {/* NAVIGATION MENU */}
          <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
            {[
              { id: 'dashboard', name: 'Dashboard', icon: Icons.Dashboard },
              { id: 'products', name: 'Products', icon: Icons.Products },
              { id: 'customers', name: 'Live Chat CRM', icon: Icons.Customers, count: customers.reduce((acc, c) => acc + (c.unread_count || 0), 0) },
              { id: 'orders', name: 'Orders Board', icon: Icons.Orders, count: orders.filter(o => o.status === 'PENDING').length },
              { id: 'complaints', name: 'Complaints Queue', icon: Icons.Complaints, count: complaints.filter(c => c.status === 'OPEN').length },
              { id: 'blocked', name: 'Blocked Bot', icon: Icons.Blocked },
              { id: 'media', name: 'Media Gallery', icon: Icons.Media },
              { id: 'logs', name: 'Bot Console', icon: Icons.Logs },
              { id: 'settings', name: 'Settings Editor', icon: Icons.Settings }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all duration-150 ${activeTab === item.id ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-slate-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-gray-200 hover:bg-brand-50/50 dark:hover:bg-gray-800/40'}`}
              >
                <div className="flex items-center space-x-3.5">
                  <item.icon />
                  <span>{item.name}</span>
                </div>
                {item.count > 0 && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${activeTab === item.id ? 'bg-white text-brand-600' : 'bg-brand-600 text-white'}`}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="p-4 border-t border-darkbg-border flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${botStatus.status === 'connected' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : botStatus.status === 'scanning' ? 'bg-amber-500 shadow-lg shadow-amber-500/20' : 'bg-rose-500 shadow-lg shadow-rose-500/20'}`} />
            <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 capitalize">Bot: {botStatus.status}</span>
          </div>

          <button onClick={toggleDarkMode} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-250">
            {darkMode ? <Icons.Sun /> : <Icons.Moon />}
          </button>
        </div>
      </aside>

      {/* ==================== MAIN PANEL ==================== */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-[#0b0f19]">

        {/* MOBILE HEADER */}
        <header className="p-4 flex items-center justify-between border-b border-darkbg-border glass md:hidden shrink-0 bg-white dark:bg-darkbg-card">
          <div className="flex items-center space-x-3.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 focus:outline-none"
              title="Buka Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white text-sm shadow">V</div>
              <h1 className="font-extrabold text-sm tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-indigo-400">VUYAMA</h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={toggleDarkMode} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {darkMode ? <Icons.Sun /> : <Icons.Moon />}
            </button>
          </div>
        </header>

        {/* SCROLLABLE MAIN BODY */}
        <div className={`flex-1 p-4 md:p-8 ${activeTab === 'customers' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
          <DashboardTab
            activeTab={activeTab}
            customers={customers}
            orders={orders}
            complaints={complaints}
            products={products}
            botStatus={botStatus}
            logs={logs}
            fetchLogs={fetchLogs}
          />
          <ProductsTab
            activeTab={activeTab}
            products={products}
            productsLoading={productsLoading}
            productSearch={productSearch}
            setProductSearch={(val) => {
              setProductSearch(val);
              setProductPage(1);
            }}
            productCategory={productCategory}
            setProductCategory={(val) => {
              setProductCategory(val);
              setProductPage(1);
            }}
            productPage={productPage}
            setProductPage={setProductPage}
            productPagination={productPagination}
            setEditingProduct={setEditingProduct}
            setProductForm={setProductForm}
            setProductModalOpen={setProductModalOpen}
            handleEditProductClick={handleEditProductClick}
            handleDeleteProduct={handleDeleteProduct}
            stockColors={stockColors}
            handleCreateStockColor={handleCreateStockColor}
            handleToggleStockColorStatus={handleToggleStockColorStatus}
            handleDeleteStockColor={handleDeleteStockColor}
            handleSyncKnowledge={handleSyncKnowledge}
            fetchStockColors={fetchStockColors}
          />
          <LiveChatTab
            activeTab={activeTab}
            customers={customers}
            filteredCustomers={filteredCustomers}
            activeChat={activeChat}
            setActiveChat={setActiveChat}
            loadChatMessages={loadChatMessages}
            chatMessages={chatMessages}
            chatSearch={chatSearch}
            setChatSearch={setChatSearch}
            typedMessage={typedMessage}
            setTypedMessage={setTypedMessage}
            handleSendMessage={handleSendMessage}
            handleChatMediaUpload={handleChatMediaUpload}
            handleClearChatHistory={handleClearChatHistory}
            togglePinCustomer={togglePinCustomer}
            handleAssignAdmin={handleAssignAdmin}
            handleChangeCustomerStatus={handleChangeCustomerStatus}
            blockedNumbers={blockedNumbers}
            handleUnblock={handleUnblock}
            fetchBlockedNumbers={fetchBlockedNumbers}
            fetchCustomers={fetchCustomers}
            chatEndRef={chatEndRef}
            orders={orders}
            handleSendInvoicePdf={handleSendInvoicePdf}
            handleSendWelcomePdf={handleSendWelcomePdf}
          />
          <OrdersTab
            activeTab={activeTab}
            orders={orders}
            orderSubTab={orderSubTab}
            setOrderSubTab={setOrderSubTab}
            products={products}
            setSelectedConfirmOrder={setSelectedConfirmOrder}
            setConfirmForm={setConfirmForm}
            setConfirmModalOpen={setConfirmModalOpen}
            handleUpdateOrderTotal={handleUpdateOrderTotal}
            handleUpdateOrderStatus={handleUpdateOrderStatus}
            handleDeleteOrder={handleDeleteOrder}
          />
          <ComplaintsTab
            activeTab={activeTab}
            complaints={complaints}
            handleResolveComplaint={handleResolveComplaint}
            handleDeleteComplaint={handleDeleteComplaint}
          />
          <BlockedTab
            activeTab={activeTab}
            blockedNumbers={blockedNumbers}
            handleBlockManual={handleBlockManual}
            handleUnblock={handleUnblock}
          />
          <MediaTab
            activeTab={activeTab}
            media={media}
            galleryInputRef={galleryInputRef}
            handleMediaUpload={handleMediaUpload}
            handleDeleteMedia={handleDeleteMedia}
            mediaSearch={mediaSearch}
            setMediaSearch={(val) => {
              setMediaSearch(val);
              setMediaPage(1);
            }}
            mediaPage={mediaPage}
            setMediaPage={setMediaPage}
            mediaPagination={mediaPagination}
            mediaLoading={mediaLoading}
          />
          <LogsTab
            activeTab={activeTab}
            logs={logs}
            logTerminalRef={logTerminalRef}
          />
          <SettingsTab
            activeTab={activeTab}
            settings={settings}
            fetchSettings={fetchSettings}
          />
        </div>
      </main>

      {/* ==================== PRODUCT FORM DIALOG MODAL ==================== */}
      <ProductModal
        productModalOpen={productModalOpen}
        setProductModalOpen={setProductModalOpen}
        editingProduct={editingProduct}
        setEditingProduct={setEditingProduct}
        productForm={productForm}
        setProductForm={setProductForm}
        uploadingImage={uploadingImage}
        imgInputRef={imgInputRef}
        handleProductImageUpload={handleProductImageUpload}
        handleProductFormSubmit={handleProductFormSubmit}
        showToast={showToast}
      />

      {/* ==================== CONFIRM PURCHASE DIALOG MODAL ==================== */}
      <ConfirmOrderModal
        confirmModalOpen={confirmModalOpen}
        setConfirmModalOpen={setConfirmModalOpen}
        selectedConfirmOrder={selectedConfirmOrder}
        setSelectedConfirmOrder={setSelectedConfirmOrder}
        confirmForm={confirmForm}
        setConfirmForm={setConfirmForm}
        products={products}
        handleConfirmPurchaseSubmit={handleConfirmPurchaseSubmit}
      />

      {/* ==================== CUSTOM TOAST NOTIFICATION ==================== */}
      <ToastNotification toast={toast} setToast={setToast} />

    </div>
  );
};
