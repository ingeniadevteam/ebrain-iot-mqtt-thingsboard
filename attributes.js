'use strict';

const CronJob = require('cron').CronJob;
const { writeFileSync } = require('fs');

module.exports = (app, topic, message, isGateway) => {
    const attributesFilePath = `${app.configDir}/attributes.json`;
    let current, newValue;

    if (!message) return;

    if (isGateway) {
        if (topic === 'v1/gateway/attributes/response') {
            if (!message.hasOwnProperty('value')) return;
            const deviceName = message.device;
            const device = app.attributes[deviceName];
            if (device) {
                const devices_attributes = { ...app.attributes };
                delete devices_attributes.gateway;
                const keys = Object.keys(devices_attributes[message.device]).sort();
                const key = keys[message.id];
                if (key) {
                    if (device[key] !== message.value) {
                        current = device[key];
                        newValue = message.value;
                        device[key] = message.value;
                        writeFileSync(attributesFilePath, JSON.stringify(app.attributes, null, 4));
                        app.logger.info(`mqtt app.attributes.${deviceName}.${key} changed from '${current}' to '${newValue}'`);
                    }
                }
            }

        } else if (topic === 'v1/gateway/attributes') {
            const device = message.device;
            const data = message.data;
            if (device && data) {
                if (app.attributes.hasOwnProperty(device)) {
                    Object.keys(data).forEach(attr => {
                        if (app.attributes[device][attr] !== data[attr]) {               
                            try {
                                // update config
                                current = app.attributes[device][attr];
                                newValue = message.data[attr];
                                app.attributes[device][attr] = newValue;
                                // update attributes config file
                                writeFileSync(attributesFilePath, JSON.stringify(app.attributes, null, 4));
                                // info
                                app.logger.info(`mqtt app.attributes.${device}.${attr} changed from '${current}' to '${newValue}'`);
                            } catch (error) {
                                app.logger.error(`attributes: ${error.message}`);
                            }
                        }
                    });
                }
            }
        } else if (topic === 'v1/devices/me/attributes') {
            // look for attributes config changes
            Object.keys(message).forEach(attr => {
                // check attribute
                if (!app.attributes.gateway || !app.attributes.gateway.hasOwnProperty(attr)) return;                
                // check diff
                if (app.attributes.gateway[attr] !== message[attr]) {               
                    try {
                        if (app[attr] && app[attr].job) {
                            // stop the job
                            app[attr].job.stop();
                            // create new job
                            app[attr].job = new CronJob(message[attr], () =>
                            require(`@clysema/ebrain-iot-${module}`)(app)(app), null, true, 'Europe/Madrid');
                        }
                        // update config
                        current = app.attributes.gateway[attr];
                        newValue = message[attr];
                        app.attributes.gateway[attr] = newValue;
                        // update attributes config file
                        writeFileSync(attributesFilePath, JSON.stringify(app.attributes, null, 4));
                        // info
                        app.logger.info(`mqtt app.attributes.gateway.${attr} changed from '${current}' to '${newValue}'`);
                    } catch (error) {
                        app.logger.error(`attributes: ${error.message}`);
                    }
                }
            });
        }
    } else if (topic === 'v1/devices/me/attributes') {
        // look for attributes config changes
        Object.keys(message).forEach(attr => {
            // check attribute
            if (!app.attributes || !app.attributes.hasOwnProperty(attr)) return;
            // check diff
            if (app.attributes[attr] !== message[attr]) {               
                try {
                    if (app[attr] && app[attr].job) {
                        // stop the job
                        app[attr].job.stop();
                        // create new job
                        app[attr].job = new CronJob(message[attr], () =>
                        require(`@clysema/ebrain-iot-${module}`)(app)(app), null, true, 'Europe/Madrid');
                    }
                    // update config
                    current = app.attributes[attr];
                    newValue = message[attr];
                    app.attributes[attr] = newValue;
                    // update attributes config file
                    writeFileSync(attributesFilePath, JSON.stringify(app.attributes, null, 4));
                    // info
                    app.logger.info(`mqtt app.attributes.${attr} changed from '${current}' to '${newValue}'`);
                } catch (error) {
                    app.logger.error(`attributes: ${error.message}`);
                }
            }
        });
    }
};
