const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const dataEngine = require("./data_engine");

async function generateSalesReportPDF() {
    // Buscar dados do banco
    const leads = await dataEngine.getLeads();
    const financials = await dataEngine.getFinancialReport();
    const appointments = await dataEngine.getAppointments();

    const outputDir = path.join(process.cwd(), "data", "reports");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const fileName = `relatorio_${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, fileName);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, autoFirstPage: true });
        const stream = fs.createWriteStream(outputPath);

        doc.pipe(stream);
        stream.on("error", reject);
        stream.on("finish", () => resolve(outputPath));

        // ── Cabeçalho ──────────────────────────────────────────────────────
        doc.font("Helvetica-Bold")
           .fontSize(20)
           .text("iAmobil — Relatorio Executivo de Vendas", { align: "center" });

        doc.font("Helvetica")
           .fontSize(10)
           .fillColor("#888888")
           .text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, { align: "center" });

        doc.moveDown(1.5);

        // ── KPIs ────────────────────────────────────────────────────────────
        doc.font("Helvetica-Bold").fontSize(14).fillColor("#000000").text("RESUMO DO NEGOCIO");
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#cccccc").stroke();
        doc.moveDown(0.5);

        const vgv = Number(financials.total_vgv || 0);
        const commission = Number(financials.commission || 0);

        doc.font("Helvetica").fontSize(11).fillColor("#111111");
        doc.text(`Total de Leads Capturados: ${leads.length}`);
        doc.text(`Leads Quentes (Score >= 80): ${financials.lead_count}`);
        doc.text(`VGV Potencial Total: R$ ${vgv.toLocaleString("pt-BR")}`);
        doc.text(`Comissao Estimada (5%): R$ ${commission.toLocaleString("pt-BR")}`);
        doc.text(`Visitas Agendadas: ${appointments.length}`);
        doc.moveDown(1.5);

        // ── Top Leads ───────────────────────────────────────────────────────
        doc.font("Helvetica-Bold").fontSize(14).fillColor("#000000").text("TOP 20 LEADS POR SCORE");
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#cccccc").stroke();
        doc.moveDown(0.5);

        const topLeads = [...leads]
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 20);

        if (topLeads.length === 0) {
            doc.font("Helvetica").fontSize(10).fillColor("#888888").text("Nenhum lead cadastrado ainda.");
        } else {
            topLeads.forEach((lead, i) => {
                doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000")
                   .text(`${i + 1}. ${lead.name || "—"}`);
                doc.font("Helvetica").fontSize(9).fillColor("#444444")
                   .text(`   Tel: ${lead.phone || "—"} | Score: ${lead.score || 0} | Status: ${lead.status || "—"} | Valor: R$ ${Number(lead.potential_value || 0).toLocaleString("pt-BR")}`);
                doc.moveDown(0.3);
            });
        }

        doc.moveDown(1);

        // ── Agendamentos ─────────────────────────────────────────────────────
        if (appointments.length > 0) {
            doc.font("Helvetica-Bold").fontSize(14).fillColor("#000000").text("VISITAS AGENDADAS");
            doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#cccccc").stroke();
            doc.moveDown(0.5);

            appointments.slice(0, 10).forEach(a => {
                doc.font("Helvetica").fontSize(10).fillColor("#111111")
                   .text(`- ${a.lead_name} -> ${a.property_title} | ${a.date_time} [${a.status}]`);
            });

            doc.moveDown(1);
        }

        // ── Rodapé ────────────────────────────────────────────────────────────
        doc.font("Helvetica").fontSize(8).fillColor("#aaaaaa")
           .text("Relatorio gerado automaticamente pelo Sistema iAmobil (c) 2026", { align: "center" });

        doc.end();
    });
}

module.exports = { generateSalesReportPDF };
