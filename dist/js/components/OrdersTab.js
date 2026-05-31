window.OrdersTab = ({
  activeTab,
  orders,
  orderSubTab,
  setOrderSubTab,
  products,
  setSelectedConfirmOrder,
  setConfirmForm,
  setConfirmModalOpen,
  handleUpdateOrderTotal,
  handleUpdateOrderStatus,
  handleDeleteOrder
}) => {
  if (activeTab !== 'orders') return null;

  const filteredOrders = orderSubTab === 'semua'
    ? orders
    : orders.filter(o => o.status === orderSubTab);

  return (
    <div className="space-y-6 text-xs text-slate-300">
      <div className="border-b border-darkbg-border pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold font-sans text-gray-800 dark:text-white">Orders Monitoring</h2>
          <p className="text-xs text-gray-500 font-medium">Automatic parsed orders from customer. Set total prices and update orders statuses.</p>
        </div>

        {/* STATS OVERVIEW FOR SUBTABS */}
        <div className="flex items-center space-x-2 text-[10px] font-extrabold text-gray-400">
          <span>Total: <strong className="text-gray-200">{orders.length}</strong></span>
          <span>•</span>
          <span className="text-amber-500">Pending: <strong>{orders.filter(o => o.status === 'PENDING').length}</strong></span>
          <span>•</span>
          <span className="text-indigo-400">Confirmed: <strong>{orders.filter(o => o.status === 'CONFIRMED').length}</strong></span>
          <span>•</span>
          <span className="text-emerald-500">Paid: <strong>{orders.filter(o => o.status === 'PAID').length}</strong></span>
          <span>•</span>
          <span className="text-blue-400">Shipped: <strong>{orders.filter(o => o.status === 'SHIPPED').length}</strong></span>
        </div>
      </div>

      {/* SLICK SUBTABS NAVIGATION BAR */}
      <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-gray-100 dark:bg-gray-800/40 border border-gray-200 dark:border-darkbg-border/60 max-w-4xl">
        {[
          { id: 'semua', label: 'Semua', count: orders.length },
          { id: 'PENDING', label: 'Pending (Baru)', count: orders.filter(o => o.status === 'PENDING').length, color: 'text-amber-500 bg-amber-500/10' },
          { id: 'CONFIRMED', label: 'Confirmed (Dikonfirmasi)', count: orders.filter(o => o.status === 'CONFIRMED').length, color: 'text-indigo-400 bg-indigo-500/10' },
          { id: 'PAID', label: 'Paid (Lunas)', count: orders.filter(o => o.status === 'PAID').length, color: 'text-emerald-500 bg-emerald-500/10' },
          { id: 'SHIPPED', label: 'Shipped (Dikirim)', count: orders.filter(o => o.status === 'SHIPPED').length, color: 'text-blue-400 bg-blue-500/10' },
          { id: 'COMPLETED', label: 'Completed (Selesai)', count: orders.filter(o => o.status === 'COMPLETED').length, color: 'text-emerald-400 bg-emerald-500/10' },
          { id: 'CANCELLED', label: 'Cancelled (Batal)', count: orders.filter(o => o.status === 'CANCELLED').length, color: 'text-rose-500 bg-rose-500/10' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setOrderSubTab(tab.id)}
            className={`flex items-center space-x-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition duration-150 ${orderSubTab === tab.id
                ? 'bg-white dark:bg-gray-800 text-brand-400 shadow-md font-extrabold border border-darkbg-border/40'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-800/20'
              }`}
          >
            <span>{tab.label}</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${tab.color || 'bg-gray-200 dark:bg-gray-850 text-gray-500 dark:text-gray-400'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ORDER GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredOrders.map(order => (
          <div key={order.id} className="p-5 rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition text-gray-850 dark:text-gray-200">
            
            {/* ORDER META */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-darkbg-border pb-2.5">
                <span className="text-xs font-bold text-brand-400">Order ID: #{order.id}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${order.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 animate-pulse' : order.status === 'CONFIRMED' ? 'bg-indigo-500/10 text-indigo-400' : order.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : order.status === 'SHIPPED' ? 'bg-blue-500/10 text-blue-400' : order.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {order.status}
                </span>
              </div>

              <h3 className="font-extrabold text-sm">{order.customer_name}</h3>
              <span className="text-[10px] text-gray-500 font-semibold">{order.phone}</span>
            </div>

            {/* SPECS AND PURCHASE */}
            <div className="space-y-3 p-3.5 bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-darkbg-border/30 rounded-xl">
              <div className="space-y-1 border-b border-darkbg-border/40 pb-2 text-gray-800 dark:text-gray-300">
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">Produk & Pesanan</span>
                <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap">{order.pesanan_raw}</p>
              </div>

              {/* Label custom specs if filled */}
              {order.brand_name && (
                <div className="space-y-1 pt-1 text-[10px]">
                  <span className="text-[8px] text-brand-400 font-bold uppercase tracking-wide">Brand & Label Specs</span>
                  <div className="grid grid-cols-2 gap-1.5 leading-relaxed text-gray-400">
                    <span>Brand: <strong className="text-gray-800 dark:text-gray-200">{order.brand_name}</strong></span>
                    <span>Size: <strong className="text-gray-800 dark:text-gray-200">{order.label_size}</strong></span>
                    <span>Bentuk: <strong className="text-gray-800 dark:text-gray-200">{order.label_shape}</strong></span>
                    <span>Warna Tinta: <strong className="text-gray-800 dark:text-gray-200">{order.ink_color}</strong></span>
                    <span>Label: <strong className="text-gray-800 dark:text-gray-200">{order.label_color}</strong></span>
                    <span>Font: <strong className="text-gray-800 dark:text-gray-200">{order.font}</strong></span>
                  </div>
                </div>
              )}
            </div>

            {/* TOTAL & ACTIONS */}
            <div className="space-y-3 pt-3 border-t border-darkbg-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-semibold">Total Price:</span>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-sm text-brand-400">Rp {order.total.toLocaleString('id-ID')}</span>
                  {order.status !== 'COMPLETED' && (
                    <button onClick={() => handleUpdateOrderTotal(order.id)} className="p-1 rounded bg-gray-800 dark:bg-gray-850 hover:bg-gray-700 text-gray-400 hover:text-white transition">
                      ✎
                    </button>
                  )}
                </div>
              </div>

              {['PENDING', 'CONFIRMED', 'PAID', 'SHIPPED'].includes(order.status) && (
                <div className="pb-1.5">
                  <button 
                    onClick={() => {
                      setSelectedConfirmOrder(order);
                      setConfirmForm({ 
                        productId: products[0]?.id || '', 
                        quantity: 1, 
                        total: order.total || 0,
                        remark: '' 
                      });
                      setConfirmModalOpen(true);
                    }}
                    className="w-full py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white font-extrabold text-xs transition flex items-center justify-center space-x-1.5 shadow-sm"
                  >
                    <span>🎉 Selesaikan Pesanan</span>
                  </button>
                </div>
              )}

              {order.status !== 'COMPLETED' && (
                <div className="space-y-1.5">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">Update Order Status</span>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <button onClick={() => handleUpdateOrderStatus(order.id, 'CONFIRMED')} className="py-1.5 rounded-lg border border-brand-500/20 bg-brand-500/5 hover:bg-brand-500 font-extrabold transition">Confirm</button>
                    <button onClick={() => handleUpdateOrderStatus(order.id, 'PAID')} className="py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500 font-extrabold transition">Paid</button>
                    <button onClick={() => handleUpdateOrderStatus(order.id, 'SHIPPED')} className="py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500 font-extrabold transition">Shipped</button>
                    <button onClick={() => handleUpdateOrderStatus(order.id, 'CANCELLED')} className="py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500 font-extrabold transition">Cancel</button>
                  </div>
                </div>
              )}

              <div className="pt-2.5 border-t border-dashed border-gray-100 dark:border-darkbg-border/60">
                <button
                  onClick={() => handleDeleteOrder(order.id)}
                  className="w-full py-2 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500 hover:text-white text-rose-400 font-extrabold text-[10px] transition"
                >
                  🗑 Hapus Order
                </button>
              </div>
            </div>

          </div>
        ))}
        {filteredOrders.length === 0 && (
          <p className="col-span-full p-12 text-center text-gray-500">Tidak ada pesanan dengan status ini.</p>
        )}
      </div>
    </div>
  );
};
