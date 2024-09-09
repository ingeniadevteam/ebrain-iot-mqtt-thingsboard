'use strict';

// const CronJob = require('cron').CronJob;
// const { writeFileSync } = require('fs');

module.exports = (app, topic, message, isGateway) => {
    if (!isGateway) return;
    try {
        const { method, params } = JSON.parse(message);

        let attr;
        if (method.includes('get')) {
            attr = method.split('get')[1];
            if (app.attributes.hasOwnProperty(attr)) {
                app['mqtt-thingsboard'].client.publish(
                    topic.replace('request', 'response'),
                    app.attributes[attr].toString()
                );
            }
        } else if (method.includes('set')) {
            let attribute;
            attr = method.split('set')[1];
            if (app.attributes.hasOwnProperty(attr)) {
                if (typeof app.attributes[attr] === typeof params) {
                    app.attributes[attr] = params;
                    attribute = {};
                    attribute[attr] = params;
                    app['mqtt-thingsboard'].client.publish(
                        'v1/devices/me/attributes', JSON.stringify(attribute)
                    );
                } else if (typeof params === 'object') {
                    if (typeof app.attributes[attr] === typeof params[attr]) {
                        app.attributes[attr] = params[attr];
                        attribute = {};
                        attribute[attr] = params[attr];
                        app['mqtt-thingsboard'].client.publish(
                            'v1/devices/me/attributes', JSON.stringify(attribute)
                        );
                    }
                }
            }
        }
    } catch (error) {
        console.log(error);
        app.logger.error(`rpc ${error.message}`);
    }
};
