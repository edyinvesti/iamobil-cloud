const fs = require("fs");
const path = require("path");

class MultiposterEngine {
    constructor() {
        this.basePath = path.join(process.cwd(), "data");
        this.propertiesPath = path.join(this.basePath, "partner_properties.json");
    }

    async getProperties() {
        try {
            if (!fs.existsSync(this.propertiesPath)) return [];
            const raw = fs.readFileSync(this.propertiesPath, "utf8");
            return JSON.parse(raw);
        } catch (err) {
            console.error("[Multiposter] Error reading properties:", err.message);
            return [];
        }
    }

    /**
     * Gera um XML no padrão Zap / VivaReal / Grupo OLX
     */
    async generatePortalXML() {
        const properties = await this.getProperties();
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<ListingDataFeed xmlns="http://www.viva-real.com/schemas/1.0/VRSync" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n`;
        xml += `  <Header>\n`;
        xml += `    <Provider>iAmobil</Provider>\n`;
        xml += `    <Email>vendas@iamobil.com.br</Email>\n`;
        xml += `    <ContactName>Edy Diretor</ContactName>\n`;
        xml += `  </Header>\n`;
        xml += `  <Listings>\n`;

        properties.forEach(p => {
            xml += `    <Listing>\n`;
            xml += `      <ListingID>${p.submittedAt || Date.now()}</ListingID>\n`;
            xml += `      <Title><![CDATA[${p.title}]]></Title>\n`;
            xml += `      <TransactionType>For Sale</TransactionType>\n`;
            xml += `      <DetailViewUrl>https://iamobil.com.br/imovel/${p.submittedAt}</DetailViewUrl>\n`;
            xml += `      <Media>\n`;
            xml += `        <Item medium="image" caption="Fachada">https://iamobil.com.br/assets/placeholder_property.jpg</Item>\n`;
            xml += `      </Media>\n`;
            xml += `      <Details>\n`;
            xml += `        <Usage>Residential</Usage>\n`;
            xml += `        <PropertyType>Apartment</PropertyType>\n`;
            xml += `        <Description><![CDATA[${p.description}]]></Description>\n`;
            xml += `        <ListPrice currency="BRL">${p.price}</ListPrice>\n`;
            xml += `        <LivingArea unit="square metres">${p.size}</LivingArea>\n`;
            xml += `        <Bedrooms>${p.bedrooms}</Bedrooms>\n`;
            xml += `        <Bathrooms>${p.suites}</Bathrooms>\n`;
            xml += `        <Garage>${p.parkingSpaces}</Garage>\n`;
            xml += `        <Features>\n`;
            (p.amenities || []).forEach(a => {
                xml += `          <Feature>${a}</Feature>\n`;
            });
            xml += `        </Features>\n`;
            xml += `      </Details>\n`;
            xml += `      <Location displayAddress="All">\n`;
            xml += `        <Address><![CDATA[${p.address}]]></Address>\n`;
            xml += `        <City>Goiânia</City>\n`;
            xml += `        <State>GO</State>\n`;
            xml += `      </Location>\n`;
            xml += `    </Listing>\n`;
        });

        xml += `  </Listings>\n`;
        xml += `</ListingDataFeed>`;

        return xml;
    }

    /**
     * Gera payloads simplificados para integração via API / Webhook (Instagram, TikTok, etc)
     */
    async generateSocialPayloads() {
        const properties = await this.getProperties();
        return properties.map(p => ({
            platform_hint: "Instagram/TikTok",
            caption: `${p.title} 🔥\n\n${p.description}\n\n📍 ${p.address}\n💰 R$ ${p.price.toLocaleString('pt-BR')}\n\n#iamobil #imoveisdeluxo #bueno`,
            media_url: "https://iamobil.com.br/assets/placeholder_property.jpg",
            cta: "Link na Bio"
        }));
    }

    async saveXMLFeed() {
        const xml = await this.generatePortalXML();
        const outputPath = path.join(process.cwd(), "public", "feeds", "zap_vivareal.xml");
        if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, xml, "utf8");
        return { ok: true, path: "/feeds/zap_vivareal.xml" };
    }
}

module.exports = new MultiposterEngine();
