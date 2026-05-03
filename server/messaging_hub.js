const TelegramBot = require('node-telegram-bot-api');
const WebSocket = require('ws');
const googleTTS = require('google-tts-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const ragEngine = require('./rag_engine');
const { generateSalesReportPDF } = require('./report_generator');

// Carregar variáveis de ambiente
require('dotenv').config();

const HERMES_WS_URL = process.env.HERMES_WS_URL || 'ws://127.0.0.1:18789';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const DEBUG_LOG = path.join(process.cwd(), "logs", "hub_debug.log");
if (!fs.existsSync(path.join(process.cwd(), "logs"))) {
    fs.mkdirSync(path.join(process.cwd(), "logs"), { recursive: true });
}
function logDebug(msg) {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(DEBUG_LOG, entry, "utf8");
    console.log(msg);
}

// Carregar Identidade do Edy
function loadIdentity(folder = "edy") {
    const identityPath = path.join(process.cwd(), "agents", folder, "IDENTITY.md");
    if (!fs.existsSync(identityPath)) return {};
    const content = fs.readFileSync(identityPath, "utf8");
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const identity = {};
    for (let i = 0; i < lines.length; i += 2) {
        if (lines[i] && lines[i + 1]) {
            identity[lines[i].toLowerCase()] = lines[i + 1];
        }
    }
    return identity;
}
const identity = loadIdentity();
const AGENT_NAME = identity.name || "Edy";
const AGENT_ROLE = identity.role || "Gerente";
const AGENT_EMOJI = identity.emoji || "👔";

let ws;
const pendingRequests = new Map(); // runId -> { chatId, platform }
const abortedHubRuns = new Set();
let tgBot = null;
let reconnectAttempts = 0;
let queueTimeout = null;

const PROPERTY_MEDIA = {
    "penthouse": path.join(process.cwd(), "public", "properties", "penthouse.png"),
    "itahye": path.join(process.cwd(), "public", "properties", "mansion.png"),
    "itahyé": path.join(process.cwd(), "public", "properties", "mansion.png"),
    "mansion": path.join(process.cwd(), "public", "properties", "mansion.png"),
    "itaim": path.join(process.cwd(), "public", "properties", "studio.png"),
    "studio": path.join(process.cwd(), "public", "properties", "studio.png"),
};

async function sendMediaIfMentioned(chatId, platform, text) {
    const lowerText = text.toLowerCase();
    for (const [key, filePath] of Object.entries(PROPERTY_MEDIA)) {
        if (lowerText.includes(key)) {
            if (platform === 'Telegram' && tgBot && fs.existsSync(filePath)) {
                await tgBot.sendPhoto(chatId, filePath, { caption: `📸 Tour Visual: ${key.toUpperCase()}` });
                logDebug(`[Hub] Mídia enviada para ${key}`);
            }
        }
    }
}

// Função auxiliar para gerar áudio (Suporta textos longos dividindo em partes)
async function getVoiceAudio(text) {
    try {
        const chunks = text.match(/[\s\S]{1,200}/g) || [];
        const buffers = [];
        
        for (const chunk of chunks) {
            const url = googleTTS.getAudioUrl(chunk, {
                lang: 'pt-BR',
                slow: false,
                host: 'https://translate.google.com',
            });
            
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'arraybuffer',
            });
            buffers.push(Buffer.from(response.data));
        }
        
        return Buffer.concat(buffers);
    } catch (e) {
        logDebug('[Hub] Erro ao gerar TTS:', e.message);
        return null;
    }
}

// Função auxiliar para gerar áudio realista (ElevenLabs)

// --- Estabilização TTS: Apenas Google TTS Ativo ---


// Função auxiliar para transcrever áudio (OpenAI Whisper)
async function transcribeAudio(fileId) {
    try {
        if (!tgBot) return null;
        
        // 1. Obter link do arquivo no Telegram
        const fileLink = await tgBot.getFileLink(fileId);
        
        // 2. Baixar o áudio como buffer
        const response = await axios({
            url: fileLink,
            method: 'GET',
            responseType: 'arraybuffer'
        });
        
        // 3. Preparar FormData para OpenAI
        const formData = new FormData();
        const blob = new Blob([response.data], { type: 'audio/ogg' });
        formData.append('file', blob, 'voice.ogg');
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'pt');

        // 4. Enviar para Groq Whisper (compatível com OpenAI API)
        const whisperRes = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
            headers: {
                'Authorization': `Bearer ${process.env.HERMES_API_KEY}`,
                'Content-Type': 'multipart/form-data'
            }
        });

        return whisperRes.data.text;
    } catch (e) {
        logDebug('[Hub] Erro na transcrição Whisper:', e.response?.data || e.message);
        return null;
    }
}

