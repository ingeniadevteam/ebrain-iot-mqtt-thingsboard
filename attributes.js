'use strict';

const CronJob = require('cron').CronJob;
const { writeFileSync } = require('fs');

module.exports = (app, message) => {
    const attributesFilePath = `${app.configDir}/attributes.json`;
    let current;

    if (!message) {
        app.logger.error(`attributes: NO SHARED ATTRIBUTES! CONFIGURE THEM IN THE PLATFORM`);
        return app.attributes;
    }

    // look for attributes config changes
    Object.keys(message).forEach(attr => {
        // check attribute
        if (!app.attributes || !app.attributes.hasOwnProperty(attr)) return;
        // check diff
        if (app.attributes[attr] !== message[attr]) {               
            try {
                if (app[attr.job]) {
                    // stop the job
                    app[attr].job.stop();
                    // create new job
                    app[attr].job = new CronJob(message[attr], () =>
                    require(`@clysema/ebrain-iot-${module}`)(app)(app), null, true, 'Europe/Madrid');
                }
                // update config
                current = app.attributes[attr];
                app.attributes[attr] = message[attr];
                // update attributes config file
                writeFileSync(attributesFilePath, JSON.stringify(app.attributes, null, 4));
                // info
                app.logger.info(`mqtt app.attributes.${attr} changed from '${current}' to '${message[attr]}'`);
            } catch (error) {
                app.logger.error(`attributes: ${error.message}`);
            }
        }
    });
};