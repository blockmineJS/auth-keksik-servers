module.exports = (bot, options) => {
    const password = bot.config.password;
    const server = bot.config.server.host;
    const hubCmd = options.settings.hubCmd;
    const portalCmd = options.settings.portalCmd;
    const log = bot.sendLog;
    
    if (!password) {
        log('[AuthPlugin] Ошибка: Пароль не указан в настройках самого бота. Авторизация невозможна.');
        return;
    }

    let messageListener = null;

    const loginPromptPattern = /^(?:\n| )*(?:\||›|◊)\s*(?:Авторизируйтесь|Введите пароль|Чтобы продолжить игру введите)/i;
    const registerPromptPattern = /^(?:\n| )*(?:\||›|◊)\s*(?:Зарегистрируйтесь|Создайте пароль)/i;
    const successPattern = /Вы успешно вошли|Успешная авторизация|Добро пожаловать|Привяжите аккаунт|Вы успешно зарегистрировались/i;

    function getWorldType() {
        if (bot.game.difficulty === 'peaceful' && bot.game.levelType === 'flat') {
            if (server.includes('mineblaze')) {
                return bot.entity.position.y === 19 ? 'Auth' : 'Hub';
            } else if (server.includes('masedworld')) {
                return bot.entity.position.y === 50 ? 'Auth' : 'Hub';
            } else if (server.includes('dexland')) {
                return bot.entity.position.y === 100 ? 'Auth' : 'Hub';
            } else if (server.includes('cheatmine')) {
                return bot.entity.position.y === 59 ? 'Auth' : 'Hub';
            } else {
                return 'Unknown';
            }
        } else {
            return 'Portal';
        }
    }

    function cleanupListener() {
        if (messageListener) {
            bot.events.removeListener('core:raw_message', messageListener);
            messageListener = null;
            log('[AuthPlugin] Слушатель сообщений авторизации отключен.');
        }
    }

    function inAuth() {
        bot.events.emit('auth:auth_joined', {
            server: server 
        });
        log(`[AuthPlugin] Сгенерировано событие 'auth:auth_joined': ${server}`);
    }

    function inHub() {
        bot.events.emit('auth:hub_joined', {
            server: server 
        });
        log(`[AuthPlugin] Сгенерировано событие 'auth:hub_joined': ${server}`);
    }

    function inPortal() {
        bot.events.emit('auth:portal_joined', { 
            command: hubCmd,
            server: server 
        });
        log(`[AuthPlugin] Сгенерировано событие 'auth:portal_joined': ${hubCmd}, ${server}.`);
    }

    function doHubCmd() {
        log(`[AuthPlugin] Прописываю ${hubCmd}...`);
        bot.api.sendMessage('command', hubCmd);
    }

    function doPortalCmd() {
        log(`[AuthPlugin] Прописываю ${portalCmd}...`);
        setTimeout(() => bot.api.sendMessage('command', portalCmd), 2000);
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
            bot.api.sendMessage('command', commandToSend);
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
                log('[AuthPlugin] Бот в хабе.');
                inHub()
                if (hubCmd) {
                    log('[AuthPlugin] Пишем команду в хабе.');
                    doHubCmd();
                } else {
                    log('[AuthPlugin] Никаких действий в хабе не требуется.');
                }
                break;
            
            case 'Auth':
                log('[AuthPlugin] Бот на авторизации.');
                inAuth();
                messageListener = messageHandler;
                bot.events.on('core:raw_message', messageListener);
                break;

            case 'Portal':
                log('[AuthPlugin] Бот на режиме.');
                inPortal()
                if (portalCmd) {
                    log('[AuthPlugin] Пишем команду на режиме.');
                    doPortalCmd();
                }
                else {
                    log('[AuthPlugin] Никаких действий на режиме не требуется.');
                }
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
