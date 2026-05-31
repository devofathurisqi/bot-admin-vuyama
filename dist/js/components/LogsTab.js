window.LogsTab = ({
  activeTab,
  logs,
  logTerminalRef
}) => {
  if (activeTab !== 'logs') return null;

  return (
    <div className="space-y-6 text-xs text-slate-300">
      <div className="border-b border-darkbg-border pb-5 space-y-1">
        <h2 className="text-xl font-extrabold font-sans text-gray-800 dark:text-white">Bot Realtime Console Log</h2>
        <p className="text-xs text-gray-500 font-medium">Debugging system consoles and automated chat processes.</p>
      </div>

      <div className="p-5 rounded-2xl bg-black border border-gray-800 shadow-xl overflow-hidden flex flex-col justify-between font-mono h-[550px]">
        <div
          ref={logTerminalRef}
          className="flex-1 overflow-y-auto space-y-3.5 pr-2.5 text-xs text-emerald-500"
        >
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-start space-x-2">
              <span className="text-gray-600 font-bold shrink-0">[{new Date(log.timestamp).toLocaleTimeString('id-ID')}]</span>
              <span className={`px-1 py-px rounded text-[8px] font-extrabold uppercase shrink-0 ${log.level === 'error' ? 'bg-red-950/80 text-red-500 border border-red-900/40' : log.level === 'warn' ? 'bg-amber-950/80 text-amber-500 border border-amber-900/40' : 'bg-emerald-950/80 text-emerald-500 border border-emerald-900/40'}`}>
                {log.level}
              </span>
              <p className="flex-1 whitespace-pre-wrap leading-relaxed text-gray-300">{log.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
