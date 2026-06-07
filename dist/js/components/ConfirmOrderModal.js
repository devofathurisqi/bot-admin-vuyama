window.ConfirmOrderModal = ({ 
  confirmModalOpen, 
  setConfirmModalOpen, 
  selectedConfirmOrder, 
  setSelectedConfirmOrder, 
  confirmForm, 
  setConfirmForm, 
  products, 
  handleConfirmPurchaseSubmit 
}) => {
  if (!confirmModalOpen || !selectedConfirmOrder) return null;

  const [items, setItems] = React.useState([{ productId: '', quantity: 1, price: 0 }]);

  // Initialize items from order items or default empty item
  React.useEffect(() => {
    if (selectedConfirmOrder) {
      if (selectedConfirmOrder.items && selectedConfirmOrder.items.length > 0) {
        setItems(selectedConfirmOrder.items.map(item => ({
          productId: item.product_id || '',
          quantity: item.quantity || 1,
          price: item.price || 0
        })));
      } else {
        // Try parsing product from pesanan_raw if possible, else default empty
        setItems([{ productId: '', quantity: 1, price: 0 }]);
      }
    }
  }, [selectedConfirmOrder]);

  // Sync state to parent confirmForm
  const calculatedTotal = items.reduce((sum, item) => sum + ((parseInt(item.quantity) || 0) * (parseFloat(item.price) || 0)), 0);

  React.useEffect(() => {
    setConfirmForm(prev => ({
      ...prev,
      items,
      total: calculatedTotal
    }));
  }, [items, calculatedTotal]);

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 1, price: 0 }]);
  };

  const handleRemoveItem = (index) => {
    const list = [...items];
    list.splice(index, 1);
    setItems(list.length > 0 ? list : [{ productId: '', quantity: 1, price: 0 }]);
  };

  const handleItemChange = (index, field, value) => {
    const list = [...items];
    list[index][field] = value;

    // Auto-update price when product is selected
    if (field === 'productId') {
      const selectedProd = products.find(p => p.id === value);
      if (selectedProd) {
        // Default to retail price
        list[index].price = selectedProd.price_retail;
      }
    }

    setItems(list);
  };

  return (
    <div className="fixed inset-0 z-50 glass flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-darkbg-card border border-darkbg-border overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-darkbg-border flex items-center justify-between bg-gray-50 dark:bg-gray-850/20">
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-gray-800 dark:text-white">
              🎉 Selesaikan & Konfirmasi Pesanan (Order #{selectedConfirmOrder.id})
            </h3>
            <p className="text-[10px] text-gray-500 font-semibold">
              Customer: {selectedConfirmOrder.customer_name} ({selectedConfirmOrder.phone})
            </p>
          </div>
          <button 
            type="button"
            onClick={() => { setSelectedConfirmOrder(null); setConfirmModalOpen(false); }} 
            className="p-1.5 rounded-xl bg-gray-150 dark:bg-gray-800 text-gray-500 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Content Form */}
        <form onSubmit={handleConfirmPurchaseSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* CUSTOMER DRAFT REFERENCE */}
          {selectedConfirmOrder.pesanan_raw && (
            <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-1">
              <span className="text-[8px] text-amber-500 font-extrabold uppercase tracking-wider">Format Catatan Pesanan Awal</span>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {selectedConfirmOrder.pesanan_raw}
              </p>
            </div>
          )}

          {/* POS MULTI-ITEM SELECTION PANEL */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Daftar Produk yang Dibeli</span>
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
                <div key={idx} className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-darkbg-border flex flex-col md:flex-row md:items-center gap-3 relative">
                  
                  {/* Product Dropdown */}
                  <div className="flex-1 space-y-1">
                    <span className="text-[9px] text-gray-500 font-bold uppercase">Produk</span>
                    <select 
                      required
                      value={item.productId}
                      onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none"
                    >
                      <option value="">-- Pilih Produk --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          [{p.category}] {p.name} (Stok: {p.stock} pcs)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity Input */}
                  <div className="w-full md:w-24 space-y-1">
                    <span className="text-[9px] text-gray-500 font-bold uppercase">Jumlah (Pcs)</span>
                    <input 
                      type="number" 
                      min="1"
                      required
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none"
                    />
                  </div>

                  {/* Unit Price Input */}
                  <div className="w-full md:w-36 space-y-1">
                    <span className="text-[9px] text-gray-500 font-bold uppercase">Harga Satuan (Rp)</span>
                    <input 
                      type="number" 
                      min="0"
                      required
                      value={item.price}
                      onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none"
                    />
                  </div>

                  {/* Subtotal Display */}
                  <div className="w-full md:w-28 space-y-1 text-right md:text-left">
                    <span className="text-[9px] text-gray-500 font-bold uppercase block">Subtotal</span>
                    <span className="text-xs font-extrabold text-brand-400 block pt-1.5">
                      Rp {((parseInt(item.quantity) || 0) * (parseFloat(item.price) || 0)).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1 rounded bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition md:self-end md:mb-1 self-end"
                  >
                    🗑️
                  </button>

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

          {/* REMARK INPUT */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Remark / Catatan Admin</span>
            <textarea 
              rows="2"
              placeholder="Masukkan catatan tambahan untuk pesanan ini (misal: warna, dropshipper, ongkir, dll)..."
              value={confirmForm.remark || ''}
              onChange={(e) => setConfirmForm({ ...confirmForm, remark: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 leading-relaxed">
            💡 <strong>Info Penyelesaian:</strong> Saat pesanan diselesaikan, stok produk akan otomatis dipotong, status diubah menjadi <strong>COMPLETED</strong>, catatan admin akan ditambahkan, dan <strong>bot WhatsApp akan kembali diizinkan membalas chat customer secara otomatis</strong>.
          </div>

          {/* Actions Footer */}
          <div className="pt-4 border-t border-darkbg-border flex items-center justify-end space-x-3">
            <button 
              type="button" 
              onClick={() => { setSelectedConfirmOrder(null); setConfirmModalOpen(false); }} 
              className="px-4 py-2.5 rounded-xl bg-gray-150 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 font-bold text-xs text-gray-500 dark:text-gray-400 transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-extrabold text-xs text-white shadow-lg transition"
            >
              🎉 Selesaikan & Potong Stok
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
