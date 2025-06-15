module.exports = (bot, options) => {
    const password = bot.config.password;
    const portalNumber = options.settings.portalNumber;
    const log = bot.sendLog;

    if (!password) {
        log('[AuthPlugin] Ошибка: Пароль не указан в настройках самого бота. Авторизация невозможна.');
        return;
    }

    let messageListener = null;

    const loginPromptPattern = /^(?:\||›|◊)\s*(?:Авторизируйтесь|Введите пароль|Чтобы продолжить игру введите)/i;
    const registerPromptPattern = /^(?:\||›|◊)\s*(?:Зарегистрируйтесь|Создайте пароль)/i;
    const successPattern = /Вы успешно вошли|Успешная авторизация|Добро пожаловать|Привяжите аккаунт|Вы успешно зарегистрировались/i;

    function getWorldType() {
        if (bot.game.difficulty === 'peaceful' && bot.game.levelType === 'flat') {
            return bot.game.gameMode === 'adventure' ? 'Hub' : 'Auth';
        } else if (bot.game.difficulty === 'easy' && bot.game.levelType === 'default') {
            return 'Survival';
        }
        return 'Unknown';
    }

    function cleanupListener() {
        if (messageListener) {
            bot.events.removeListener('core:raw_message', messageListener);
            messageListener = null;
            log('[AuthPlugin] Слушатель сообщений авторизации отключен.');
        }
    }

    function goToPortal() {
        if (portalNumber && portalNumber > 0) {
            const portalCommand = `/s${portalNumber}`;
            log(`[AuthPlugin] Перехожу на портал ${portalNumber}...`);
            setTimeout(() => {
                bot.api.sendMessage('command', portalCommand);
                bot.events.emit('auth:portal_joined', { 
                    portal: portalNumber,
                    server: bot.config.server.host 
                });
                log(`[AuthPlugin] Сгенерировано событие 'auth:portal_joined' для портала ${portalNumber}.`);
            }, 1500);
        }
    }

    const messageHandler = (rawMessageText) => {
        if (!rawMessageText) return;

        let commandToSend = null;

        if (loginPromptPattern.test(rawMessageText)) {
            commandToSend = `/login ${password}`;
        } else if (registerPromptPattern.test(rawMessageText)) {
            commandToSend = `/reg ${password} ${password}`;
        }

        if (commandToSend) {
            log(`[AuthPlugin] Обнаружен запрос на аутентификацию. Отправка команды...`);
            setTimeout(() => {
                bot.api.sendMessage('command', commandToSend);
            }, 2000);
            return;
        }

        if (successPattern.test(rawMessageText)) {
            log('[AuthPlugin] Авторизация прошла успешно. Ожидаю телепортации в хаб...');
            cleanupListener();
        }
    };
    
    bot.on('spawn', () => {
        cleanupListener();

        const worldType = getWorldType();
        log(`[AuthPlugin] Бот заспавнился в мире типа: ${worldType}`);

        switch (worldType) {
            case 'Hub':
                log('[AuthPlugin] Обнаружен хаб. Бот уже авторизован. Перехожу на портал.');
                goToPortal();
                break;
            
            case 'Auth':
                log('[AuthPlugin] Обнаружен мир авторизации.');
                messageListener = messageHandler;
                bot.events.on('core:raw_message', messageListener);
                break;

            case 'Survival':
                log('[AuthPlugin] Бот уже в игровом мире. Никаких действий не требуется.');
                break;

            default:
                log(`[AuthPlugin] Неизвестный тип мира. Никаких действий не требуется.`);
                break;
        }
    });

    bot.once('end', () => {
        cleanupListener();
        log('[AuthPlugin] Бот отключается, все ресурсы плагина очищены.');
    });

    log('[AuthPlugin] Плагин автоматической авторизации загружен и готов к работе.');
};