// 1. Conector com o Escritório 3D (Hermes Adapter)
let hermesReady = false; // Flag: só envia após handshake 'hello-ok'

function connectHermes() {
    logDebug('[Hub] Conectando ao Hermes 3D Adapter em ' + HERMES_WS_URL + ` (tentativa ${reconnectAttempts + 1})`);
    hermesReady = false;
    ws = new WebSocket(HERMES_WS_URL);

    ws.on('open', () => {
        reconnectAttempts = 0; // Reset backoff on success
        logDebug('✅ [Hub] Conectado à iAmobil!');
        ws.send(JSON.stringify({
            type: "req",
            id: "auth-hub-" + Date.now(),
            method: "connect",
            params: {}
        }));
    });

    ws.on('message', async (raw) => {
        try {
            const frame = JSON.parse(raw);

            // 0. Handshake concluído — liberar a Fila
            if (frame.type === 'res' && frame.payload?.type === 'hello-ok') {
                hermesReady = true;
                logDebug('🤝 [Hub] Handshake OK! Hermes Adapter está PRONTO para receber mensagens.');
                processQueue(); // Processar mensagens que chegaram antes da conexão
            }
            
            // 1. Tratamento das respostas de chat (Stream)
            if (frame.type === 'event' && frame.event === 'chat') {
                const payload = frame.payload;
                if (!payload || !payload.runId) return;
                
                const reqData = pendingRequests.get(payload.runId);
                
                // Unlock queue on terminal states even if reqData is missing
                if (payload.state === 'final' || payload.state === 'error' || payload.state === 'aborted') {
                    isProcessingQueue = false;
                    if (queueTimeout) clearTimeout(queueTimeout);
                    processQueue();
                }

                if (!reqData) return;

                if (payload.state === 'final') {
                    if (payload.message && payload.message.content) {
                        let ans = payload.message.content;

                        // Detectar e despachar Notificação ao CEO (Fallback embutido no chat)
                        if (ans.includes('[NOTIFICATION:')) {
                            const nMatch = ans.match(/\[NOTIFICATION:\s*([\s\S]*?)\]/);
                            if (nMatch && nMatch[1]) {
                                const nMsg = nMatch[1].trim();
                                const ceoFile = path.join(process.cwd(), '.ceo_id');
                                if (fs.existsSync(ceoFile) && tgBot) {
                                    const ceoId = fs.readFileSync(ceoFile, 'utf8').trim();
                                    tgBot.sendMessage(ceoId, `🔔 **Alerta iAmobil:**\n\n${nMsg}`, { parse_mode: 'Markdown' });
                                }
                                ans = ans.replace(/\[NOTIFICATION:\s*([\s\S]*?)\]/, '').trim();
                            }
                        }

                        let actingAgentName = payload.actingAgentName || process.env.HERMES_AGENT_NAME || "Equipe";
                        
                        if (reqData.platform === 'Telegram' && tgBot) {
                            try {
                                let docPath = null;
                                const docMatch = ans.match(/\[TELEGRAM_DOCUMENT:\s*([^\]]+)\]/);
                                if (docMatch) {
                                    docPath = docMatch[1].trim();
                                    ans = ans.replace(docMatch[0], '').trim();
                                }

                                 let imgPath = null;
                                 const imgMatch = ans.match(/\[?TELEGRAM_IMAGE:\s*([^\]\s\n]+)\]?/i);
                                 if (imgMatch) {
                                     imgPath = imgMatch[1].trim();
                                     ans = ans.replace(imgMatch[0], '').trim();
                                     logDebug(`[Hub] Tag de imagem detectada: ${imgPath}`);
                                 }

                                 // Nova limpeza de "vazamento" de tool calls (XML, func=, function tags)
                                 ans = ans.replace(/<function[\s\S]*?<\/function>/gi, "")
                                          .replace(/func=[a-zA-Z0-9_]+>[\s\S]*?(?:\n|$)/gi, "")
                                          .replace(/<[a-zA-Z0-9_]+>[\s\S]*?<\/(?:[a-zA-Z0-9_]+|function)>/gi, "")
                                          .trim();

                                const textForVoice = (ans || "")
                                    .replace(/https?:\/\/\S+/gi, '')
                                    .replace(/[\*\#\_]/g, '')
                                    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
                                    .replace(/\s+/g, ' ')
                                    .trim();
                                
                                // 1. Entrega do Texto (Independente)
                                const safeAns = (typeof ans === 'string' && ans.length > 0) ? ans : "Desculpe, não consegui processar a resposta.";
                                try {
                                    logDebug(`[Telegram] Enviando texto (${safeAns.length} chars) para ChatID: ${reqData.chatId}`);
                                    await tgBot.sendMessage(reqData.chatId, `🤖 **${actingAgentName}:**\n\n${safeAns}`, { parse_mode: 'Markdown' });
                                } catch (err) { 
                                    logDebug(`[Telegram] Falha no Markdown, tentando Texto Plano...`); 
                                    try {
                                        await tgBot.sendMessage(reqData.chatId, `🤖 ${actingAgentName}:\n\n${safeAns}`);
                                    } catch (err2) {
                                        logDebug(`[Telegram] Erro crítico ao enviar texto:`, err2.message);
                                    }
                                }

                                try {
                                    await sendMediaIfMentioned(reqData.chatId, 'Telegram', ans);
                                } catch (err) { logDebug(`[Telegram] Erro Mídia:`, err.message); }

                                if (docPath && fs.existsSync(docPath)) {
                                    try {
                                        logDebug(`[Telegram] Enviando documento: ${docPath}`);
                                        await tgBot.sendDocument(reqData.chatId, docPath);
                                    } catch (err) {
                                        logDebug(`[Telegram] Erro ao enviar documento:`, err.message);
                                    }
                                }

                                 if (imgPath) {
                                     const absPath = path.resolve(process.cwd(), imgPath);
                                     if (fs.existsSync(absPath)) {
                                         try {
                                             logDebug(`[Telegram] Enviando imagem personalizada: ${absPath}`);
                                             await tgBot.sendPhoto(reqData.chatId, absPath);
                                         } catch (err) {
                                             logDebug(`[Telegram] Erro ao enviar imagem:`, err.message);
                                         }
                                     } else {
                                         logDebug(`[Hub] ❌ Arquivo de imagem não encontrado: ${absPath}`);
                                     }
                                 }

                                    // 2. Entrega do Áudio (Obrigatória - Independente)
                                    logDebug(`[Telegram] Iniciando pipeline de áudio obrigatório...`);
                                    try {
                                        let audioBuffer = null;
                                        
                                        // 1. Google TTS (Fallback Final Único - Estabilidade Total)
                                        if (textForVoice) {
                                            logDebug(`[Hub] Gerando voz via sistema estável iAmobil.`);
                                            audioBuffer = await getVoiceAudio(textForVoice);
                                        }

                                    if (audioBuffer) {
                                        logDebug(`[Telegram] Despachando áudio (${audioBuffer.length} bytes)...`);
                                        await tgBot.sendVoice(reqData.chatId, audioBuffer, {}, { filename: 'audio.mp3', contentType: 'audio/mpeg' });
                                    } else {
                                        logDebug(`[Hub] ❌ Erro Fatal: Todos os sistemas de voz falharam.`);
                                    }
                                } catch (errAudio) {
                                    logDebug(`[Telegram] Falha na entrega do áudio:`, errAudio.message || JSON.stringify(errAudio));
                                    if (errAudio.response && errAudio.response.body) {
                                        logDebug(`[Telegram] Detalhe da Falha no Áudio:`, JSON.stringify(errAudio.response.body));
                                    }
                                }
                            } catch (errGlobal) { 
                                logDebug(`[Telegram] Erro de Processamento Global:`, errGlobal.message);
                            }
                        }
                    }
                    pendingRequests.delete(payload.runId);
                } else if (payload.state === 'error' || payload.state === 'aborted') {
                    const errorMsg = payload.errorMessage || "";
                    logDebug(`[Hub] Erro recebido do Hermes: ${errorMsg}`);
                    
                    if (reqData.platform === 'Telegram' && tgBot) {
                        if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("rate limit")) {
                            tgBot.sendMessage(reqData.chatId, `🔄 *Sincronizando iAmobil...* Nossa inteligência central está com alta demanda. Estou otimizando seu atendimento, por favor aguarde 15 segundos e tente novamente.`, { parse_mode: 'Markdown' });
                        } else if (errorMsg.toLowerCase().includes("balance") || errorMsg.toLowerCase().includes("credit") || errorMsg.toLowerCase().includes("billing")) {
                            tgBot.sendMessage(reqData.chatId, `💳 *Saldo Insuficiente:* O sistema central está sem créditos para processar novas mensagens. Por favor, verifique sua conta.`, { parse_mode: 'Markdown' });
                        } else if (errorMsg.includes("400") || errorMsg.toLowerCase().includes("context_length") || errorMsg.toLowerCase().includes("maximum context")) {
                            tgBot.sendMessage(reqData.chatId, `🔄 *Sincronizando sistema...* Tivemos um excesso de informações, estou limpando o histórico para continuarmos. Por favor, envie sua mensagem novamente em um instante.`, { parse_mode: 'Markdown' });
                            ws.send(JSON.stringify({ type: "req", id: `reset-${Date.now()}`, method: "sessions.reset", params: { key: reqData.sessionKey || "agent:hermes:main" } }));
                        } else {
                            tgBot.sendMessage(reqData.chatId, `🚨 *Instabilidade Momentânea:* Tivemos um soluço na nossa inteligência central. Estou tentando me reconectar.`, { parse_mode: 'Markdown' });
                        }
                    }
                    pendingRequests.delete(payload.runId);
                }
            }
            
            // 2. Tratamento de Notificações Push (CEO Alert)

            if (frame.type === 'event' && frame.event === 'notification') {
                const ceoFile = path.join(process.cwd(), '.ceo_id');
                if (fs.existsSync(ceoFile) && tgBot) {
                    const ceoId = fs.readFileSync(ceoFile, 'utf8');
                    tgBot.sendMessage(ceoId, `🔔 **Alerta iAmobil:**\n\n${frame.payload.message}`, { parse_mode: 'Markdown' });
                }
            }
            
        } catch (e) { logDebug('[Hub] Erro ao processar frame:', e.message); }
    });

    ws.on('close', () => {
        hermesReady = false;
        isProcessingQueue = false; // Reset queue if connection is lost
        if (queueTimeout) clearTimeout(queueTimeout);
        
        reconnectAttempts++;
        const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 30000); // 5s, 10s, 20s, max 30s
        logDebug(`❌ [Hub] Conexão perdidda. Reconectando em ${delay / 1000}s... (tentativa ${reconnectAttempts})`);
        setTimeout(connectHermes, delay);
    });

    ws.on('error', (err) => {
        logDebug('[Hub] Erro WebSocket:', err.message);
    });
}

