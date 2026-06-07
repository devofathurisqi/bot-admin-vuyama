window.DashboardTab = ({
  activeTab,
  customers,
  orders,
  complaints,
  products,
  botStatus,
  logs,
  fetchLogs
}) => {
  if (activeTab !== 'dashboard') return null;

  const lowStockProducts = (products || []).filter(p => p.stock < 15);

  return (
    <div className="space-y-6 text-xs text-slate-300">
      {/* HERO BANNER */}
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-indigo-700 text-white flex flex-col md:flex-row items-center justify-between relative overflow-hidden shadow-xl shadow-brand-500/10">
        <div className="space-y-2.5 relative z-10">
          <h2 className="text-2xl md:text-3xl font-extrabold font-sans leading-tight text-white">Vuyama CS Control Suite</h2>
          <p className="text-brand-100 text-sm max-w-lg">WhatsApp Bot & human admin collaboration dashboard. View live messages, manage products, manage orders, and check complaints from a unified hub.</p>
        </div>

        {/* Decorative abstract elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl transform translate-x-20 -translate-y-20" />
      </div>

      {/* QUICK STATS CARDS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border flex flex-col justify-between shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Live Chat CRM</span>
          <div className="mt-2.5 flex items-baseline justify-between text-gray-800 dark:text-white">
            <span className="text-3xl font-extrabold">{customers.length}</span>
            <span className="text-xs text-brand-400 font-bold">Total Contacts</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border flex flex-col justify-between shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Pending Orders</span>
          <div className="mt-2.5 flex items-baseline justify-between text-gray-800 dark:text-white">
            <span className="text-3xl font-extrabold text-amber-500">{orders.filter(o => o.status === 'PENDING').length}</span>
            <span className="text-xs text-amber-400 font-bold">Needs Review</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border flex flex-col justify-between shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Active Complaints</span>
          <div className="mt-2.5 flex items-baseline justify-between text-gray-800 dark:text-white">
            <span className="text-3xl font-extrabold text-rose-500">{complaints.filter(c => c.status === 'OPEN').length}</span>
            <span className="text-xs text-rose-450 font-bold">Requires Action</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border flex flex-col justify-between shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total Products</span>
          <div className="mt-2.5 flex items-baseline justify-between text-gray-800 dark:text-white">
            <span className="text-3xl font-extrabold text-brand-500">{products.length}</span>
            <span className="text-xs text-brand-400 font-bold">In DB</span>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTIONS: WA STATUS, LOW STOCK & LIVE FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* WHATSAPP CONNECTION STATUS PANEL */}
        <div className="lg:col-span-1 p-6 rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border flex flex-col justify-between shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-darkbg-border pb-3">
              <h3 className="font-extrabold text-base text-gray-800 dark:text-white">WhatsApp Bot Status</h3>
              <div className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${botStatus.status === 'connected' ? 'bg-emerald-500/10 text-emerald-500' : botStatus.status === 'scanning' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {botStatus.status}
              </div>
            </div>

            {/* DISPLAY QR CODE IF SCANNING */}
            {botStatus.status === 'scanning' && botStatus.qr ? (
              <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-inner border border-gray-100 max-w-xs mx-auto">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(botStatus.qr)}`} alt="Scan QR Code" className="w-48 h-48" />
                <p className="mt-4 text-[10px] font-semibold text-gray-500 text-center leading-relaxed">Pindai kode QR menggunakan WhatsApp di handphone Anda untuk menghubungkan bot CS.</p>
              </div>
            ) : botStatus.status === 'connected' ? (
              <div className="flex flex-col items-center justify-center p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-3.5">
                <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <h4 className="font-extrabold text-sm text-emerald-500 uppercase tracking-wider">Bot Aktif & Siap CS</h4>
                <p className="text-[10px] font-medium text-gray-400 text-center max-w-xs leading-relaxed">Bot dan manusia menggunakan 1 nomor yang sama. Bot membalas otomatis dan admin membalas live chat.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-3.5">
                <div className="w-16 h-16 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h4 className="font-extrabold text-sm text-rose-500 uppercase tracking-wider">Bot Terputus</h4>
                <p className="text-[10px] font-medium text-gray-400 text-center max-w-xs leading-relaxed">Menunggu inisialisasi server WhatsApp. Jika QR Code muncul, segera pindai.</p>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-darkbg-border pt-4 text-center">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Powered by whatsapp-web.js</span>
          </div>
        </div>

        {/* LOW STOCK WARNING PANEL */}
        <div className="lg:col-span-1 p-6 rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border flex flex-col justify-between shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-darkbg-border pb-3">
              <h3 className="font-extrabold text-base text-gray-800 dark:text-white">Low Stock Warning</h3>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${lowStockProducts.length > 0 ? 'bg-rose-500/10 text-rose-500 animate-pulse' : 'bg-emerald-500/10 text-emerald-500'}`}>
                {lowStockProducts.length} Alert
              </span>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {lowStockProducts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 text-gray-800 dark:text-gray-200">
                  <div className="space-y-1">
                    <span className="text-xs font-bold block truncate max-w-[120px]">{p.name}</span>
                    <span className="block text-[8px] text-gray-500 font-semibold uppercase tracking-wider">{p.category}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-rose-500">{p.stock} pcs</span>
                    <span className="block text-[8px] text-gray-500 font-semibold">Limit: 15</span>
                  </div>
                </div>
              ))}
              {lowStockProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-emerald-500 space-y-2">
                  <span className="text-2xl">✅</span>
                  <p className="text-xs font-bold text-center">Stok semua produk aman!</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-darkbg-border pt-4 text-center">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Stock Threshold Limit &lt; 15</span>
          </div>
        </div>

        {/* LIVE AUDIT ACTIVITY LOGS */}
        <div className="lg:col-span-1 p-6 rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border flex flex-col justify-between shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-darkbg-border pb-3">
              <h3 className="font-extrabold text-base text-gray-800 dark:text-white">Live Activity Streams</h3>
              <button onClick={fetchLogs} className="p-1 rounded-lg text-gray-400 hover:text-white transition">
                <Icons.Refresh />
              </button>
            </div>

            <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
              {logs.slice(0, 5).map((log, idx) => (
                <div key={idx} className="flex items-start space-x-3.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-darkbg-border/30">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 ${log.level === 'error' ? 'bg-rose-500/10 text-rose-500' : log.level === 'warn' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                    {log.level}
                  </span>
                  <div className="flex-1 space-y-1 text-gray-800 dark:text-gray-200">
                    <p className="text-xs font-semibold leading-relaxed">{log.message}</p>
                    <span className="text-[9px] text-gray-500 font-semibold">{new Date(log.timestamp).toLocaleTimeString('id-ID')}</span>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-6">Tidak ada aktivitas terdaftar.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
