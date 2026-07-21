interface DashboardProps {
  walletAddress: string;
  contractDetails: string;
  statusMessage: string;
  totalEscrows: number;
  activeVaults: number;
  disputedAssets: number;
}

export default function Dashboard({
  walletAddress,
  contractDetails,
  statusMessage,
  totalEscrows,
  activeVaults,
  disputedAssets,
}: DashboardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ border: '1px solid #222222', padding: '16px 20px', borderRadius: '6px' }}>
          <span style={{ color: '#666666', display: 'block', fontSize: '0.8rem', marginBottom: '6px' }}>AUTHENTICATED SIGNER LINK</span>
          <strong style={{ color: '#00ff00', fontSize: '0.95rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>{walletAddress || "Not Connected"}</strong>
        </div>

        <div style={{ border: '1px solid #222222', padding: '16px 20px', borderRadius: '6px' }}>
          <span style={{ color: '#666666', display: 'block', fontSize: '0.8rem', marginBottom: '6px' }}>ON-CHAIN BYTECODE METRICS</span>
          <code style={{ color: '#00ff00', fontSize: '0.95rem', fontFamily: 'monospace' }}>{contractDetails}</code>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
        {[
          { label: "Total Escrows", val: String(totalEscrows), color: "#00ff00" },
          { label: "Active Vaults", val: String(activeVaults), color: "#38bdf8" },
          { label: "Disputed Assets", val: String(disputedAssets), color: "#f43f5e" },
        ].map((stat, idx) => (
          <div key={idx} style={{ border: '1px solid #222222', padding: '16px', borderRadius: '6px', textAlign: 'center' }}>
            <span style={{ color: '#666666', display: 'block', fontSize: '0.75rem', marginBottom: '4px' }}>{stat.label}</span>
            <span style={{ color: stat.color, fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{stat.val}</span>
          </div>
        ))}
      </div>

      {statusMessage && (
        <div style={{ padding: '14px', borderRadius: '4px', backgroundColor: '#000000', border: '1px solid #333333', fontSize: '0.9rem', color: '#cbd5e1', fontFamily: 'monospace' }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}
