import LogViewer from '../components/LogViewer.jsx';

export default function Logs() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Logs</h1>
        <p className="text-sm text-ink-500">Live output from <code className="font-mono">journalctl -u cloudflared</code>.</p>
      </div>
      <LogViewer />
    </div>
  );
}
