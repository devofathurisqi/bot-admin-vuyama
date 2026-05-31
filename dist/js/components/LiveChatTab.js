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
  chatEndRef
}) => {
  if (activeTab !== 'customers') return null;

  return (
    <div className="flex-1 min-h-0 border border-darkbg-border rounded-2xl bg-white dark:bg-darkbg-card overflow-hidden flex shadow-sm text-xs text-gray-800 dark:text-gray-200">
      
      {/* CRM CHAT ROOM: LEFT COLUMN LIST */}
      <div className="w-80 border-r border-darkbg-border flex flex-col shrink-0 overflow-hidden">
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

      {/* CRM CHAT ROOM: MIDDLE CHAT SCREEN */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900/10">
        {activeChat ? (
          <React.Fragment>
            {/* CHAT HEADER */}
            <div className="px-6 py-4 border-b border-darkbg-border flex items-center justify-between bg-white dark:bg-darkbg-card">
              <div>
                <h3 className="font-extrabold text-sm">{customers.find(c => c.phone_number === activeChat)?.name || activeChat}</h3>
                <p className="text-[10px] text-gray-500 font-semibold">{activeChat}</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => togglePinCustomer(activeChat, customers.find(c => c.phone_number === activeChat)?.is_pinned)}
                  className={`p-2 rounded-xl border ${customers.find(c => c.phone_number === activeChat)?.is_pinned ? 'border-brand-500 bg-brand-500/5 text-brand-400' : 'border-darkbg-border text-gray-400 hover:text-white'} transition`}
                  title="Pin/Unpin Chat"
                >
                  <Icons.Pin />
                </button>
                <button
                  onClick={() => handleClearChatHistory(activeChat)}
                  className="p-2 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500 text-rose-400 hover:text-white transition"
                  title="Hapus Riwayat Obrolan"
                >
                  <Icons.Trash />
                </button>
              </div>
            </div>

            {/* CHAT HISTORY STREAM */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'customer' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`p-4 rounded-2xl max-w-sm space-y-1.5 shadow-sm leading-relaxed text-xs border ${msg.sender === 'customer' ? 'bg-white dark:bg-darkbg-card border-gray-100 dark:border-darkbg-border text-gray-800 dark:text-gray-200 rounded-tl-none' : 'bg-brand-600 text-white border-brand-700 rounded-tr-none'}`}>
                    {(() => {
                      const imgMatch = msg.message && msg.message.match(/\[Gambar:\s*(.+?)\]/);
                      const cleanMessage = imgMatch ? msg.message.replace(imgMatch[0], '').trim() : msg.message;
                      return (
                        <React.Fragment>
                          {imgMatch && (
                            <div className="mb-2.5 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 max-h-48 bg-gray-100 flex items-center justify-center">
                              <img src={imgMatch[1].trim()} alt="Sent media" className="object-cover w-full h-full" />
                            </div>
                          )}
                          <p className="whitespace-pre-wrap">{cleanMessage}</p>
                        </React.Fragment>
                      );
                    })()}
                    <div className="text-[9px] font-semibold opacity-60 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* MESSAGE INPUT BOX */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-darkbg-border bg-white dark:bg-darkbg-card flex items-center space-x-3.5">
              <input
                type="text"
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                placeholder="Ketik balasan untuk customer..."
                className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none focus:border-brand-500 transition text-gray-800 dark:text-white"
              />
              <button
                type="submit"
                className="px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition flex items-center justify-center"
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

      {/* CRM CHAT ROOM: RIGHT COLUMN CRM SIDEBAR */}
      {activeChat && (
        <div className="w-72 border-l border-darkbg-border p-5 flex flex-col justify-between shrink-0 overflow-y-auto bg-gray-50 dark:bg-darkbg-card/30">
          <div className="space-y-6">
            {/* PROFILE */}
            <div className="text-center space-y-2 border-b border-darkbg-border pb-5">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center font-bold text-white text-xl shadow mx-auto">
                {customers.find(c => c.phone_number === activeChat)?.name ? customers.find(c => c.phone_number === activeChat).name[0].toUpperCase() : 'W'}
              </div>
              <h3 className="font-extrabold text-sm leading-tight text-gray-850 dark:text-white">{customers.find(c => c.phone_number === activeChat)?.name || 'WhatsApp Customer'}</h3>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-gray-800 text-gray-400 tracking-wider">CRM PROFILE</span>
            </div>

            {/* CRM ACTIONS */}
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

            {/* QUICK BOT AUTO REPLY BLOCK BUTTON */}
            <div className="pt-4 border-t border-darkbg-border">
              {blockedNumbers.some(b => b.phone_number === activeChat) ? (
                <button
                  onClick={() => handleUnblock(activeChat)}
                  className="w-full py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500 text-emerald-400 hover:text-white font-extrabold text-xs transition duration-150"
                >
                  Resume Bot Replies (Unblock)
                </button>
              ) : (
                <button
                  onClick={() => {
                    const reason = prompt('Masukkan alasan mematikan bot:');
                    if (reason !== null) {
                      fetch('/api/blocked-numbers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone_number: activeChat, reason })
                      }).then(() => {
                        fetchBlockedNumbers();
                        fetchCustomers();
                      });
                    }
                  }}
                  className="w-full py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500 text-rose-400 hover:text-white font-extrabold text-xs transition duration-150"
                >
                  Pause Bot Replies (Block)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
