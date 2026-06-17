// Broadcast Tab component for sending bulk announcements
window.BroadcastTab = ({ activeTab, showToast }) => {
  if (activeTab !== 'broadcast') return null;

  const [chats, setChats] = React.useState([]);
  const [loadingChats, setLoadingChats] = React.useState(false);
  const [targetType, setTargetType] = React.useState('all_contacts'); // all_contacts, all_groups, manual
  const [selectedJids, setSelectedJids] = React.useState({});
  const [searchQuery, setSearchQuery] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [file, setFile] = React.useState(null);
  const [sending, setSending] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState('');

  const fileInputRef = React.useRef(null);

  // Load active chats on mount
  const fetchChats = async () => {
    setLoadingChats(true);
    try {
      const res = await fetch('/api/whatsapp/chats');
      const d = await res.json();
      if (d.success) {
        setChats(d.data);
      }
    } catch (e) {
      showToast('Gagal memuat daftar chat WhatsApp.', 'error');
    } finally {
      setLoadingChats(false);
    }
  };

  React.useEffect(() => {
    fetchChats();
  }, []);

  // Filter chats based on query
  const filteredChats = React.useMemo(() => {
    return chats.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const jidMatch = c.id.toLowerCase().includes(searchQuery.toLowerCase());
      return nameMatch || jidMatch;
    });
  }, [chats, searchQuery]);

  // Handle manual JID toggling
  const handleToggleJid = (jid) => {
    setSelectedJids(prev => ({
      ...prev,
      [jid]: !prev[jid]
    }));
  };

  const handleToggleSelectAll = (action) => {
    if (action === 'select_all') {
      const next = {};
      filteredChats.forEach(c => {
        next[c.id] = true;
      });
      setSelectedJids(next);
    } else {
      setSelectedJids({});
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!message.trim() && !file) {
      showToast('Pesan atau attachment wajib diisi untuk melakukan broadcast.', 'error');
      return;
    }

    // Determine JIDs list based on targetType
    let targetJids = [];
    if (targetType === 'all_contacts') {
      targetJids = chats.filter(c => !c.isGroup && !c.isReadOnly).map(c => c.id);
    } else if (targetType === 'all_groups') {
      targetJids = chats.filter(c => c.isGroup && !c.isReadOnly).map(c => c.id);
    } else {
      targetJids = Object.keys(selectedJids).filter(jid => selectedJids[jid]);
    }

    if (targetJids.length === 0) {
      showToast('Tidak ada penerima yang dipilih.', 'error');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin mengirim pesan broadcast ke ${targetJids.length} penerima?`)) return;

    setSending(true);
    setStatusMessage('Mempersiapkan broadcast...');

    const formData = new FormData();
    formData.append('message', message);
    formData.append('recipients', JSON.stringify(targetJids));
    if (file) {
      formData.append('file', file);
    }

    try {
      const res = await fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        body: formData
      });
      const d = await res.json();
      if (d.success) {
        showToast(`Suksess! Broadcast sedang dikirim ke ${targetJids.length} nomor di background.`);
        setMessage('');
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setSelectedJids({});
      } else {
        showToast(d.error || 'Gagal mengirim broadcast.', 'error');
      }
    } catch (err) {
      showToast('Error mengirim broadcast.', 'error');
    } finally {
      setSending(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-darkbg-border pb-5">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-gray-800 dark:text-white flex items-center gap-2">
            <span>📢</span> WhatsApp Broadcast Hub
          </h2>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-1">Kirim pengumuman massal ke kontak dan grup secara aman</p>
        </div>
        <button
          onClick={fetchChats}
          className="px-3.5 py-2 text-xs font-bold rounded-xl border border-darkbg-border bg-white dark:bg-darkbg-card hover:bg-gray-150 dark:hover:bg-gray-800 transition flex items-center gap-2"
          disabled={loadingChats}
        >
          🔄 {loadingChats ? 'Memuat...' : 'Refresh Chat'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: COMPOSER */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleSendBroadcast} className="p-5 border border-darkbg-border rounded-2xl bg-white dark:bg-darkbg-card shadow-sm space-y-5">
            <h3 className="font-extrabold text-sm border-b border-darkbg-border pb-3 flex items-center gap-2">
              ✏️ Tulis Pesan Broadcast
            </h3>

            {/* Target Radio Selection */}
            <div className="space-y-2.5">
              <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide block">Target Penerima</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-darkbg-border bg-gray-50/40 dark:bg-gray-900/10 cursor-pointer hover:border-brand-500 transition">
                  <input
                    type="radio"
                    name="targetType"
                    value="all_contacts"
                    checked={targetType === 'all_contacts'}
                    onChange={(e) => setTargetType(e.target.value)}
                    className="accent-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <span className="font-bold text-xs block">Semua Nomor/Chat Pribadi</span>
                    <span className="text-[10px] text-gray-500">
                      Kirim ke semua chat pribadi ({chats.filter(c => !c.isGroup && !c.isReadOnly).length} chat)
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-darkbg-border bg-gray-50/40 dark:bg-gray-900/10 cursor-pointer hover:border-brand-500 transition">
                  <input
                    type="radio"
                    name="targetType"
                    value="all_groups"
                    checked={targetType === 'all_groups'}
                    onChange={(e) => setTargetType(e.target.value)}
                    className="accent-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <span className="font-bold text-xs block">Semua Grup WhatsApp</span>
                    <span className="text-[10px] text-gray-500">
                      Kirim ke semua grup aktif ({chats.filter(c => c.isGroup && !c.isReadOnly).length} grup)
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-darkbg-border bg-gray-50/40 dark:bg-gray-900/10 cursor-pointer hover:border-brand-500 transition">
                  <input
                    type="radio"
                    name="targetType"
                    value="manual"
                    checked={targetType === 'manual'}
                    onChange={(e) => setTargetType(e.target.value)}
                    className="accent-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <span className="font-bold text-xs block">Pilih Chat Secara Manual</span>
                    <span className="text-[10px] text-gray-500">Tentukan kontak atau grup tertentu di kolom kanan</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Message Draft */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide block">Isi Pesan</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ketik pengumuman atau promo yang ingin Anda broadcast..."
                rows={6}
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-250 dark:border-darkbg-border text-xs focus:outline-none focus:border-brand-500 transition text-gray-800 dark:text-white"
              />
            </div>

            {/* Optional Attachment */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide block">Attachment Gambar / PDF (Opsional)</label>
              {file ? (
                <div className="flex items-center justify-between p-3 rounded-xl border border-brand-500/20 bg-brand-500/5 text-brand-600 dark:text-brand-400 font-bold">
                  <div className="flex items-center space-x-2 truncate">
                    <span>📄</span>
                    <span className="truncate text-xs">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="p-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 transition"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className="w-full py-4 rounded-xl border border-dashed border-gray-250 dark:border-darkbg-border bg-gray-50/40 dark:bg-gray-800/20 text-gray-500 hover:text-brand-500 hover:border-brand-500 transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="text-lg">📎</span>
                  <span className="text-[10px] font-bold">Unggah Gambar atau Dokumen PDF</span>
                </button>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,application/pdf"
                className="hidden"
              />
            </div>

            {/* Broadcast action button */}
            <button
              type="submit"
              disabled={sending}
              className={`w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold transition shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2 ${sending ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span>📢</span>
              <span>{sending ? 'Mengirim Broadcast...' : 'Kirim Broadcast'}</span>
            </button>

            {statusMessage && (
              <p className="text-[11px] text-brand-500 font-bold text-center animate-pulse mt-2">{statusMessage}</p>
            )}
          </form>
        </div>

        {/* RIGHT PANEL: RECIPIENTS (Manual Selection) */}
        <div className="lg:col-span-7">
          <div className={`p-5 border border-darkbg-border rounded-2xl bg-white dark:bg-darkbg-card shadow-sm space-y-4 flex flex-col h-[520px] relative transition-opacity duration-300 ${targetType !== 'manual' ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="border-b border-darkbg-border pb-3 flex items-center justify-between shrink-0">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                👥 Pilih Kontak & Grup ({Object.values(selectedJids).filter(Boolean).length} terpilih)
              </h3>
              {targetType === 'manual' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll('select_all')}
                    className="px-2.5 py-1 text-[9px] font-bold rounded-lg border border-darkbg-border bg-gray-50 dark:bg-gray-800 hover:bg-gray-150 dark:hover:bg-gray-700 transition"
                  >
                    Pilih Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll('clear')}
                    className="px-2.5 py-1 text-[9px] font-bold rounded-lg border border-darkbg-border bg-gray-50 dark:bg-gray-800 hover:bg-gray-150 dark:hover:bg-gray-700 transition"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            {/* Quick Search */}
            <div className="relative shrink-0">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                disabled={targetType !== 'manual'}
                placeholder="Cari nama kontak atau grup..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-darkbg-border text-xs focus:outline-none focus:border-brand-500 transition text-gray-800 dark:text-white"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-darkbg-border/60">
              {loadingChats ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                  <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mb-3"></div>
                  <p className="text-xs">Memuat data chat dari WhatsApp...</p>
                </div>
              ) : filteredChats.length > 0 ? (
                filteredChats.map(c => {
                  const isChecked = !!selectedJids[c.id];
                  return (
                    <div
                      key={c.id}
                      onClick={() => targetType === 'manual' && handleToggleJid(c.id)}
                      className={`py-3.5 px-3 flex items-center justify-between cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800/30 transition rounded-xl ${isChecked ? 'bg-brand-500/5' : ''}`}
                    >
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className={`w-8 h-8 rounded-full font-bold text-white shrink-0 flex items-center justify-center text-xs shadow-sm bg-gradient-to-tr ${c.isGroup ? 'from-indigo-600 to-blue-500' : 'from-brand-600 to-indigo-500'}`}>
                          {c.isGroup ? '👥' : (c.name ? c.name[0].toUpperCase() : 'W')}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs truncate block">{c.name}</span>
                          <span className="text-[9px] text-gray-500 truncate block">{c.id.split('@')[0]}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2.5">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide ${c.isGroup ? 'bg-indigo-500/10 text-indigo-500' : 'bg-brand-500/10 text-brand-500'}`}>
                          {c.isGroup ? 'Grup' : 'Pribadi'}
                        </span>
                        {targetType === 'manual' && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-brand-600 focus:ring-brand-500 accent-brand-600"
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-gray-500 text-center py-20">Tidak ditemukan chat WhatsApp aktif.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