const messageQueue = [];
let isProcessingQueue = false;

function sendToAgents(task, platform, chatId, msgRef = null) {
    // Sempre enfileira — se o Hermes não estiver pronto, a fila será processada quando conectar
    logDebug(`🚦 [Broker] Nova tarefa recebida: "${task.substring(0, 20)}..." | Plataforma: ${platform} | ChatID: ${chatId}`);
    messageQueue.push({ task, platform, chatId, msgRef });
    if (ws && ws.readyState === WebSocket.OPEN && hermesReady) {
        processQueue();
    } else {
        logDebug(`⚠️ [Hub] Hermes ainda conectando. Mensagem aguardando na fila (${messageQueue.length} pendentes).`);
        if (platform === 'Telegram' && tgBot) {
            tgBot.sendMessage(chatId, `⏳ Conectando ao escritório iAmobil... Sua mensagem será respondida em instantes.`);
        }
    }
    return true;
}

function processQueue() {
    if (isProcessingQueue || messageQueue.length === 0) return;
    
    isProcessingQueue = true;
    const item = messageQueue.shift();
    const runId = `hub-run-${Date.now()}`;
    
    logDebug(`🧠 [Broker] Processando da Fila (Restam ${messageQueue.length}): "${item.task}"`);
    pendingRequests.set(runId, { platform: item.platform, chatId: item.chatId, msgRef: item.msgRef });
    
    logDebug(`[Broker] Estado da Fila: isProcessingQueue=${isProcessingQueue}, Pendentes=${pendingRequests.size}`);

    
    // Auto-destravar a fila em 90 segundos (Watchdog agressivo)
    if (queueTimeout) clearTimeout(queueTimeout);
    queueTimeout = setTimeout(() => {
        if (isProcessingQueue) {
            logDebug(`🕒 [Hub] Watchdog alert: Timeout na fila para runId: ${runId}. Destravando...`);
            abortedHubRuns.add(runId);
            if (item.platform === 'Telegram' && tgBot) {
                tgBot.sendMessage(item.chatId, `⚠️ *Atraso no Escritório:* O sistema central está demorando. Vou tentar de novo...`, { parse_mode: 'Markdown' });
            }
            isProcessingQueue = false;
            processQueue();
        }
    }, 90000);

    // 1. Chamar Banco de Dados RAG (Vetorizado) antes de enviar para a IA
    ragEngine.searchKnowledge(item.task).then(ragContext => {
        if (abortedHubRuns.has(runId)) {
            logDebug(`🚫 [Hub] Descartando mensagem abortada pelo Watchdog: ${runId}`);
            abortedHubRuns.delete(runId);
            return;
        }
        let finalMessage = item.task;
        if (ragContext) {
            logDebug(`📚 [RAG] Conhecimento letal recuperado. Injetando no contexto...`);
            finalMessage = `[INSTRUÇÃO DE MERCADO / TÉCNICA RAG A SEGUIR]:\n${ragContext}\n\n[MENSAGEM DO CLIENTE ABAIXO]:\n${item.task}`;
        }
        
        ws.send(JSON.stringify({
            type: "req", id: `req-${Date.now()}`, method: "chat.send",
            params: { sessionKey: "agent:hermes:main", message: finalMessage, idempotencyKey: runId }
        }));
    }).catch(err => {
        logDebug(`❌ [RAG] Erro ao buscar conhecimento: ${err.message}`);
        ws.send(JSON.stringify({
            type: "req", id: `req-${Date.now()}`, method: "chat.send",
            params: { sessionKey: "agent:hermes:main", message: item.task, idempotencyKey: runId }
        }));
    });
}

