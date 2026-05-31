window.ComplaintsTab = ({
  activeTab,
  complaints,
  handleResolveComplaint,
  handleDeleteComplaint
}) => {
  if (activeTab !== 'complaints') return null;

  return (
    <div className="space-y-6 text-xs text-slate-300">
      <div className="border-b border-darkbg-border pb-5 space-y-1">
        <h2 className="text-xl font-extrabold font-sans text-rose-500 flex items-center space-x-2">
          <Icons.AlertCircle />
          <span>Complaints Resolution Center</span>
        </h2>
        <p className="text-xs text-gray-500 font-medium">Automatic system blocks chatbot auto replies for complaint accounts. Click "Resolve" to activate auto responses again.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {complaints.map(comp => (
          <div key={comp.id} className="p-6 rounded-2xl bg-white dark:bg-darkbg-card border border-rose-500/20 shadow-sm space-y-4 flex flex-col justify-between text-gray-850 dark:text-gray-200">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-darkbg-border pb-3">
                <div>
                  <h3 className="font-extrabold text-sm text-gray-850 dark:text-gray-200">Phone: {comp.phone_number}</h3>
                  <span className="text-[10px] text-gray-500 font-semibold">{new Date(comp.created_at).toLocaleString('id-ID')}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${comp.status === 'OPEN' ? 'bg-rose-500/10 text-rose-500 animate-pulse' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  {comp.status}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 text-xs font-semibold text-gray-700 dark:text-gray-300 leading-relaxed italic">
                "{comp.message}"
              </div>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-darkbg-border flex flex-col sm:flex-row gap-2.5">
              {comp.status === 'OPEN' ? (
                <button
                  onClick={() => handleResolveComplaint(comp.id)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-extrabold text-xs text-white transition duration-150"
                >
                  Resolve Problem (Enable Bot CS)
                </button>
              ) : (
                <span className="flex-1 py-2.5 inline-block rounded-xl bg-gray-250 dark:bg-gray-800 font-bold text-[10px] text-gray-500 text-center uppercase tracking-wider flex items-center justify-center">RESOLVED</span>
              )}
              <button
                type="button"
                onClick={() => handleDeleteComplaint(comp.id)}
                className="py-2.5 px-4 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500 hover:text-white text-rose-400 font-extrabold text-xs transition duration-150"
              >
                🗑 Hapus
              </button>
            </div>
          </div>
        ))}
        {complaints.length === 0 && (
          <p className="col-span-full p-12 text-center text-gray-500">Tidak ada komplain aktif.</p>
        )}
      </div>
    </div>
  );
};
