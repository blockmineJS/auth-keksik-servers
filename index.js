
module.exports = (bot, options) => {
    const password = bot.config.password;
    const portalNumber = options.settings.portalNumber;

    if (!password) {
        bot.sendLog('[AuthPlugin] Ошибка: Пароль не указан в настройках самого бота. Авторизация невозможна.');
        return;
    }

    let isAuthenticated = false;

    const loginPromptPattern = /^(?:\||›|◊)\s*(?:Авторизируйтесь|Введите пароль)\s*(?:»|›)\s*\/login\s*\[пароль\]/i;
    const registerPromptPattern = /^(?:\||›|◊)\s*(?:Зарегистрируйтесь|Создайте пароль)\s*(?:»|›)\s*\/reg\s*\[пароль\](?: \[повтор пароля\])?/i;
    const successPattern = /Вы успешно вошли|Успешная авторизация|Добро пожаловать|Привяжите аккаунт к соц\. сети/i;

    const messageHandler = (jsonMsg) => {
        if (isAuthenticated) return;
        const message = jsonMsg.toString();
        let commandToSend = null;

        if (loginPromptPattern.test(message)) {
            commandToSend = `/login ${password}`;
        } else if (registerPromptPattern.test(message)) {
            commandToSend = `/reg ${password} ${password}`;
        }

        if (commandToSend) {
            bot.sendLog(`[AuthPlugin] Обнаружен запрос на аутентификацию. Отправка команды через 2 секунды...`);
            setTimeout(() => bot.chat(commandToSend), 2000);
            return;
        }

        if (successPattern.test(message)) {
            isAuthenticated = true;
            bot.sendLog('[AuthPlugin] Авторизация прошла успешно.');
            
            if (portalNumber && portalNumber > 0) {
                const portalCommand = `/s${portalNumber}`;
                bot.sendLog(`[AuthPlugin] Переход на портал ${portalNumber}. Команда "${portalCommand}" будет отправлена через 3 секунды...`);
                setTimeout(() => {
                    bot.chat(portalCommand);
                    bot.events.emit('auth:portal_joined', { 
                        portal: portalNumber,
                        server: bot.config.server.host 
                    });
                    bot.sendLog(`[AuthPlugin] Сгенерировано событие 'auth:portal_joined' для портала ${portalNumber}.`);
                }, 3000);
            }
            
            bot.removeListener('message', messageHandler);
        }
    };

    bot.on('message', messageHandler);
    bot.once('end', () => bot.removeListener('message', messageHandler));
    bot.sendLog('[AuthPlugin] Плагин автоматической авторизации загружен.');
};