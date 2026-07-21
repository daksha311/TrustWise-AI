import { useCallback, useEffect, useState } from 'react';
import {
  fetchLedgerEvents,
  subscribeToLedgerEvents,
  shortAddr,
  type LedgerEvent,
} from '../web3Service';

function statusColor(status: string) {
  switch (status) {
    case "RELEASED":
      return "#34d399";
    case "REFUNDED":
      return "#38bdf8";
    case "DISPUTED":
      return "#f43f5e";
    case "ACTIVE":
      return "#fbbf24";
    default:
      return "#fbbf24";
  }
}

export default function History() {
  const [rows, setRows] = useState<LedgerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);

  // Upsert by escrow id so settle/dispute events refresh status instead of stacking PENDING rows
  const mergeEvent = useCallback((event: LedgerEvent) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === event.id);
      if (idx === -1) {
        return [event, ...prev];
      }
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        type: event.type,
        status: event.status,
        txHash: event.txHash || next[idx].txHash,
        blockNumber: event.blockNumber || next[idx].blockNumber,
        buyer: event.buyer !== "—" ? event.buyer : next[idx].buyer,
        seller: event.seller !== "—" ? event.seller : next[idx].seller,
        amount: event.amount || next[idx].amount,
      };
      return next;
    });
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const events = await fetchLedgerEvents();
        if (!cancelled) setRows(events);

        unsubscribe = await subscribeToLedgerEvents((event) => {
          if (!cancelled) mergeEvent(event);
        });
        if (!cancelled) setLive(true);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to query Sepolia event logs");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [mergeEvent]);

  return (
    <div style={{ border: '1px solid #222222', padding: '24px', borderRadius: '8px' }}>
      <h3 style={{ color: '#00ff00', fontSize: '1.1rem', marginTop: 0, marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span>[03] HISTORICAL TRANSACTIONS</span>
        <span style={{ fontSize: '0.75rem', color: live ? '#34d399' : '#666666', fontWeight: 400 }}>
          {live ? "● LIVE EVENT FEED" : "○ SYNCING…"}
        </span>
      </h3>
      <p style={{ color: '#666666', fontSize: '0.8rem', marginTop: 0, marginBottom: '20px' }}>
        One row per escrow. Status is live from the contract (ACTIVE → DISPUTED / RELEASED / REFUNDED).
      </p>

      {loading && (
        <p style={{ color: '#888888', fontFamily: 'monospace', fontSize: '0.9rem' }}>
          Querying contract event history…
        </p>
      )}

      {error && (
        <p style={{ color: '#f43f5e', fontFamily: 'monospace', fontSize: '0.9rem' }}>
          {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p style={{ color: '#888888', fontFamily: 'monospace', fontSize: '0.9rem' }}>
          No escrow events found in the recent Sepolia block window.
        </p>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #222222', color: '#666666' }}>
                <th style={{ padding: '12px 8px' }}>ID</th>
                <th style={{ padding: '12px 8px' }}>EVENT</th>
                <th style={{ padding: '12px 8px' }}>BUYER</th>
                <th style={{ padding: '12px 8px' }}>SELLER</th>
                <th style={{ padding: '12px 8px' }}>AMOUNT</th>
                <th style={{ padding: '12px 8px' }}>TX HASH</th>
                <th style={{ padding: '12px 8px' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #111111', color: '#ffffff' }}>
                  <td style={{ padding: '12px 8px', color: '#00ff00' }}>#{row.id}</td>
                  <td style={{ padding: '12px 8px' }}>{row.type}</td>
                  <td style={{ padding: '12px 8px' }} title={row.buyer}>{shortAddr(row.buyer)}</td>
                  <td style={{ padding: '12px 8px' }} title={row.seller}>{shortAddr(row.seller)}</td>
                  <td style={{ padding: '12px 8px' }}>{row.amount}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${row.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#38bdf8', textDecoration: 'none' }}
                      title={row.txHash}
                    >
                      {shortAddr(row.txHash)}
                    </a>
                  </td>
                  <td style={{ padding: '12px 8px', color: statusColor(row.status) }}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
