const fs = require("fs");
const path = require("path");

class TokenOptimizer {
    constructor(softLimit = 4000) {
        this.softLimit = softLimit;
    }

    /**
     * Calcula uma estimativa rápida de tokens (aprox. 1 token = 4 chars para pt-br)
     */
    estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 3.5); // Aproximação conservadora para pt-br
    }

    analyzeMessages(messages) {
        let total = 0;
        messages.forEach(m => {
            total += this.estimateTokens(m.content || "");
            if (m.tool_calls) total += this.estimateTokens(JSON.stringify(m.tool_calls));
        });
        return total;
    }

    shouldAlert(totalTokens) {
        return totalTokens > this.softLimit;
    }

    /**
     * Gera recomendações de compressão se o limite for atingido
     */
    getRecommendations(totalTokens) {
        if (!this.shouldAlert(totalTokens)) return null;

        return {
            warning: `Prompt grande detectado (${totalTokens} tokens estimated).`,
            actions: [
                "Reduzir histórico para 1 única mensagem.",
                "Remover ferramentas opcionais.",
                "Resumir o contexto RAG injetado."
            ]
        };
    }
}

module.exports = new TokenOptimizer();
