window.SettingsTab = ({
  activeTab,
  settings,
  editingSetting,
  setEditingSetting,
  settingValue,
  setSettingValue,
  handleSaveSetting
}) => {
  if (activeTab !== 'settings') return null;

  return (
    <div className="space-y-8 text-xs text-slate-300">
      <div className="border-b border-darkbg-border pb-5 space-y-1">
        <h2 className="text-xl font-extrabold font-sans text-gray-800 dark:text-white">Settings & Database Editor</h2>
        <p className="text-xs text-gray-500 font-medium">Edit system parameters, FAQs, services, and reseller policies live in the database.</p>
      </div>

      {/* 1. Company Profile In-line Forms */}
      <div className="p-6 rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border shadow-sm space-y-6">
        <h3 className="font-extrabold text-base border-b border-darkbg-border pb-3 text-gray-850 dark:text-white">🏢 Profile Perusahaan (Company Sheet)</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {settings.company.map(item => (
            <div key={item.id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-darkbg-border/30 flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1 text-gray-850 dark:text-gray-200">
                <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">{item.label}</span>
                {editingSetting?.id === item.id ? (
                  <input
                    type="text"
                    value={settingValue}
                    onChange={(e) => setSettingValue(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-850 border border-brand-500 text-xs focus:outline-none"
                  />
                ) : (
                  <p className="text-xs font-bold leading-relaxed text-gray-700 dark:text-gray-300 truncate max-w-[200px]" title={item.value}>{item.value}</p>
                )}
              </div>

              <div className="shrink-0">
                {editingSetting?.id === item.id ? (
                  <div className="flex items-center space-x-1.5">
                    <button onClick={handleSaveSetting} className="p-2 rounded bg-emerald-600 text-white font-bold text-xs"><Icons.Check /></button>
                    <button onClick={() => setEditingSetting(null)} className="p-2 rounded bg-gray-700 text-gray-400 text-xs">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingSetting(item);
                      setSettingValue(item.value);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-750 text-brand-500 dark:text-brand-400 font-extrabold text-[10px]"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Reseller Programs */}
      <div className="p-6 rounded-2xl bg-white dark:bg-darkbg-card border border-gray-100 dark:border-darkbg-border shadow-sm space-y-6">
        <h3 className="font-extrabold text-base border-b border-darkbg-border pb-3 text-gray-850 dark:text-white">📈 Reseller Program Levels (Reseller_Program Sheet)</h3>

        <div className="rounded-xl border border-darkbg-border overflow-hidden">
          <table className="w-full text-left border-collapse text-xs text-gray-800 dark:text-gray-200">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-850/40 text-gray-400 font-bold uppercase border-b border-darkbg-border">
                <th className="p-3.5">Level</th>
                <th className="p-3.5">Minimal Order</th>
                <th className="p-3.5">Discount Tiers</th>
                <th className="p-3.5">Facilities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-darkbg-border/60">
              {settings.reseller.map(tier => (
                <tr key={tier.id} className="text-gray-750 dark:text-gray-300 hover:bg-gray-850/10">
                  <td className="p-3.5 font-bold">{tier.level}</td>
                  <td className="p-3.5 text-gray-500 dark:text-gray-350 font-semibold">{tier.min_order}</td>
                  <td className="p-3.5 text-brand-600 dark:text-brand-400 font-bold">{tier.discount}</td>
                  <td className="p-3.5 text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs truncate" title={tier.benefits}>{tier.benefits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
