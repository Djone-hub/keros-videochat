// Retry mechanism for Supabase requests
(function() {
    class SupabaseRetryManager {
        constructor(maxRetries = 3, baseDelay = 1000) {
            this.maxRetries = maxRetries;
            this.baseDelay = baseDelay;
            this.retryCount = new Map();
        }

        async executeWithRetry(operation, operationName = 'Supabase operation') {
            const key = `${operationName}_${Date.now()}`;
            this.retryCount.set(key, 0);

            for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
                try {
                    // console.log(`🔄 [Retry] Попытка ${attempt + 1}/${this.maxRetries + 1} для ${operationName}`);
                    const result = await operation();
                    
                    if (attempt > 0) {
                        // console.log(`✅ [Retry] Операция ${operationName} успешно выполнена после ${attempt} повторных попыток`);
                    }
                    
                    this.retryCount.delete(key);
                    return result;
                } catch (error) {
                    // console.error(`❌ [Retry] Попытка ${attempt + 1} не удалась для ${operationName}:`, error.message);
                    
                    if (attempt === this.maxRetries) {
                        // console.error(`💀 [Retry] Все попытки исчерпаны для ${operationName}`);
                        this.retryCount.delete(key);
                        throw error;
                    }

                    // Exponential backoff
                    const delay = this.baseDelay * Math.pow(2, attempt);
                    // console.log(`⏳ [Retry] Ожидание ${delay}мс перед следующей попыткой...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        getRetryStatus(operationName) {
            return Array.from(this.retryCount.entries())
                .filter(([key]) => key.includes(operationName))
                .map(([key, count]) => ({ key, count }));
        }

        resetRetries() {
            this.retryCount.clear();
            // console.log('🔄 [Retry] Все счетчики повторных попыток сброшены');
        }
    }

    // Create global instance
    window.supabaseRetryManager = new SupabaseRetryManager();
    
    // console.log('✅ Supabase Retry Manager инициализирован');
})();