// 2. Configurar Telegram com Self-Healing
function startTelegramBot() {
    if (!TELEGRAM_TOKEN) return;
    
    try {
        // Modo Webhook: sem polling, recebe updates via HTTP /api/tg-webhook
        tgBot = new TelegramBot(TELEGRAM_TOKEN, {
            request: { agentOptions: { family: 4 } }
        });
        global.tgBot = tgBot;
        
        // Desregistrar webhooks no Hub causava conflito com o modo Webhook da Nuvem.
        // tgBot.deleteWebHook().catch(() => {});
        
        logDebug('✅ [Telegram] Bot inicializado! Aguardando Webhook do Telegram...');
        
        // Processar updates que chegaram antes do bot estar pronto
        if (global.pendingTelegramUpdates && global.pendingTelegramUpdates.length > 0) {
            logDebug(`📬 [Telegram] Processando ${global.pendingTelegramUpdates.length} updates da fila...`);
            global.pendingTelegramUpdates.forEach(u => { try { tgBot.processUpdate(u); } catch(e) {} });
            global.pendingTelegramUpdates = [];
        }


        tgBot.on('message', async (msg) => {
            logDebug(`📩 [Telegram] Mensagem recebida de ID: ${msg.chat.id} | Conteúdo: ${msg.text?.substring(0, 30)}...`);
            const text = msg.text;
        const voice = msg.voice || msg.audio;

        if (voice) {
            const transcribedText = await transcribeAudio(voice.file_id);
            if (transcribedText) {
                await tgBot.sendMessage(msg.chat.id, `🎤 *Você disse:* _"${transcribedText}"_`, { parse_mode: 'Markdown' });
                sendToAgents(transcribedText, 'Telegram', msg.chat.id);
            } else {
                tgBot.sendMessage(msg.chat.id, '🚨 Não consegui entender seu áudio.');
            }
            return;
        }


        if (text === '/start') {
            tgBot.sendMessage(msg.chat.id, `👋 Olá! Sou o *${AGENT_NAME}*, ${AGENT_ROLE} iAmobil.\nUse */catalogo* para ver imóveis, */relatorio* para o relatório de vendas, ou fale comigo!`, { parse_mode: 'Markdown' });
            return;
        }

        // ─── Gatilho de Relatório PDF ────────────────────────────────────────
        const isReportTrigger = text && (
            text === '/relatorio' ||
            /relat[oó]rio/i.test(text)
        );
        if (isReportTrigger) {
            tgBot.sendMessage(msg.chat.id, '📊 *Gerando Relatório Executivo de Vendas...* Aguarde um instante!', { parse_mode: 'Markdown' });
            try {
                const pdfPath = await generateSalesReportPDF();
                await tgBot.sendDocument(msg.chat.id, pdfPath, { caption: '📈 *Relatório iAmobil — Gerado em tempo real!*', parse_mode: 'Markdown' });
                logDebug(`[Hub] Relatório PDF enviado com sucesso para ${msg.chat.id}`);
            } catch (err) {
                logDebug(`[Hub] Erro ao gerar relatório PDF: ${err.message}`);
                tgBot.sendMessage(msg.chat.id, `❌ Falha ao gerar o relatório: ${err.message}`);
            }
            return;
        }

        if (text === '/catalogo') {
            const catalogPath = path.join(process.cwd(), "assets", "knowledge_base", "CATALOG.md");
            if (fs.existsSync(catalogPath)) {
                const content = fs.readFileSync(catalogPath, "utf8");
                const items = content.split("---").filter(s => s.trim() && s.includes("R$")).slice(0, 3);
                let list = "⭐ *Destaques de Hoje:*\n\n";
                items.forEach(item => {
                    const title = item.match(/\#\# (.*)/)?.[1] || "Imóvel";
                    const price = item.match(/R\$ (.*)/)?.[0] || "";
                    list += `🏙️ *${title}*\n💰 ${price}\n\n`;
                });
                list += `🔗 *Catálogo Completo:* https://edyinvesti.github.io/IAmobil.com/`;
                tgBot.sendMessage(msg.chat.id, list, { parse_mode: 'Markdown' });
            }
            return;
        }

        if (text === '/admin') {
            fs.writeFileSync(path.join(process.cwd(), '.ceo_id'), msg.chat.id.toString());
            tgBot.sendMessage(msg.chat.id, '✅ *CEO Registrado!* Você receberá alertas de novos leads aqui.', { parse_mode: 'Markdown' });
            return;
        }

        if (text && !text.startsWith('/')) {
            if (!sendToAgents(text, 'Telegram', msg.chat.id)) {
                tgBot.sendMessage(msg.chat.id, '🚨 Escritório offline.');
            }
        }
        });
    } catch (e) {
        logDebug('[Telegram] Erro crítico ao iniciar bot:', e.message);
    }
}

// 3. (WhatsApp Removido)

function initCronJob() {
    logDebug('⏰ [Cron] Iniciando Motor de Autofollow-up Ativo (Varredura a cada 15 minutos)');
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(process.cwd(), "data", "iamobil.db");
    
    setInterval(async () => {
        if (!fs.existsSync(dbPath)) return;
        const db = new sqlite3.Database(dbPath);
        
        db.all("SELECT * FROM leads WHERE status = 'Frio' AND score >= 80 LIMIT 1", [], async (err, rows) => {
            if (err) { logDebug('[Cron] Erro no DataEngine:', err.message); db.close(); return; }
            if (rows && rows.length > 0) {
                const lead = rows[0];
                logDebug(`⏰ [Cron] Autonomia Iniciada! Abordando ativo o Lead Top-Tier: ${lead.name}`);
                
                // 1. Gerar Mensagem Autonoma Persuasiva
                const groqKey = process.env.HERMES_API_KEY || process.env.OPENAI_API_KEY;
                const prompt = `Você é o Edy, corretor chefe de alto padrão. Crie uma curta mensagem de WhatsApp informal, elegante e envolvente (máx 3 linhas) para reengajar o cliente "${lead.name}". 
                Ele demonstrou interesse em: "${lead.interest}". Anotações do sistema: "${lead.notes}".
                O objetivo é apenas puxar assunto e oferecer uma novidade exclusiva focada no interesse dele de forma natural. Não use saudações formais exageradas. Retorne APENAS a mensagem pronta.`;

                try {
                    const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
                        model: "llama-3.3-70b-versatile",
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.7
                    }, { headers: { "Authorization": `Bearer ${groqKey}` } });

                    let aiMessage = response.data.choices[0].message.content.trim();
                    aiMessage = aiMessage.replace(/^"|"$/g, ""); // limpa aspas caso a IA devolva

                    logDebug(`⚠️ [Cron] Sistema autônomo aguardando novas integrações.`);
                    db.close();
                } catch (aiErr) {
                    logDebug(`❌ [Cron] Falha ao gerar abordagem autônoma: ${aiErr.message}`);
                    db.close();
                }
            } else {
                db.close();
            }
        });
    }, 900000); // Roda a cada 900.000ms (15 minutos)
}

connectHermes();
initCronJob();
startTelegramBot();
