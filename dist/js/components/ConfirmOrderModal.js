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

  return (
    <div className="fixed inset-0 z-50 glass flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-darkbg-card border border-darkbg-border overflow-hidden shadow-2xl flex flex-col">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-darkbg-border flex items-center justify-between bg-gray-50 dark:bg-gray-850/20">
          <h3 className="font-extrabold text-sm text-gray-800 dark:text-white">🎉 Selesaikan & Konfirmasi Pesanan (Order #{selectedConfirmOrder.id})</h3>
          <button onClick={() => { setSelectedConfirmOrder(null); setConfirmModalOpen(false); }} className="p-1 rounded bg-gray-850 text-gray-500 hover:text-white">✕</button>
        </div>

        {/* Modal Content Form */}
        <form onSubmit={handleConfirmPurchaseSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Pilih Produk yang Dibeli</span>
            <select 
              required
              value={confirmForm.productId}
              onChange={(e) => setConfirmForm({ ...confirmForm, productId: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-800 border border-darkbg-border text-xs focus:outline-none"
            >
              <option value="">-- Pilih Produk --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} - Rp {p.price_retail.toLocaleString('id-ID')} (Stok: {p.stock} pcs)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Jumlah Pembelian (Pcs)</span>
              <input 
                type="number" 
                min="1"
                required
                value={confirmForm.quantity}
                onChange={(e) => setConfirmForm({ ...confirmForm, quantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-800 border border-darkbg-border text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Total Pendapatan / Income (Rp)</span>
              <input 
                type="number" 
                required
                value={confirmForm.total}
                onChange={(e) => setConfirmForm({ ...confirmForm, total: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-800 border border-darkbg-border text-xs focus:outline-none"
              />
            </div>
          </div>

          {confirmForm.productId && (
            <div className="text-right text-[10px] text-slate-500 dark:text-gray-400 font-bold">
              Subtotal Otomatis: Rp {((products.find(p => p.id === confirmForm.productId)?.price_retail || 0) * (parseInt(confirmForm.quantity) || 0)).toLocaleString('id-ID')}
            </div>
          )}

          {/* REMARK INPUT */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Remark / Catatan Admin</span>
            <textarea 
              rows="2"
              placeholder="Masukkan catatan tambahan untuk pesanan ini (misal: warna, dropshipper, ongkir, dll)..."
              value={confirmForm.remark || ''}
              onChange={(e) => setConfirmForm({ ...confirmForm, remark: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-800 border border-darkbg-border text-xs focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 leading-relaxed">
            💡 <strong>Info Penyelesaian:</strong> Saat pesanan diselesaikan, stok produk akan otomatis dipotong, status diubah menjadi <strong>COMPLETED</strong>, catatan admin akan ditambahkan, dan <strong>bot WhatsApp akan kembali diizinkan membalas chat customer secara otomatis</strong>.
          </div>

          {/* Actions Footer */}
          <div className="pt-4 border-t border-darkbg-border flex items-center justify-end space-x-3">
            <button type="button" onClick={() => { setSelectedConfirmOrder(null); setConfirmModalOpen(false); }} className="px-4 py-2.5 rounded-xl bg-gray-850 hover:bg-gray-800 font-bold text-xs text-gray-400 transition">Cancel</button>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-extrabold text-xs text-white shadow-lg transition">🎉 Selesaikan & Potong Stok</button>
          </div>
        </form>

      </div>
    </div>
  );
};
