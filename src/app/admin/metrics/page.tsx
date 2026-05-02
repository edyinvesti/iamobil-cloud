"use client";

import { useEffect, useState } from "react";

interface Metrics {
  published: number;
  pending: number;
  totalValuePending: number;
  total: number;
  recent: { id: string; title?: string; address?: string; price?: number; receivedAt?: string }[];
}

function KpiCard({ icon, label, value, sub, accent }: { icon: string; label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div style={{
      background: "#0d1117", border: `1px solid ${accent}22`, borderRadius: 18,
      padding: "28px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 40, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: accent, marginTop: 8, fontWeight: 600 }}>{sub}</div>}
      <div style={{ position: "absolute", bottom: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `${accent}18` }} />
    </div>
  );
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => r.json())
      .then((d) => { setMetrics(d); setLoading(false); })
      .catch(() => setLoading(false));
    const iv = setInterval(() => {
      fetch("/api/metrics").then((r) => r.json()).then(setMetrics).catch(() => {});
    }, 20000);
    return () => clearInterval(iv);
  }, []);

  // Bar chart visual simples
  const publishedPct = metrics ? Math.round((metrics.published / Math.max(metrics.total, 1)) * 100) : 0;
  const pendingPct = metrics ? Math.round((metrics.pending / Math.max(metrics.total, 1)) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#04060a", color: "#e2e8f0", fontFamily: "system-ui,sans-serif" }}>
      {/* Header */}
      <header style={{
        background: "rgba(5,9,18,0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "20px 36px", display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📊</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>Dashboard de Métricas</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>iAmobil — Visão Operacional em Tempo Real</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/catalog" style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", textDecoration: "none", fontSize: 13 }}>📋 Catálogo</a>
          <a href="/admin/approval" style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", textDecoration: "none", fontSize: 13 }}>⚖️ Aprovação</a>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#475569" }}>Carregando métricas...</div>
        ) : !metrics ? (
          <div style={{ textAlign: "center", padding: 80, color: "#475569" }}>Erro ao carregar dados.</div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 36 }}>
              <KpiCard icon="🏘️" label="Total de Imóveis" value={metrics.total} sub="no ecossistema" accent="#6366f1" />
              <KpiCard icon="✅" label="Publicados" value={metrics.published} sub={`${publishedPct}% do total`} accent="#10b981" />
              <KpiCard icon="⏳" label="Aguardando" value={metrics.pending} sub={metrics.pending > 0 ? "Requerem ação" : "Fila vazia"} accent="#f59e0b" />
              <KpiCard
                icon="💰"
                label="V. Pendente"
                value={`R$${(metrics.totalValuePending / 1e6).toFixed(1)}M`}
                sub="em avaliação"
                accent="#38bdf8"
              />
            </div>

            {/* Barra de progresso visual */}
            <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 28, marginBottom: 32 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Distribuição do Portfólio</div>
              <div style={{ display: "flex", height: 16, borderRadius: 999, overflow: "hidden", gap: 2, marginBottom: 12 }}>
                <div style={{ flex: publishedPct, background: "linear-gradient(90deg,#10b981,#059669)", minWidth: publishedPct > 0 ? 4 : 0, transition: "flex 1s" }} />
                <div style={{ flex: pendingPct, background: "linear-gradient(90deg,#f59e0b,#d97706)", minWidth: pendingPct > 0 ? 4 : 0, transition: "flex 1s" }} />
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: "#10b981" }} />
                  <span style={{ color: "#94a3b8" }}>Publicados ({publishedPct}%)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: "#f59e0b" }} />
                  <span style={{ color: "#94a3b8" }}>Pendentes ({pendingPct}%)</span>
                </div>
              </div>
            </div>

            {/* Últimos imóveis recebidos */}
            <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 28 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Últimas Entradas na Fila</div>
              {metrics.recent.length === 0 ? (
                <div style={{ color: "#334155", textAlign: "center", padding: 32, fontSize: 14 }}>Nenhum imóvel na fila ainda.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {metrics.recent.map((r) => (
                    <div key={r.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "14px 20px",
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>{r.title || "Sem título"}</div>
                        <div style={{ color: "#475569", fontSize: 13, marginTop: 2 }}>📍 {r.address || "—"}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800, color: "#10b981", fontSize: 16 }}>R$ {Number(r.price || 0).toLocaleString("pt-BR")}</div>
                        <div style={{ color: "#334155", fontSize: 11, marginTop: 2 }}>
                          {r.receivedAt ? new Date(r.receivedAt).toLocaleString("pt-BR") : "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <a href="/admin/approval" style={{ display: "block", marginTop: 20, textAlign: "center", color: "#6366f1", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                Ir para o Painel de Aprovação →
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
