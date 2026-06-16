window.EditOrderModal = ({
  editModalOpen,
  setEditModalOpen,
  selectedEditOrder,
  setSelectedEditOrder,
  products,
  handleEditOrderSubmit
}) => {
  const [customerName, setCustomerName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [status, setStatus] = React.useState('PENDING');
  
  const [items, setItems] = React.useState([{ product_name: '', quantity: 1, price: 0, productId: '' }]);
  
  const [brandName, setBrandName] = React.useState('');
  const [labelSize, setLabelSize] = React.useState('');
  const [labelShape, setLabelShape] = React.useState('');
  const [inkColor, setInkColor] = React.useState('');
  const [labelColor, setLabelColor] = React.useState('');
  const [font, setFont] = React.useState('');

  // Load details from selectedEditOrder when modal opens
  React.useEffect(() => {
    if (selectedEditOrder) {
      setCustomerName(selectedEditOrder.customer_name || '');
      setPhone(selectedEditOrder.phone || '');
      setAddress(selectedEditOrder.address || '');
      setStatus(selectedEditOrder.status || 'PENDING');
      
      setBrandName(selectedEditOrder.brand_name || '');
      setLabelSize(selectedEditOrder.label_size || '');
      setLabelShape(selectedEditOrder.label_shape || '');
      setInkColor(selectedEditOrder.ink_color || '');
      setLabelColor(selectedEditOrder.label_color || '');
      setFont(selectedEditOrder.font || '');

      if (selectedEditOrder.items && selectedEditOrder.items.length > 0) {
        setItems(selectedEditOrder.items.map(item => ({
          product_name: item.product_name || '',
          quantity: item.quantity || 1,
          price: item.price || 0,
          productId: item.product_id || ''
        })));
      } else {
        setItems([{ product_name: selectedEditOrder.pesanan_raw || '', quantity: 1, price: 0, productId: '' }]);
      }
    }
  }, [selectedEditOrder]);

  if (!editModalOpen || !selectedEditOrder) return null;

  const handleAddItem = () => {
    setItems([...items, { product_name: '', quantity: 1, price: 0, productId: '' }]);
  };

  const handleRemoveItem = (index) => {
    const list = [...items];
    list.splice(index, 1);
    setItems(list.length > 0 ? list : [{ product_name: '', quantity: 1, price: 0, productId: '' }]);
  };

  const handleItemChange = (index, field, value) => {
    const list = [...items];
    list[index][field] = value;

    // Auto-update price when product is selected from helper dropdown
    if (field === 'productId') {
      const selectedProd = products.find(p => p.id === value);
      if (selectedProd) {
        list[index].product_name = selectedProd.name;
        list[index].price = selectedProd.price_retail;
      }
    }

    setItems(list);
  };

  const calculatedTotal = items.reduce((sum, item) => sum + ((parseInt(item.quantity) || 0) * (parseFloat(item.price) || 0)), 0);

  const onSubmit = (e) => {
    e.preventDefault();
    const payload = {
      customer_name: customerName,
      phone,
      address,
      status,
      total: calculatedTotal,
      items: items.map(item => ({
        product_id: item.productId || null,
        product_name: item.product_name,
        quantity: parseInt(item.quantity) || 1,
        price: parseFloat(item.price) || 0
      })),
      custom_specs: {
        brand_name: brandName || null,
        label_size: labelSize || null,
        label_shape: labelShape || null,
        ink_color: inkColor || null,
        label_color: labelColor || null,
        font: font || null
      }
    };
    handleEditOrderSubmit(selectedEditOrder.id, payload);
  };

  return (
    <div className="fixed inset-0 z-50 glass flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-darkbg-card border border-darkbg-border overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-darkbg-border flex items-center justify-between bg-gray-50 dark:bg-gray-850/20">
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-gray-800 dark:text-white">
              ✏️ Edit Rincian Order (Order #{selectedEditOrder.id})
            </h3>
            <p className="text-[10px] text-gray-500 font-semibold">
              Edit data pelanggan, item pesanan, spesifikasi label, status, dan harga.
            </p>
          </div>
          <button 
            type="button"
            onClick={() => { setSelectedEditOrder(null); setEditModalOpen(false); }} 
            className="p-1.5 rounded-xl bg-gray-150 dark:bg-gray-800 text-gray-500 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Content Form */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* CUSTOMER DETAILS */}
          <div className="space-y-4">
            <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Data Pelanggan</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Nama Customer</span>
                <input 
                  type="text" 
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">No Telepon</span>
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-gray-500 font-bold uppercase">Alamat Lengkap</span>
              <textarea 
                rows="2"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* STATUS CONFIG */}
          <div className="space-y-1">
            <span className="text-[9px] text-gray-500 font-bold uppercase">Status Order Board</span>
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none"
            >
              <option value="PENDING">PENDING (Baru/Belum Dikonfirmasi)</option>
              <option value="CONFIRMED">CONFIRMED (Telah Dikonfirmasi)</option>
              <option value="PAID">PAID (Lunas/Sudah Bayar)</option>
              <option value="SHIPPED">SHIPPED (Dalam Pengiriman)</option>
            </select>
          </div>

          {/* ITEMS EDITOR */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Daftar Item / Produk Pesanan</span>
              <button 
                type="button" 
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-[10px] transition flex items-center space-x-1"
              >
                <span>＋ Tambah Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-darkbg-border flex flex-col gap-3 relative">
                  
                  {/* Select catalog helper */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Pilih Dari Katalog (Opsional - Auto-fill)</span>
                      <select 
                        value={item.productId}
                        onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-850 border border-gray-200 dark:border-darkbg-border text-[11px] focus:outline-none"
                      >
                        <option value="">-- Manual Input / Bukan Produk Katalog --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            [{p.category}] {p.name} (Rp {p.price_retail.toLocaleString('id-ID')})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Nama Item Pesanan</span>
                      <input 
                        type="text" 
                        required
                        placeholder="Ketik nama item pesanan..."
                        value={item.product_name}
                        onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-[11px] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    {/* Quantity Input */}
                    <div className="w-full md:w-32 space-y-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Jumlah</span>
                      <input 
                        type="number" 
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-[11px] focus:outline-none"
                      />
                    </div>

                    {/* Unit Price Input */}
                    <div className="w-full md:w-44 space-y-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Harga Satuan (Rp)</span>
                      <input 
                        type="number" 
                        min="0"
                        required
                        value={item.price}
                        onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-[11px] focus:outline-none"
                      />
                    </div>

                    {/* Subtotal Display */}
                    <div className="flex-1 space-y-1 text-right md:text-left">
                      <span className="text-[9px] text-gray-500 font-bold uppercase block">Subtotal</span>
                      <span className="text-xs font-extrabold text-brand-400 block pt-1">
                        Rp {((parseInt(item.quantity) || 0) * (parseFloat(item.price) || 0)).toLocaleString('id-ID')}
                      </span>
                    </div>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition md:self-end md:mb-0.5 self-end"
                    >
                      🗑️
                    </button>
                  </div>

                </div>
              ))}
            </div>
          </div>

          {/* GRAND TOTAL */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-gray-800/40 border border-gray-200 dark:border-darkbg-border">
            <span className="text-xs font-extrabold text-gray-700 dark:text-gray-300">Grand Total Tagihan:</span>
            <span className="text-lg font-black text-brand-400">
              Rp {calculatedTotal.toLocaleString('id-ID')}
            </span>
          </div>

          {/* BRAND SPECIFICATIONS */}
          <div className="space-y-4 pt-2 border-t border-darkbg-border">
            <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide block">Spesifikasi Custom Label / Brand (Opsional)</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Nama Brand</span>
                <input 
                  type="text" 
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Ukuran Label</span>
                <input 
                  type="text" 
                  value={labelSize}
                  onChange={(e) => setLabelSize(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Bentuk</span>
                <input 
                  type="text" 
                  value={labelShape}
                  onChange={(e) => setLabelShape(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Warna Tinta</span>
                <input 
                  type="text" 
                  value={inkColor}
                  onChange={(e) => setInkColor(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Warna Label</span>
                <input 
                  type="text" 
                  value={labelColor}
                  onChange={(e) => setLabelColor(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Font</span>
                <input 
                  type="text" 
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="pt-4 border-t border-darkbg-border flex items-center justify-end space-x-3">
            <button 
              type="button" 
              onClick={() => { setSelectedEditOrder(null); setEditModalOpen(false); }} 
              className="px-4 py-2.5 rounded-xl bg-gray-150 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 font-bold text-xs text-gray-500 dark:text-gray-400 transition"
            >
              Batal
            </button>
            <button 
              type="submit" 
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 font-extrabold text-xs text-white shadow-lg transition"
            >
              💾 Simpan Perubahan
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
