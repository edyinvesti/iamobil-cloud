const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = '6202370881';

if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN não encontrado no .env');
    process.exit(1);
}

const bot = new TelegramBot(token);

bot.sendMessage(chatId, "🚀 **Teste de Conectividade iAmobil**\n\nOlá! Esta é uma mensagem de teste enviada pela equipe técnica para confirmar que sua integração com o Telegram está 100% operacional.\n\nPode continuar seu trabalho, estou aqui para ajudar! 👔", { parse_mode: 'Markdown' })
    .then(() => {
        console.log('✅ Mensagem enviada com sucesso para o Telegram!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Falha ao enviar mensagem:', err.message);
        process.exit(1);
    });
