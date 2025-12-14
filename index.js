module.exports = (bot, options) => {
    const password = bot.config.password;
    const server = bot.config.server.host;
    
    const hubCmd = options.settings.hubCmd;
    const portalCmd = options.settings.portalCmd;
    const hubIntervalSeconds = options.settings.hubInterval || 5;
    
    const log = bot.sendLog;

    if (!password) {
        log('[AuthPlugin] Ошибка: Пароль не указан в настройках самого бота. Авторизация невозможна.');
        return;
    }

    let messageListener = null;
    let hubInterval = null;

    const loginPromptPattern = /(?:\||›|◊|✾|\[✾\])\s*(?:Авторизируйтесь|Введите пароль|Войдите в игру|Чтобы продолжить игру введите)/i;
    const registerPromptPattern = /(?:\||›|◊|✾|\[✾\])\s*(?:Зарегистрируйтесь|Создайте пароль)/i;
    const successPattern = /Вы успешно вошли|Успешная авторизация|Добро пожаловать|Привяжите аккаунт|Вы успешно зарегистрировались|Успешная регистрация! Приятной игры|Успешная авторизация! Приятной игры/i;

    function getWorldType() {
        const y = bot.entity.position.y;
        const difficulty = bot.game.difficulty;
        const levelType = bot.game.levelType;

        if (server.toLowerCase().includes('funtime')) {
            if (levelType === 'flat') {
                if (y === 100) {
                    return 'Hub';
                }
                return 'Unknown';
            } else {
                return 'Portal';
            }
        }

        if (difficulty === 'peaceful' && levelType === 'flat') {
            if (server.includes('mineblaze')) {
                return y === 19 ? 'Auth' : 'Hub';
            } else if (server.includes('masedworld')) {
                return y === 50 ? 'Auth' : 'Hub';
            } else if (server.includes('dexland')) {
                return y === 100 ? 'Auth' : 'Hub';
            } else if (server.includes('cheatmine')) {
                return y === 59 ? 'Auth' : 'Hub';
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
        if (!hubCmd) return;
        bot.api.sendMessage('command', hubCmd);
    }

    function doPortalCmd() {
        if (!portalCmd) return;
        setTimeout(() => bot.api.sendMessage('command', portalCmd), 2000);
    }

    function startHubInterval() {
        if (!hubCmd) return;

        stopHubInterval();

        const intervalTime = hubIntervalSeconds * 1000;

        hubInterval = setInterval(() => {
            const worldType = getWorldType();

            if (worldType !== 'Hub') {
                stopHubInterval();
                if (worldType === 'Portal') {
                    log(`[AuthPlugin] Телепортация на портал!`);
                }
                handleWorldType(worldType);
                return;
            }

            doHubCmd();
        }, intervalTime);

        doHubCmd();
    }

    const messageHandler = (rawMessageText) => {
        if (!rawMessageText) return;

        let commandToSend = null;

        if (loginPromptPattern.test(rawMessageText)) {
            commandToSend = `/login ${password}`;
        } else if (registerPromptPattern.test(rawMessageText)) {
            if (server.toLowerCase().includes('funtime')) {
                commandToSend = `/reg ${password}`;
            } else {
                commandToSend = `/reg ${password} ${password}`;
            }
        }

        if (commandToSend) {
            bot.api.sendMessage('command', commandToSend);
            return;
        }

        if (successPattern.test(rawMessageText)) {
            log('[AuthPlugin] Успешная авторизация!');
            cleanupListener();

            if (server.toLowerCase().includes('funtime')) {
                setTimeout(() => {
                    const worldType = getWorldType();

                    if (worldType === 'Unknown') {
                        setTimeout(() => {
                            const retryWorldType = getWorldType();
                            handleWorldType(retryWorldType);
                        }, 2000);
                    } else {
                        handleWorldType(worldType);
                    }
                }, 1000);
            } else {
                setTimeout(() => {
                    const worldType = getWorldType();
                    handleWorldType(worldType);
                }, 1000);
            }
        }
    };

    function handleWorldType(worldType) {
        switch (worldType) {
            case 'Hub':
                log('[AuthPlugin] Бот в лобби.');
                inHub();
                cleanupListener();
                startHubInterval();
                break;

            case 'Auth':
                log('[AuthPlugin] Бот в мире авторизации.');
                inAuth();
                stopHubInterval();
                if (!messageListener) {
                    messageListener = messageHandler;
                    bot.events.on('core:raw_message', messageListener);
                }
                break;

            case 'Portal':
                if (hubCmd) {
                    log(`[AuthPlugin] Бот зашел на портал (${hubCmd}).`);
                } else {
                    log('[AuthPlugin] Бот зашел на портал.');
                }
                inPortal();
                stopHubInterval();
                cleanupListener();
                doPortalCmd();
                break;

            case 'Unknown':
                stopHubInterval();
                if (!messageListener) {
                    messageListener = messageHandler;
                    bot.events.on('core:raw_message', messageListener);
                }
                break;

            default:
                stopHubInterval();
                cleanupListener();
                break;
        }
    }

    bot.on('login', () => {
        setTimeout(() => {
            stopHubInterval();

            const worldType = getWorldType();

            if (worldType !== 'Unknown') {
                cleanupListener();
            }

            handleWorldType(worldType);
        }, 1000);
    });

    bot.once('end', () => {
        cleanupListener();
        stopHubInterval();
    });

    log('[AuthPlugin] Плагин загружен.');
};