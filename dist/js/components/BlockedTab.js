window.BlockedTab = ({
  activeTab,
  blockedNumbers,
  handleBlockManual,
  handleUnblock
}) => {
  if (activeTab !== 'blocked') return null;

  return (
    <div className="space-y-6 text-xs text-slate-300">
      <div className="flex items-center justify-between border-b border-darkbg-border pb-5">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold font-sans text-gray-800 dark:text-white">Blocked WhatsApp Numbers</h2>
          <p className="text-xs text-gray-500 font-medium">Numbers in this list will be completely ignored by the chatbot. Admin handle manually.</p>
        </div>

        <button
          onClick={handleBlockManual}
          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-500/15 flex items-center space-x-2 transition"
        >
          <Icons.Plus />
          <span>Block Number</span>
        </button>
      </div>

      <div className="rounded-2xl border border-darkbg-border bg-white dark:bg-darkbg-card overflow-hidden shadow-sm text-gray-800 dark:text-gray-250">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/40 text-gray-400 font-bold uppercase tracking-wider border-b border-darkbg-border">
              <th className="p-4">Phone Number</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Blocked Date</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-darkbg-border/60">
            {blockedNumbers.map(item => (
              <tr key={item.phone_number} className="hover:bg-gray-800/10 text-gray-700 dark:text-gray-300">
                <td className="p-4 font-bold">{item.phone_number}</td>
                <td className="p-4 text-gray-400 font-medium">{item.reason || 'Manual Admin Block'}</td>
                <td className="p-4 text-gray-500 font-semibold">{new Date(item.created_at).toLocaleString('id-ID')}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => handleUnblock(item.phone_number)}
                    className="px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500 text-emerald-400 hover:text-white font-extrabold transition"
                  >
                    Unblock / Resume Bot
                  </button>
                </td>
              </tr>
            ))}
            {blockedNumbers.length === 0 && (
              <tr>
                <td colSpan="4" className="p-8 text-center text-gray-500">Tidak ada nomor diblokir.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
