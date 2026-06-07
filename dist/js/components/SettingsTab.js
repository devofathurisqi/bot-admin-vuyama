window.SettingsTab = ({
  activeTab,
  settings,
  fetchSettings
}) => {
  // Local state for Company profile editing
  const [editingCompanyId, setEditingCompanyId] = React.useState(null);
  const [companyEditForm, setCompanyEditForm] = React.useState({ key: '', label: '', value: '' });
  const [isAddingCompany, setIsAddingCompany] = React.useState(false);
  const [newCompanyForm, setNewCompanyForm] = React.useState({ key: '', label: '', value: '' });

  // Local state for Reseller Program editing
  const [editingResellerId, setEditingResellerId] = React.useState(null);
  const [resellerEditForm, setResellerEditForm] = React.useState({ level: '', min_order: '', price: 0, benefits: '' });
  const [isAddingReseller, setIsAddingReseller] = React.useState(false);
  const [newResellerForm, setNewResellerForm] = React.useState({ level: '', min_order: '', price: 0, benefits: '' });

  if (activeTab !== 'settings') return null;

  // Company Profile Actions
  const handleSaveCompanyEdit = async (id) => {
    if (!companyEditForm.key || !companyEditForm.label || !companyEditForm.value) {
      alert('Semua field wajib diisi!');
      return;
    }
    try {
      const res = await fetch(`/api/settings/company/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyEditForm)
      });
      const d = await res.json();
      if (d.success) {
        setEditingCompanyId(null);
        fetchSettings();
      } else {
        alert(d.error || 'Gagal mengedit parameter.');
      }
    } catch (e) {
      alert('Error mengedit parameter.');
    }
  };

  const handleAddCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyForm.key || !newCompanyForm.label || !newCompanyForm.value) {
      alert('Semua field wajib diisi!');
      return;
    }
    try {
      const res = await fetch('/api/settings/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompanyForm)
      });
      const d = await res.json();
      if (d.success) {
        setNewCompanyForm({ key: '', label: '', value: '' });
        setIsAddingCompany(false);
        fetchSettings();
      } else {
        alert(d.error || 'Gagal menambahkan parameter.');
      }
    } catch (e) {
      alert('Error menambahkan parameter.');
    }
  };

  const handleDeleteCompany = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus parameter perusahaan ini? AI tidak akan bisa membaca info ini lagi.')) return;
    try {
      const res = await fetch(`/api/settings/company/${id}`, {
        method: 'DELETE'
      });
      const d = await res.json();
      if (d.success) {
        fetchSettings();
      } else {
        alert(d.error || 'Gagal menghapus parameter.');
      }
    } catch (e) {
      alert('Error menghapus parameter.');
    }
  };

  // Reseller Program Actions
  const handleSaveResellerEdit = async (id) => {
    if (!resellerEditForm.level || resellerEditForm.price === undefined) {
      alert('Level dan harga wajib diisi!');
      return;
    }
    try {
      const res = await fetch(`/api/settings/reseller/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resellerEditForm)
      });
      const d = await res.json();
      if (d.success) {
        setEditingResellerId(null);
        fetchSettings();
      } else {
        alert(d.error || 'Gagal mengedit level reseller.');
      }
    } catch (e) {
      alert('Error mengedit level reseller.');
    }
  };

  const handleAddReseller = async (e) => {
    e.preventDefault();
    if (!newResellerForm.level || newResellerForm.price === undefined) {
      alert('Level dan harga wajib diisi!');
      return;
    }
    try {
      const res = await fetch('/api/settings/reseller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newResellerForm)
      });
      const d = await res.json();
      if (d.success) {
        setNewResellerForm({ level: '', min_order: '', price: 0, benefits: '' });
        setIsAddingReseller(false);
        fetchSettings();
      } else {
        alert(d.error || 'Gagal menambahkan level reseller.');
      }
    } catch (e) {
      alert('Error menambahkan level reseller.');
    }
  };

  const handleDeleteReseller = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus level reseller ini?')) return;
    try {
      const res = await fetch(`/api/settings/reseller/${id}`, {
        method: 'DELETE'
      });
      const d = await res.json();
      if (d.success) {
        fetchSettings();
      } else {
        alert(d.error || 'Gagal menghapus level reseller.');
      }
    } catch (e) {
      alert('Error menghapus level reseller.');
    }
  };

  return (
    <div className="space-y-8 text-xs text-slate-300">
      
      {/* Header */}
      <div className="border-b border-darkbg-border pb-5 space-y-1">
        <h2 className="text-xl font-extrabold font-sans text-gray-800 dark:text-white">Settings & Database Editor</h2>
        <p className="text-xs text-gray-500 font-medium">Edit system parameters, FAQs, services, and reseller policies live in the database.</p>
      </div>

      {/* ============================================================== */}
      {/* 1. COMPANY PROFILE CARD */}
      {/* ============================================================== */}
      <div className="p-6 rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-darkbg-border pb-3">
          <h3 className="font-extrabold text-base text-gray-850 dark:text-white flex items-center space-x-2">
            <span>🏢 Profile Perusahaan (Company Info)</span>
          </h3>
          <button
            onClick={() => setIsAddingCompany(!isAddingCompany)}
            className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-[10px] transition"
          >
            {isAddingCompany ? '✕ Batal' : '＋ Tambah Parameter'}
          </button>
        </div>

        {/* Add Company Info Form */}
        {isAddingCompany && (
          <form onSubmit={handleAddCompany} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/20 border border-darkbg-border space-y-4 max-w-xl animate-fadeIn text-gray-800 dark:text-gray-250">
            <h4 className="font-extrabold text-[10px] text-brand-500 uppercase tracking-widest">Tambah Parameter Perusahaan</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Key (Sistem)</span>
                <input
                  type="text"
                  required
                  placeholder="Contoh: bank_name, shop_address"
                  value={newCompanyForm.key}
                  onChange={(e) => setNewCompanyForm({ ...newCompanyForm, key: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Label (Tampilan)</span>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Nama Bank, Alamat Toko"
                  value={newCompanyForm.label}
                  onChange={(e) => setNewCompanyForm({ ...newCompanyForm, label: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-gray-500 font-bold uppercase">Value (Nilai)</span>
              <textarea
                required
                rows="2"
                placeholder="Masukkan isi / nilai dari parameter ini..."
                value={newCompanyForm.value}
                onChange={(e) => setNewCompanyForm({ ...newCompanyForm, value: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs resize-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs transition"
            >
              Simpan Parameter
            </button>
          </form>
        )}

        {/* Company Info List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(settings.company || []).map(item => (
            <div key={item.id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-darkbg-border/30 flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1 text-gray-850 dark:text-gray-200 min-w-0">
                
                {editingCompanyId === item.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[8px] text-gray-500 font-bold uppercase">Key</span>
                        <input
                          type="text"
                          value={companyEditForm.key}
                          onChange={(e) => setCompanyEditForm({ ...companyEditForm, key: e.target.value })}
                          className="w-full px-2 py-1 rounded bg-white dark:bg-gray-850 text-xs border"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] text-gray-500 font-bold uppercase">Label</span>
                        <input
                          type="text"
                          value={companyEditForm.label}
                          onChange={(e) => setCompanyEditForm({ ...companyEditForm, label: e.target.value })}
                          className="w-full px-2 py-1 rounded bg-white dark:bg-gray-850 text-xs border"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[8px] text-gray-500 font-bold uppercase">Value</span>
                      <textarea
                        rows="2"
                        value={companyEditForm.value}
                        onChange={(e) => setCompanyEditForm({ ...companyEditForm, value: e.target.value })}
                        className="w-full px-2 py-1 rounded bg-white dark:bg-gray-850 text-xs border resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-[9px] text-brand-400 font-extrabold uppercase tracking-wide block">{item.label} <code className="text-gray-500 text-[8px] lowercase font-normal">({item.key})</code></span>
                    <p className="text-xs font-bold leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{item.value}</p>
                  </div>
                )}
              </div>

              <div className="shrink-0 pt-1.5 flex items-center space-x-1.5">
                {editingCompanyId === item.id ? (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleSaveCompanyEdit(item.id)}
                      className="p-1.5 rounded bg-emerald-600 text-white font-bold text-xs"
                      title="Save"
                    >
                      <Icons.Check />
                    </button>
                    <button
                      onClick={() => setEditingCompanyId(null)}
                      className="p-1.5 rounded bg-gray-600 hover:bg-gray-500 text-white text-xs"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        setEditingCompanyId(item.id);
                        setCompanyEditForm({ key: item.key, label: item.label, value: item.value });
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-750 text-brand-500 dark:text-brand-400 font-bold text-[10px] transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(item.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition"
                      title="Delete"
                    >
                      <Icons.Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. RESELLER PROGRAM LEVELS CARD */}
      {/* ============================================================== */}
      <div className="p-6 rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-darkbg-border pb-3">
          <h3 className="font-extrabold text-base text-gray-850 dark:text-white">📈 Reseller Program Levels (Reseller_Program Sheet)</h3>
          <button
            onClick={() => setIsAddingReseller(!isAddingReseller)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] transition"
          >
            {isAddingReseller ? '✕ Batal' : '＋ Tambah Level'}
          </button>
        </div>

        {/* Add Reseller Tier Form */}
        {isAddingReseller && (
          <form onSubmit={handleAddReseller} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/20 border border-darkbg-border space-y-4 max-w-xl animate-fadeIn text-gray-800 dark:text-gray-250">
            <h4 className="font-extrabold text-[10px] text-indigo-400 uppercase tracking-widest">Tambah Level Reseller Baru</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1 col-span-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Nama Level</span>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Reseller A"
                  value={newResellerForm.level}
                  onChange={(e) => setNewResellerForm({ ...newResellerForm, level: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1 col-span-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Minimal Order</span>
                <input
                  type="text"
                  placeholder="Contoh: 10 pcs"
                  value={newResellerForm.min_order}
                  onChange={(e) => setNewResellerForm({ ...newResellerForm, min_order: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1 col-span-1">
                <span className="text-[9px] text-gray-500 font-bold uppercase">Harga Paket (Rp)</span>
                <input
                  type="number"
                  required
                  placeholder="Contoh: 499000"
                  value={newResellerForm.price}
                  onChange={(e) => setNewResellerForm({ ...newResellerForm, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-gray-500 font-bold uppercase">Fasilitas / Manfaat</span>
              <textarea
                rows="2"
                placeholder="Masukkan list benefit/keuntungan..."
                value={newResellerForm.benefits}
                onChange={(e) => setNewResellerForm({ ...newResellerForm, benefits: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-xs resize-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition"
            >
              Simpan Level
            </button>
          </form>
        )}

        {/* Reseller Tiers Table */}
        <div className="rounded-xl border border-darkbg-border overflow-hidden bg-white dark:bg-darkbg-card">
          <table className="w-full text-left border-collapse text-xs text-gray-800 dark:text-gray-250">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-850/40 text-gray-400 font-bold uppercase border-b border-darkbg-border text-[9px]">
                <th className="p-3.5">Level</th>
                <th className="p-3.5">Minimal Order</th>
                <th className="p-3.5">Harga Paket</th>
                <th className="p-3.5">Fasilitas</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-darkbg-border/60">
              {(settings.reseller || []).map(tier => (
                <tr key={tier.id} className="text-gray-750 dark:text-gray-300 hover:bg-gray-850/10">
                  
                  {editingResellerId === tier.id ? (
                    <React.Fragment>
                      <td className="p-3.5">
                        <input
                          type="text"
                          value={resellerEditForm.level}
                          onChange={(e) => setResellerEditForm({ ...resellerEditForm, level: e.target.value })}
                          className="w-24 px-2 py-1 border rounded text-xs"
                        />
                      </td>
                      <td className="p-3.5">
                        <input
                          type="text"
                          value={resellerEditForm.min_order}
                          onChange={(e) => setResellerEditForm({ ...resellerEditForm, min_order: e.target.value })}
                          className="w-20 px-2 py-1 border rounded text-xs"
                        />
                      </td>
                      <td className="p-3.5">
                        <input
                          type="number"
                          value={resellerEditForm.price}
                          onChange={(e) => setResellerEditForm({ ...resellerEditForm, price: parseFloat(e.target.value) || 0 })}
                          className="w-28 px-2 py-1 border rounded text-xs"
                        />
                      </td>
                      <td className="p-3.5">
                        <textarea
                          rows="2"
                          value={resellerEditForm.benefits}
                          onChange={(e) => setResellerEditForm({ ...resellerEditForm, benefits: e.target.value })}
                          className="w-64 px-2 py-1 border rounded text-xs resize-none"
                        />
                      </td>
                      <td className="p-3.5 text-right space-x-1 flex items-center justify-end">
                        <button
                          onClick={() => handleSaveResellerEdit(tier.id)}
                          className="p-1.5 rounded bg-emerald-600 text-white font-bold text-xs"
                        >
                          <Icons.Check />
                        </button>
                        <button
                          onClick={() => setEditingResellerId(null)}
                          className="p-1.5 rounded bg-gray-600 text-white text-xs"
                        >
                          ✕
                        </button>
                      </td>
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <td className="p-3.5 font-bold">{tier.level}</td>
                      <td className="p-3.5 text-gray-500 font-semibold">{tier.min_order || '-'}</td>
                      <td className="p-3.5 text-indigo-400 font-extrabold">Rp {(parseFloat(tier.price) || 0).toLocaleString('id-ID')}</td>
                      <td className="p-3.5 text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs break-words">{tier.benefits || '-'}</td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => {
                              setEditingResellerId(tier.id);
                              setResellerEditForm({ level: tier.level, min_order: tier.min_order || '', price: parseFloat(tier.price) || 0, benefits: tier.benefits || '' });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-750 text-indigo-400 font-bold text-[10px] transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteReseller(tier.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition"
                          >
                            <Icons.Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </React.Fragment>
                  )}
                  
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
