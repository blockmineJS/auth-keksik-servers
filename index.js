
module.exports = (bot, options) => {
    const password = bot.config.password;
    const portalNumber = options.settings.portalNumber;
    const log = bot.sendLog;

    if (!password) {
        log('[AuthPlugin] Ошибка: Пароль не указан в настройках самого бота. Авторизация невозможна.');
        return;
    }

    let isAuthenticated = false;

    const loginPromptPattern = /^(?:\||›|◊)\s*(?:Авторизируйтесь|Введите пароль)/i;
    const registerPromptPattern = /^(?:\||›|◊)\s*(?:Зарегистрируйтесь|Создайте пароль)/i;
    
    const successPattern = /Вы успешно вошли|Успешная авторизация|Добро пожаловать|Привяжите аккаунт|Вы успешно зарегистрировались/i;

    const messageHandler = (rawMessageText, jsonMsg) => {
        if (isAuthenticated || !rawMessageText) return;

        let commandToSend = null;

        if (loginPromptPattern.test(rawMessageText)) {
            commandToSend = `/login ${password}`;
        } else if (registerPromptPattern.test(rawMessageText)) {
            commandToSend = `/reg ${password} ${password}`;
        }

        if (commandToSend) {
            log(`[AuthPlugin] Обнаружен запрос на аутентификацию. Отправка команды через 2 секунды...`);
            setTimeout(() => {
                bot.api.sendMessage('command', commandToSend);
            }, 2000);
            return;
        }

        if (successPattern.test(rawMessageText)) {
            isAuthenticated = true;
            log('[AuthPlugin] Авторизация прошла успешно.');
            
            if (portalNumber && portalNumber > 0) {
                const portalCommand = `/s${portalNumber}`;
                setTimeout(() => {
                    bot.api.sendMessage('command', portalCommand);
                    bot.events.emit('auth:portal_joined', { 
                        portal: portalNumber,
                        server: bot.config.server.host 
                    });
                    log(`[AuthPlugin] Сгенерировано событие 'auth:portal_joined' для портала ${portalNumber}.`);
                }, 1000);
            }
            
            bot.events.removeListener('core:raw_message', messageHandler);
            log('[AuthPlugin] Задача выполнена, слушатель сообщений отключен.');
        }
    };

    bot.events.on('core:raw_message', messageHandler);

    bot.once('end', () => {
        bot.events.removeListener('core:raw_message', messageHandler);
    });

    log('[AuthPlugin] Плагин автоматической авторизации загружен и готов к работе.');
};
