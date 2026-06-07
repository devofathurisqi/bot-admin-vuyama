// Delegate to global Premium Image with Skeleton Loader component
const ImageWithSkeleton = ({ src, alt }) => {
  return (
    <window.ImageWithSkeleton
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      containerClassName="h-32 rounded-xl border border-black/5 dark:border-white/5"
    />
  );
};

window.LiveChatTab = ({
  activeTab,
  customers,
  filteredCustomers,
  activeChat,
  setActiveChat,
  loadChatMessages,
  chatMessages,
  chatSearch,
  setChatSearch,
  typedMessage,
  setTypedMessage,
  handleSendMessage,
  handleClearChatHistory,
  togglePinCustomer,
  handleAssignAdmin,
  handleChangeCustomerStatus,
  blockedNumbers,
  handleUnblock,
  fetchBlockedNumbers,
  fetchCustomers,
  chatEndRef,
  handleChatMediaUpload,
  orders,
  handleSendInvoicePdf,
  handleSendWelcomePdf
}) => {
  // Local state for sidebar visibility on tablet/mobile
  const [showSidebar, setShowSidebar] = React.useState(false);
  const fileInputRef = React.useRef(null);

  const [selectedWelcomeLevel, setSelectedWelcomeLevel] = React.useState('Reseller A');
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = React.useState('');

  // Find customer's orders
  const normalizedActiveChat = activeChat ? activeChat.replace('@c.us', '') : '';
  const customerOrders = React.useMemo(() => {
    if (!activeChat || !orders) return [];
    return orders.filter(o => {
      const oPhone = o.phone_number ? o.phone_number.replace('@c.us', '') : '';
      const oPhone2 = o.phone ? o.phone.replace(/[^0-9]/g, '') : '';
      return oPhone === normalizedActiveChat || oPhone2 === normalizedActiveChat;
    });
  }, [activeChat, orders, normalizedActiveChat]);

  // Sync selected order when customerOrders updates
  React.useEffect(() => {
    if (customerOrders.length > 0) {
      setSelectedInvoiceOrder(customerOrders[0].id.toString());
    } else {
      setSelectedInvoiceOrder('');
    }
  }, [customerOrders]);

  if (activeTab !== 'customers') return null;


  // Parse message content to render images and document links nicely
  const renderMessageContent = (msgText) => {
    if (!msgText) return null;

    let text = msgText;
    let images = [];
    let documents = [];

    // Parse [Gambar: ...]
    const imgRegex = /\[Gambar:\s*(.+?)\]/g;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(msgText)) !== null) {
      const paths = imgMatch[1].split(',').map(p => p.trim()).filter(Boolean);
      images.push(...paths);
      text = text.replace(imgMatch[0], '');
    }

    // Parse [Dokumen: ...]
    const docRegex = /\[Dokumen:\s*(.+?)\]/g;
    let docMatch;
    while ((docMatch = docRegex.exec(msgText)) !== null) {
      const paths = docMatch[1].split(',').map(p => p.trim()).filter(Boolean);
      documents.push(...paths);
      text = text.replace(docMatch[0], '');
    }

    // Clean up extra spacing
    text = text.trim();

    return (
      <div className="space-y-2">
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 max-w-xs">
            {images.map((img, idx) => (
              <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition">
                <ImageWithSkeleton src={img} alt="Sent image" />
              </a>
            ))}
          </div>
        )}
        {documents.length > 0 && (
          <div className="space-y-1.5 max-w-xs">
            {documents.map((doc, idx) => {
              const filename = doc.split('/').pop();
              return (
                <a
                  key={idx}
                  href={doc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-750 text-brand-600 dark:text-brand-400 font-bold transition break-all text-[11px]"
                >
                  <span className="text-sm">📄</span>
                  <span className="underline truncate">{filename}</span>
                </a>
              );
            })}
          </div>
        )}
        {text.length > 0 && <p className="whitespace-pre-wrap">{text}</p>}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 border border-darkbg-border rounded-2xl bg-white dark:bg-darkbg-card overflow-hidden flex shadow-sm text-xs text-gray-800 dark:text-gray-250 relative">
      
      {/* ==================== LEFT COLUMN: CONTACTS LIST ==================== */}
      <div className={`w-full md:w-80 border-r border-darkbg-border flex flex-col shrink-0 overflow-hidden ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-darkbg-border space-y-3.5 bg-gray-50 dark:bg-gray-800/20">
          <h3 className="font-extrabold text-base text-gray-800 dark:text-white">WhatsApp Chats</h3>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500"><Icons.Search /></span>
            <input
              type="text"
              placeholder="Quick Search..."
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none focus:border-brand-500 transition text-gray-800 dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-darkbg-border/60">
          {filteredCustomers.map(c => (
            <div
              key={c.phone_number}
              onClick={() => {
                setActiveChat(c.phone_number);
                loadChatMessages(c.phone_number);
                setShowSidebar(false); // Hide sidebar drawer when changing chats
              }}
              className={`p-4 flex items-start space-x-3.5 hover:bg-gray-800/10 dark:hover:bg-gray-800/30 cursor-pointer transition duration-150 relative ${activeChat === c.phone_number ? 'bg-gray-100 dark:bg-gray-800/40 border-l-4 border-brand-500' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-700 to-gray-800 flex items-center justify-center font-bold text-white shrink-0 shadow">
                {c.name ? c.name[0].toUpperCase() : 'W'}
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs truncate max-w-[120px]">{c.name || c.phone_number.split('@')[0]}</h4>
                  <span className="text-[9px] text-gray-500 font-semibold">{new Date(c.last_message_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <p className="text-[10px] text-gray-500 truncate">{c.phone_number.split('@')[0]}</p>

                <div className="flex flex-wrap items-center gap-1.5">
                  {c.is_pinned && (
                    <span className="text-brand-400"><Icons.Pin /></span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${c.status === 'COMPLAINT' || c.status === 'WAITING_HUMAN' ? 'bg-rose-500/10 text-rose-500' : c.status === 'ORDER_CONFIRMED' ? 'bg-emerald-500/10 text-emerald-500' : c.status === 'ORDER_PENDING' ? 'bg-amber-500/10 text-amber-500' : 'bg-gray-500/10 text-gray-400'}`}>
                    {c.status}
                  </span>
                  {c.assigned_to && (
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-indigo-500/10 text-indigo-400">
                      👤 {c.assigned_to}
                    </span>
                  )}
                </div>
              </div>

              {c.unread_count > 0 && (
                <span className="absolute top-4 right-4 w-4 h-4 rounded-full bg-brand-500 text-white font-extrabold text-[8px] flex items-center justify-center animate-bounce">
                  {c.unread_count}
                </span>
              )}
            </div>
          ))}
          {filteredCustomers.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-12">Tidak ada chat.</p>
          )}
        </div>
      </div>

      {/* ==================== MIDDLE COLUMN: CHAT STREAM ==================== */}
      <div className={`flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900/10 ${activeChat ? 'flex' : 'hidden md:flex'}`}>
        {activeChat ? (
          <React.Fragment>
            {/* CHAT HEADER */}
            <div className="px-6 py-4 border-b border-darkbg-border flex items-center justify-between bg-white dark:bg-darkbg-card">
              <div className="flex items-center min-w-0">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setActiveChat(null)}
                  className="mr-3 p-2.5 rounded-xl border border-darkbg-border text-gray-500 dark:text-gray-400 hover:bg-gray-150 dark:hover:bg-gray-800 md:hidden"
                  title="Kembali ke Kontak"
                >
                  ←
                </button>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm truncate">{customers.find(c => c.phone_number === activeChat)?.name || activeChat}</h3>
                  <p className="text-[10px] text-gray-500 font-semibold truncate">{activeChat}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Mobile Info toggle */}
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className={`p-2.5 rounded-xl border lg:hidden ${showSidebar ? 'border-brand-500 bg-brand-500/10 text-brand-400' : 'border-darkbg-border text-gray-500 dark:text-gray-400'}`}
                  title="Detail Info Pelanggan"
                >
                  ℹ
                </button>
                <button
                  onClick={() => togglePinCustomer(activeChat, customers.find(c => c.phone_number === activeChat)?.is_pinned)}
                  className={`p-2.5 rounded-xl border ${customers.find(c => c.phone_number === activeChat)?.is_pinned ? 'border-brand-500 bg-brand-500/5 text-brand-400' : 'border-darkbg-border text-gray-400 hover:text-white'} transition`}
                  title="Pin/Unpin Chat"
                >
                  <Icons.Pin />
                </button>
                <button
                  onClick={() => handleClearChatHistory(activeChat)}
                  className="p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500 text-rose-450 hover:text-white transition"
                  title="Hapus Riwayat Obrolan"
                >
                  <Icons.Trash />
                </button>
              </div>
            </div>

            {/* CHAT BUBBLES */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map(msg => {
                const isCust = msg.sender === 'customer';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isCust ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`p-4 rounded-2xl max-w-[85%] md:max-w-md space-y-1.5 shadow-sm leading-relaxed text-xs border ${isCust ? 'bg-white dark:bg-darkbg-card border-gray-100 dark:border-darkbg-border text-gray-800 dark:text-gray-200 rounded-tl-none' : 'bg-brand-600 text-white border-brand-700 rounded-tr-none'}`}>
                      {renderMessageContent(msg.message)}
                      <div className="text-[9px] font-semibold opacity-60 text-right">
                        {new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* CHAT INPUT FORM */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-darkbg-border bg-white dark:bg-darkbg-card flex items-center space-x-2.5">
              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="p-3 rounded-xl border border-darkbg-border text-gray-500 dark:text-gray-400 hover:bg-gray-150 dark:hover:bg-gray-800 transition flex items-center justify-center shrink-0"
                title="Kirim Gambar / PDF"
              >
                📎
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleChatMediaUpload}
                className="hidden"
                accept="image/*,application/pdf"
              />

              <input
                type="text"
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                placeholder="Ketik balasan untuk customer..."
                className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none focus:border-brand-500 transition text-gray-800 dark:text-white"
              />
              <button
                type="submit"
                className="px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition flex items-center justify-center shrink-0"
              >
                <Icons.Send />
              </button>
            </form>
          </React.Fragment>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-500">
            <Icons.Customers />
            <h4 className="mt-4 font-bold text-sm">Belum Ada Chat Terpilih</h4>
            <p className="text-xs text-gray-500 max-w-xs mt-1">Pilih salah satu customer di panel kiri untuk membuka live chat WhatsApp secara real-time.</p>
          </div>
        )}
      </div>

      {/* ==================== BACKDROP OVERLAY FOR SIDEBAR IN MOBILE ==================== */}
      {showSidebar && (
        <div
          onClick={() => setShowSidebar(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* ==================== RIGHT COLUMN: CUSTOMER CRM INFO ==================== */}
      {activeChat && (
        <div className={`
          w-72 shrink-0 flex-col justify-between overflow-y-auto border-l border-darkbg-border bg-gray-50 dark:bg-darkbg-card p-5
          ${showSidebar ? 'fixed inset-y-0 right-0 z-50 w-80 bg-white dark:bg-darkbg-card shadow-2xl flex animate-slide-in' : 'hidden lg:flex'}
        `}>
          <div className="space-y-6">
            {/* Drawer Close Button on mobile */}
            {showSidebar && (
              <div className="flex justify-end lg:hidden">
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-white"
                >
                  ✕
                </button>
              </div>
            )}

            {/* PROFILE DETAILS */}
            <div className="text-center space-y-2 border-b border-darkbg-border pb-5">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center font-bold text-white text-xl shadow mx-auto">
                {customers.find(c => c.phone_number === activeChat)?.name ? customers.find(c => c.phone_number === activeChat).name[0].toUpperCase() : 'W'}
              </div>
              <h3 className="font-extrabold text-sm leading-tight text-gray-850 dark:text-white truncate">{customers.find(c => c.phone_number === activeChat)?.name || 'WhatsApp Customer'}</h3>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 tracking-wider">CRM PROFILE</span>
            </div>

            {/* ASSIGNMENTS */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Assign Admin</span>
                <select
                  value={customers.find(c => c.phone_number === activeChat)?.assigned_to || ''}
                  onChange={(e) => handleAssignAdmin(activeChat, e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border font-bold text-xs focus:outline-none transition text-gray-800 dark:text-white"
                >
                  <option value="">Belum Ditugaskan</option>
                  <option value="Admin Vuyama 1">Admin Vuyama 1</option>
                  <option value="Admin Vuyama 2">Admin Vuyama 2</option>
                  <option value="Supervisor CS">Supervisor CS</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Chatbot Auto-Reply Status</span>
                <select
                  value={customers.find(c => c.phone_number === activeChat)?.status || ''}
                  onChange={(e) => handleChangeCustomerStatus(activeChat, e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border font-bold text-xs focus:outline-none transition text-gray-800 dark:text-white"
                >
                  <option value="NORMAL">NORMAL (Bot CS Aktif)</option>
                  <option value="ORDER_PENDING">ORDER PENDING</option>
                  <option value="ORDER_CONFIRMED">ORDER CONFIRMED</option>
                  <option value="WAITING_HUMAN">WAITING HUMAN (Bot CS Mati)</option>
                </select>
              </div>
            </div>

            {/* BOT CONTROL PANEL */}
            <div className="pt-4 border-t border-darkbg-border space-y-3">
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide block">Bot CS Handoff Control</span>
              
              {(() => {
                const customer = customers.find(c => c.phone_number === activeChat);
                if (!customer) return null;

                const isBlocked = blockedNumbers.some(b => b.phone_number === activeChat);
                const isPaused = customer.paused_until && new Date(customer.paused_until) > new Date();
                const isTransactional = ['ORDER_PENDING', 'ORDER_CONFIRMED', 'COMPLAINT'].includes(customer.status);

                let pauseTimeLeft = '';
                if (isPaused) {
                  const diffMs = new Date(customer.paused_until) - new Date();
                  const hours = Math.floor(diffMs / (1000 * 60 * 60));
                  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                  pauseTimeLeft = `${hours}j ${minutes}m`;
                }

                if (isBlocked) {
                  return (
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2.5 text-center">
                      <div className="flex items-center justify-center space-x-1.5 text-rose-500 font-bold">
                        <span>🚫</span>
                        <span>Bot Mati (Permanen)</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-normal">Nomor ini diblokir dari balasan otomatis bot secara manual.</p>
                      <button
                        onClick={() => handleUnblock(activeChat)}
                        className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] transition duration-150"
                      >
                        Aktifkan Bot Kembali
                      </button>
                    </div>
                  );
                }

                if (isTransactional) {
                  return (
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2.5 text-center">
                      <div className="flex items-center justify-center space-x-1.5 text-rose-500 font-bold">
                        <span>🚫</span>
                        <span>Bot Mati (CS Manusia Aktif)</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-normal">Bot dinonaktifkan secara otomatis karena customer sedang bertransaksi / komplain.</p>
                      <button
                        onClick={() => handleChangeCustomerStatus(activeChat, 'NORMAL')}
                        className="w-full py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-[10px] transition duration-150"
                      >
                        Serahkan ke Bot (Status Normal)
                      </button>
                    </div>
                  );
                }

                if (isPaused) {
                  return (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2.5 text-center">
                      <div className="flex items-center justify-center space-x-1.5 text-amber-500 font-bold">
                        <span>⏳</span>
                        <span>Bot Terjeda ({pauseTimeLeft})</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-normal">Bot terjeda sementara karena ada intervensi manual dari HP / Live Chat.</p>
                      <button
                        onClick={() => handleChangeCustomerStatus(activeChat, 'NORMAL', null)}
                        className="w-full py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-[10px] transition duration-150"
                      >
                        Aktifkan Bot CS Sekarang
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2.5 text-center">
                    <div className="flex items-center justify-center space-x-1.5 text-emerald-500 font-bold">
                      <span>✅</span>
                      <span>Bot CS Aktif</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-normal">Bot otomatis membalas jika customer mengirimkan pesan.</p>
                    <button
                      onClick={() => {
                        const pausedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
                        handleChangeCustomerStatus(activeChat, 'WAITING_HUMAN', pausedUntil);
                      }}
                      className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[10px] transition duration-150"
                    >
                      Jeda Bot (12 Jam)
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* MANUAL DOCUMENTS PANEL */}
            <div className="pt-4 border-t border-darkbg-border space-y-4">
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide block">Manual PDF Documents</span>
              
              {/* Send Welcome PDF */}
              <div className="space-y-1.5 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                <span className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wide block">Panduan Reseller</span>
                <div className="flex gap-2">
                  <select
                    value={selectedWelcomeLevel}
                    onChange={(e) => setSelectedWelcomeLevel(e.target.value)}
                    className="flex-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border font-semibold text-[10px] focus:outline-none transition text-gray-800 dark:text-white"
                  >
                    <option value="Reseller A">Level A</option>
                    <option value="Reseller B">Level B</option>
                    <option value="Reseller C">Level C</option>
                    <option value="Reseller D">Level D</option>
                    <option value="Reseller E">Level E</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleSendWelcomePdf(activeChat, selectedWelcomeLevel)}
                    className="px-3 py-1 rounded-lg bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-[10px] transition"
                  >
                    🎓 Send
                  </button>
                </div>
              </div>

              {/* Send Invoice PDF */}
              <div className="space-y-1.5 p-3 rounded-xl bg-brand-500/5 border border-brand-500/10">
                <span className="text-[9px] text-brand-400 font-extrabold uppercase tracking-wide block">Invoice Pesanan</span>
                {customerOrders.length > 0 ? (
                  <div className="flex gap-2">
                    <select
                      value={selectedInvoiceOrder}
                      onChange={(e) => setSelectedInvoiceOrder(e.target.value)}
                      className="flex-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border font-semibold text-[10px] focus:outline-none transition text-gray-800 dark:text-white"
                    >
                      {customerOrders.map(o => (
                        <option key={o.id} value={o.id}>
                          #{o.id} - Rp {o.total.toLocaleString('id-ID')}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleSendInvoicePdf(parseInt(selectedInvoiceOrder))}
                      className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-[10px] transition"
                    >
                      📄 Send
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-500 italic">Belum ada pesanan terdaftar.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
