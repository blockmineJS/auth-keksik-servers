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
    let hubInterval = null;

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

    function stopHubInterval() {
        if (hubInterval) {
            clearInterval(hubInterval);
            hubInterval = null;
        }
    }

    function inAuth() {
        bot.events.emit('auth:auth_joined', { server });
    }

    function inHub() {
        bot.events.emit('auth:hub_joined', { server });
    }

    function inPortal() {
        bot.events.emit('auth:portal_joined', {
            command: hubCmd || null,
            server: server
        });
    }

    function doHubCmd() {
        if (!hubCmd) {
            log('[AuthPlugin] hubCmd не задан, не могу отправлять команду из хаба.');
            return;
        }
        bot.api.sendMessage('command', hubCmd);
    }

    function doPortalCmd() {
        if (!portalCmd) return;
        setTimeout(() => bot.api.sendMessage('command', portalCmd), 2000);
    }

    function startHubInterval() {
        if (!hubCmd) return;

        stopHubInterval();

        hubInterval = setInterval(() => {
            const worldType = getWorldType();

            if (worldType !== 'Hub') {
                stopHubInterval();
                handleWorldType(worldType);
                return;
            }

            doHubCmd();
        }, 10000);
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
            bot.api.sendMessage('command', commandToSend);
            return;
        }

        if (successPattern.test(rawMessageText)) {
            cleanupListener();

            setTimeout(() => {
                const worldType = getWorldType();
                handleWorldType(worldType);
            }, 1000);
        }
    };

    function handleWorldType(worldType) {
        switch (worldType) {
            case 'Hub':
                inHub();
                cleanupListener();
                startHubInterval();
                break;

            case 'Auth':
                inAuth();
                stopHubInterval();
                cleanupListener();
                messageListener = messageHandler;
                bot.events.on('core:raw_message', messageListener);
                break;

            case 'Portal':
                inPortal();
                stopHubInterval();
                cleanupListener();
                doPortalCmd();
                break;

            default:
                log('[AuthPlugin] Неизвестный тип мира. Никаких действий не требуется.');
                stopHubInterval();
                cleanupListener();
                break;
        }
    }

    bot.on('login', () => {
        setTimeout(() => {
            cleanupListener();
            stopHubInterval();

            const worldType = getWorldType();
            handleWorldType(worldType);
        }, 1000);
    });

    bot.once('end', () => {
        cleanupListener();
        stopHubInterval();
        log('[AuthPlugin] Бот отключается, все ресурсы плагина очищены.');
    });

    log('[AuthPlugin] Плагин автоматической авторизации загружен и готов к работе.');
};

